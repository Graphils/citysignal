// ============================================================
// CITYSIGNAL — MULTI-SOURCE SCRAPER v2
// Fetches from multiple sources and skips duplicates
// Run with: node scraper.js
// ============================================================

const SUPABASE_URL = "https://bfoimncmtvounnsxqvfi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmb2ltbmNtdHZvdW5uc3hxdmZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTcxNjYsImV4cCI6MjA4ODEzMzE2Nn0.Z_a9HJbe6Q6YBvEKnXzSNKrgQo1P8hBwuMTEszSSlwo";

const REDDIT_SOURCES = [
  { url: "https://www.reddit.com/r/Montgomery/new.json?limit=25", source: "Reddit r/Montgomery" },
  { url: "https://www.reddit.com/r/alabama/new.json?limit=25", source: "Reddit r/Alabama" },
  { url: "https://www.reddit.com/r/Alabama/search.json?q=montgomery&sort=new&limit=25", source: "Reddit r/Alabama" },
  { url: "https://www.reddit.com/r/news/search.json?q=montgomery+alabama&sort=new&limit=15", source: "Reddit r/News" },
  { url: "https://www.reddit.com/r/politics/search.json?q=montgomery+alabama&sort=new&limit=10", source: "Reddit r/Politics" },
];

const HEADERS = {
  "User-Agent": "CitySignal/1.0 (civic misinformation detection; hackathon project)",
};

// Get existing post URLs to avoid duplicates
async function getExistingUrls() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/flagged_posts?select=post_url&order=created_at.desc&limit=200`,
    { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
  );
  const data = await res.json();
  return new Set(data.map(p => p.post_url).filter(Boolean));
}

// Fetch posts from a single Reddit source
async function fetchFromReddit(url, sourceName) {
  console.log(`Fetching from ${sourceName}...`);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.log(`  ⚠ Failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const children = data?.data?.children || [];
    const posts = children.map(child => ({
      title: child.data.title,
      selftext: child.data.selftext || "",
      author: child.data.author,
      permalink: "https://reddit.com" + child.data.permalink,
      created_utc: child.data.created_utc,
      subreddit: child.data.subreddit,
      score: child.data.score,
      sourceName,
    }));
    console.log(`  ✓ Found ${posts.length} posts`);
    return posts;
  } catch (err) {
    console.log(`  ⚠ Error: ${err.message}`);
    return [];
  }
}

// Fetch Google News RSS for Montgomery
async function fetchGoogleNews() {
  console.log("Fetching Google News for Montgomery Alabama...");
  try {
    const queries = [
      "Montgomery+Alabama+city",
      "Montgomery+Alabama+crime",
      "Montgomery+Alabama+emergency",
      "Montgomery+Alabama+government",
    ];

    const allPosts = [];

    for (const query of queries) {
      const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) continue;

      const text = await res.text();

      // Parse RSS items
      const items = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
      for (const item of items.slice(0, 10)) {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                      item.match(/<title>(.*?)<\/title>/)?.[1] || "";
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
        const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
                           item.match(/<description>(.*?)<\/description>/)?.[1] || "";

        if (title && title.toLowerCase().includes("montgomery")) {
          allPosts.push({
            title: title.replace(/ - .*$/, "").trim(),
            selftext: description.replace(/<[^>]*>/g, "").slice(0, 300),
            author: "Google News",
            permalink: link,
            created_utc: pubDate ? new Date(pubDate).getTime() / 1000 : Date.now() / 1000,
            sourceName: "Google News",
          });
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`  ✓ Found ${allPosts.length} news articles`);
    return allPosts;
  } catch (err) {
    console.log(`  ⚠ Google News error: ${err.message}`);
    return [];
  }
}

// Save new posts to Supabase
async function savePosts(posts, existingUrls) {
  const newPosts = posts
    .filter(p => !existingUrls.has(p.permalink))
    .filter(p => (p.title || p.selftext).trim().length > 20)
    .map(p => ({
      post_text: (p.title || "") + (p.selftext ? " " + p.selftext : ""),
      source: p.sourceName,
      author: p.author || "unknown",
      post_url: p.permalink || "",
      timestamp: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : new Date().toISOString(),
      status: "pending",
    }));

  if (newPosts.length === 0) {
    console.log("No new posts to save — all already in database");
    return 0;
  }

  console.log(`Saving ${newPosts.length} NEW posts to Supabase...`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/flagged_posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(newPosts),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Supabase insert error:", err);
    return 0;
  }

  console.log(`✓ Saved ${newPosts.length} new posts!`);
  return newPosts.length;
}

// Trigger AI analysis
async function triggerAnalysis() {
  console.log("\nTriggering AI analysis...");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-posts`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  console.log("Analysis result:", JSON.stringify(data));
}

// Main
async function main() {
  console.log("🚀 CitySignal Multi-Source Scraper v2\n");

  const existingUrls = await getExistingUrls();
  console.log(`Found ${existingUrls.size} existing posts in database\n`);

  let allPosts = [];

  // Fetch from all Reddit sources
  for (const source of REDDIT_SOURCES) {
    const posts = await fetchFromReddit(source.url, source.source);
    allPosts = allPosts.concat(posts);
    await new Promise(r => setTimeout(r, 1000));
  }

  // Fetch from Google News
  const newsPosts = await fetchGoogleNews();
  allPosts = allPosts.concat(newsPosts);

  console.log(`\nTotal posts fetched: ${allPosts.length}`);

  const saved = await savePosts(allPosts, existingUrls);

  if (saved > 0) {
    console.log("\n⏳ Waiting 3 seconds before triggering analysis...");
    await new Promise(r => setTimeout(r, 3000));
    await triggerAnalysis();
  }

  console.log("\n✅ Done! Check your dashboard at https://citysignal.vercel.app");
}

main();