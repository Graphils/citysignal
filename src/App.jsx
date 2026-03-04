// ============================================================
// CITYSIGNAL — DAY 3: COMPLETE DASHBOARD
// Paste this ENTIRE file into Bolt.new
// Then tell Bolt: "Connect this to my Supabase database.
// Replace SUPABASE_URL and SUPABASE_KEY with my credentials."
// ============================================================

import { useState, useEffect } from "react";

const SUPABASE_URL = "https://bfoimncmtvounnsxqvfi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmb2ltbmNtdHZvdW5uc3hxdmZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTcxNjYsImV4cCI6MjA4ODEzMzE2Nn0.Z_a9HJbe6Q6YBvEKnXzSNKrgQo1P8hBwuMTEszSSlwo";

// ── Helpers ──────────────────────────────────────────────────

function riskColor(score) {
  if (score >= 80) return { bg: "#FEE2E2", text: "#DC2626", badge: "#DC2626" };
  if (score >= 60) return { bg: "#FEF3C7", text: "#D97706", badge: "#D97706" };
  if (score >= 40) return { bg: "#FEF9C3", text: "#CA8A04", badge: "#CA8A04" };
  return { bg: "#DCFCE7", text: "#16A34A", badge: "#16A34A" };
}

function riskLabel(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH RISK";
  if (score >= 40) return "MODERATE";
  return "LOW RISK";
}

function timeAgo(ts) {
  if (!ts) return "unknown";
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function fetchPosts(filter = "all") {
  let url = `${SUPABASE_URL}/rest/v1/flagged_posts?status=eq.analyzed&order=created_at.desc&limit=50`;
  if (filter === "high") url += "&risk_score=gte.60";
  if (filter === "critical") url += "&risk_score=gte.80";
  if (filter === "civic") url += "&is_civic_claim=eq.true";

  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
}

async function fetchStats() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/flagged_posts?select=risk_score,is_civic_claim,status,created_at`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) return null;
  const all = await res.json();
  const today = all.filter(p => new Date(p.created_at) > new Date(Date.now() - 86400000));
  return {
    total: today.length,
    analyzed: all.filter(p => p.status === "analyzed").length,
    flagged: all.filter(p => p.risk_score >= 60).length,
    critical: all.filter(p => p.risk_score >= 80).length,
  };
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({ label, value, color = "#E94560" }) {
  return (
    <div style={{
      background: "#1E1E2E", borderRadius: 12, padding: "20px 24px",
      flex: 1, minWidth: 140, borderTop: `3px solid ${color}`
    }}>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{value ?? "—"}</div>
      <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function PostCard({ post, onClick, selected }) {
  const risk = riskColor(post.risk_score);
  return (
    <div onClick={() => onClick(post)} style={{
      background: selected ? "#252540" : "#1E1E2E",
      border: `1px solid ${selected ? "#E94560" : "#333"}`,
      borderRadius: 12, padding: 16, cursor: "pointer",
      transition: "all 0.15s", marginBottom: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{
              background: risk.badge, color: "#fff", borderRadius: 6,
              padding: "2px 8px", fontSize: 11, fontWeight: 700
            }}>{riskLabel(post.risk_score)}</span>
            <span style={{
              background: "#2A2A3E", color: "#888", borderRadius: 6,
              padding: "2px 8px", fontSize: 11
            }}>{post.source}</span>
          </div>
          <p style={{ color: "#DDD", fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            {post.post_text?.length > 160 ? post.post_text.slice(0, 160) + "…" : post.post_text}
          </p>
          {post.claim_summary && (
            <p style={{ color: "#AAA", fontSize: 12, marginTop: 8, fontStyle: "italic" }}>
              Claim: {post.claim_summary}
            </p>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: `conic-gradient(${risk.badge} ${post.risk_score * 3.6}deg, #2A2A3E 0deg)`,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%", background: "#1E1E2E",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: risk.badge
            }}>{post.risk_score}</div>
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{timeAgo(post.created_at)}</div>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ post, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!post) return null;
  const risk = riskColor(post.risk_score);

  function copy() {
    navigator.clipboard.writeText(post.drafted_correction || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      position: "fixed", right: 0, top: 0, bottom: 0, width: 420,
      background: "#12121E", borderLeft: "1px solid #333",
      padding: 24, overflowY: "auto", zIndex: 100
    }}>
      <button onClick={onClose} style={{
        background: "#2A2A3E", border: "none", color: "#888",
        borderRadius: 8, padding: "6px 12px", cursor: "pointer", marginBottom: 20
      }}>← Close</button>

      <div style={{
        background: risk.bg + "22", border: `1px solid ${risk.badge}44`,
        borderRadius: 12, padding: 16, marginBottom: 20
      }}>
        <div style={{ fontSize: 13, color: risk.badge, fontWeight: 700, marginBottom: 4 }}>
          {riskLabel(post.risk_score)} — Risk Score: {post.risk_score}/100
        </div>
        <div style={{ fontSize: 13, color: "#AAA" }}>{post.reasoning}</div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 6, textTransform: "uppercase" }}>Original Post</div>
        <div style={{
          background: "#1E1E2E", borderRadius: 8, padding: 14,
          fontSize: 14, color: "#DDD", lineHeight: 1.6
        }}>{post.post_text}</div>
        <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
          {post.source} · {post.author} · {timeAgo(post.created_at)}
        </div>
      </div>

      {post.claim_summary && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6, textTransform: "uppercase" }}>Claim Detected</div>
          <div style={{
            background: "#1E1E2E", borderRadius: 8, padding: 14,
            fontSize: 14, color: "#DDD", fontStyle: "italic"
          }}>{post.claim_summary}</div>
        </div>
      )}

      {post.drafted_correction && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#16A34A", marginBottom: 6, textTransform: "uppercase", fontWeight: 700 }}>
            ✓ Drafted Correction
          </div>
          <div style={{
            background: "#0F2010", border: "1px solid #16A34A44",
            borderRadius: 8, padding: 14, fontSize: 14, color: "#86EFAC", lineHeight: 1.6
          }}>{post.drafted_correction}</div>
          <button onClick={copy} style={{
            marginTop: 10, width: "100%", background: copied ? "#16A34A" : "#E94560",
            border: "none", color: "#fff", borderRadius: 8, padding: "10px 16px",
            cursor: "pointer", fontWeight: 700, fontSize: 14, transition: "background 0.2s"
          }}>
            {copied ? "✓ Copied to clipboard!" : "Copy Correction"}
          </button>
        </div>
      )}

      {post.post_url && (
        <a href={post.post_url} target="_blank" rel="noreferrer" style={{
          display: "block", textAlign: "center", color: "#888",
          fontSize: 13, textDecoration: "none", marginTop: 10
        }}>View original post →</a>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────

export default function CitySignal() {
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function load() {
    try {
      const [p, s] = await Promise.all([fetchPosts(filter), fetchStats()]);
      setPosts(p);
      setStats(s);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);
  useEffect(() => {
    const interval = setInterval(load, 60000); // auto-refresh every 60s
    return () => clearInterval(interval);
  }, [filter]);

  const filters = [
    { id: "all", label: "All Posts" },
    { id: "civic", label: "Civic Claims" },
    { id: "high", label: "High Risk (60+)" },
    { id: "critical", label: "Critical (80+)" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D1A", color: "#EEE", fontFamily: "Inter, Arial, sans-serif" }}>

      {/* NAV */}
      <div style={{
        background: "#12121E", borderBottom: "1px solid #222",
        padding: "0 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: "#E94560",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800
          }}>C</div>
          <span style={{ fontWeight: 800, fontSize: 20, color: "#FFF" }}>CitySignal</span>
          <span style={{ fontSize: 13, color: "#555" }}>Montgomery, AL</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16A34A", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 13, color: "#16A34A" }}>LIVE</span>
          </div>
          <span style={{ fontSize: 12, color: "#555" }}>Updated {timeAgo(lastRefresh)}</span>
          <button onClick={load} style={{
            background: "#1E1E2E", border: "1px solid #333", color: "#888",
            borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13
          }}>Refresh</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", paddingRight: selected ? 460 : 24 }}>

        {/* STATS */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
          <StatCard label="Posts Scanned Today" value={stats?.total} color="#60A5FA" />
          <StatCard label="Posts Analyzed" value={stats?.analyzed} color="#A78BFA" />
          <StatCard label="Flagged (60+)" value={stats?.flagged} color="#FBBF24" />
          <StatCard label="Critical (80+)" value={stats?.critical} color="#E94560" />
        </div>

        {/* HEADER */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "#FFF" }}>
            Misinformation Feed
          </h1>
          <p style={{ color: "#666", fontSize: 14, marginTop: 4 }}>
            Real-time civic claims detected across Reddit, local news, and community groups
          </p>
        </div>

        {/* FILTERS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              background: filter === f.id ? "#E94560" : "#1E1E2E",
              border: `1px solid ${filter === f.id ? "#E94560" : "#333"}`,
              color: filter === f.id ? "#FFF" : "#888",
              borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              fontSize: 13, fontWeight: filter === f.id ? 700 : 400
            }}>{f.label}</button>
          ))}
        </div>

        {/* FEED */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#555" }}>
            Loading posts...
          </div>
        ) : posts.length === 0 ? (
          <div style={{
            textAlign: "center", padding: 60, color: "#555",
            background: "#1E1E2E", borderRadius: 12
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
            <div style={{ fontSize: 16, marginBottom: 8 }}>No posts found</div>
            <div style={{ fontSize: 13 }}>
              {filter !== "all" ? "Try switching to 'All Posts'" : "Data will appear once Bright Data starts scraping"}
            </div>
          </div>
        ) : (
          posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              selected={selected?.id === post.id}
              onClick={p => setSelected(selected?.id === p.id ? null : p)}
            />
          ))
        )}
      </div>

      {/* DETAIL PANEL */}
      {selected && <DetailPanel post={selected} onClose={() => setSelected(null)} />}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
    </div>
  );
}
