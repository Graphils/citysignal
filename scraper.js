// ============================================================
// CITYSIGNAL — SCRAPER
// Fetches real Montgomery Reddit posts and pushes to Supabase
// Run with: node scraper.js
// ============================================================

const SUPABASE_URL = "https://bfoimncmtvounnsxqvfi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmb2ltbmNtdHZvdW5uc3hxdmZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTcxNjYsImV4cCI6MjA4ODEzMzE2Nn0.Z_a9HJbe6Q6YBvEKnXzSNKrgQo1P8hBwuMTEszSSlwo";
const BRIGHT_DATA_API_KEY = "508f0e31-f341-4eed-8fc1-3ffcb24bbdd1";

// Fetch Reddit posts via Bright Data API
async function fetchRedditPosts() {
  console.log("Fetching Montgomery Reddit posts via Bright Data...");

  const res = await fetch("https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_l7q7dkf244hwjntr0&include_errors=true", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${BRIGHT_DATA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      { url: "https://www.reddit.com/r/Montgomery/new.json?limit=25" },
      { url: "https://www.reddit.com/r/Montgomery/hot.json?limit=25" },
    ]),
  });

  console.log("Bright Data status:", res.status);

  if (!res.ok) {
    const err = await res.text();
    console.log("Bright Data error:", err);
    // Fall back to direct Reddit fetch
    return await fetchRedditDirect();
  }

  const data = await res.json();
  console.log("Bright Data response:", JSON.stringify(data).slice(0, 200));
  return data;
}

// Fallback: fetch Reddit directly
async function fetchRedditDirect() {
  console.log("Falling back to direct Reddit fetch...");

  const res = await fetch("https://www.reddit.com/r/Montgomery/new.json?limit=25", {
    headers: {
      "User-Agent": "CitySignal/1.0 (civic misinformation detection; contact: citysignal@example.com)",
    },
  });

  if (!res.ok) {
    throw new Error(`Reddit fetch failed: ${res.status}`);
  }

  const data = await res.json();
  const posts = data.data.children.map(child => ({
    title: child.data.title,
    selftext: child.data.selftext || "",
    author: child.data.author,
    permalink: "https://reddit.com" + child.data.permalink,
    created_utc: child.data.created_utc,
    subreddit: child.data.subreddit,
    score: child.data.score,
  }));

  console.log(`Fetched ${posts.length} posts directly from Reddit`);
  return posts;
}

// Save posts to Supabase
async function savePosts(posts) {
  if (!posts || posts.length === 0) {
    console.log("No posts to save");
    return;
  }

  const normalized = posts
    .filter(p => p.title || p.selftext)
    .map(p => ({
      post_text: (p.title || "") + (p.selftext ? " " + p.selftext : ""),
      source: "Reddit r/Montgomery",
      author: p.author || "unknown",
      post_url: p.permalink || "",
      timestamp: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : new Date().toISOString(),
      status: "pending",
    }))
    .filter(p => p.post_text.trim().length > 20);

  console.log(`Saving ${normalized.length} posts to Supabase...`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/flagged_posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(normalized),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Supabase insert error:", err);
    return;
  }

  console.log(`✓ Successfully saved ${normalized.length} posts!`);
}

// Trigger AI analysis
async function triggerAnalysis() {
  console.log("Triggering AI analysis...");

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
  try {
    console.log("🚀 CitySignal Scraper Starting...\n");

    const posts = await fetchRedditDirect();
    await savePosts(posts);

    console.log("\n⏳ Waiting 5 seconds before triggering analysis...");
    await new Promise(r => setTimeout(r, 5000));

    await triggerAnalysis();

    console.log("\n✅ Done! Check your dashboard at https://citysignal.vercel.app");

  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();