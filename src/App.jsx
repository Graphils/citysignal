import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://bfoimncmtvounnsxqvfi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmb2ltbmNtdHZvdW5uc3hxdmZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTcxNjYsImV4cCI6MjA4ODEzMzE2Nn0.Z_a9HJbe6Q6YBvEKnXzSNKrgQo1P8hBwuMTEszSSlwo";

// ── Helpers ──────────────────────────────────────────────────────────────────

function riskColor(score) {
  if (score >= 80) return { grad: "linear-gradient(135deg,#ff4444,#cc0000)", badge: "#ff4444", glow: "rgba(255,68,68,.35)", label: "CRITICAL", dot: "#ff4444" };
  if (score >= 60) return { grad: "linear-gradient(135deg,#ff8c00,#e65c00)", badge: "#ff8c00", glow: "rgba(255,140,0,.3)", label: "HIGH RISK", dot: "#ff8c00" };
  if (score >= 40) return { grad: "linear-gradient(135deg,#f5c518,#d4a017)", badge: "#f5c518", glow: "rgba(245,197,24,.25)", label: "MODERATE", dot: "#f5c518" };
  return { grad: "linear-gradient(135deg,#00c853,#00a040)", badge: "#00c853", glow: "rgba(0,200,83,.25)", label: "LOW RISK", dot: "#00c853" };
}

function timeAgo(ts) {
  if (!ts) return "—";
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
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchStats() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/flagged_posts?select=risk_score,is_civic_claim,status,created_at`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
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

// ── Risk Gauge ────────────────────────────────────────────────────────────────
function RiskGauge({ score }) {
  const r = riskColor(score);
  const pct = score / 100;
  const circ = 2 * Math.PI * 20;
  return (
    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="28" cy="28" r="20" fill="none" stroke="#1a1a2e" strokeWidth="5" />
        <circle
          cx="28" cy="28" r="20" fill="none"
          stroke={r.badge} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${r.badge})`, transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 13, fontWeight: 800, color: r.badge,
        fontFamily: "'Space Grotesk', monospace"
      }}>{score}</div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, delay = 0 }) {
  return (
    <div style={{
      background: "linear-gradient(145deg, #0e0e1f, #151528)",
      border: `1px solid ${color}30`,
      borderRadius: 16, padding: "22px 20px",
      flex: "1 1 160px",
      position: "relative", overflow: "hidden",
      animation: `fadeUp .5s ease ${delay}s both`,
      boxShadow: `0 4px 24px ${color}15, inset 0 1px 0 rgba(255,255,255,.04)`,
    }}>
      {/* glow orb */}
      <div style={{
        position: "absolute", top: -20, right: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: color, opacity: .08, filter: "blur(20px)",
        pointerEvents: "none"
      }} />
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <div style={{
        fontSize: 36, fontWeight: 800, color,
        fontFamily: "'Space Grotesk', monospace",
        lineHeight: 1, marginBottom: 6,
        textShadow: `0 0 20px ${color}60`
      }}>{value ?? <span style={{ opacity: .3 }}>—</span>}</div>
      <div style={{ fontSize: 12, color: "#4a4a6a", fontWeight: 500, letterSpacing: ".3px" }}>{label}</div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, transparent)`, borderRadius: "0 0 16px 16px" }} />
    </div>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({ post, onClick, selected, index }) {
  const r = riskColor(post.risk_score);
  return (
    <div
      onClick={() => onClick(post)}
      style={{
        background: selected
          ? `linear-gradient(145deg, #0e1230, #0a0f24)`
          : "linear-gradient(145deg, #0e0e1f, #0b0b1a)",
        border: `1px solid ${selected ? r.badge + "80" : "#1e1e35"}`,
        borderRadius: 14, padding: "16px 18px",
        cursor: "pointer", marginBottom: 10,
        transition: "all .2s",
        boxShadow: selected ? `0 0 0 1px ${r.badge}40, 0 8px 32px ${r.glow}` : "none",
        animation: `fadeUp .4s ease ${Math.min(index * 0.04, 0.4)}s both`,
        position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = "#2a2a45"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = "#1e1e35"; }}
    >
      {selected && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: r.grad, borderRadius: "14px 0 0 14px" }} />}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{
              background: r.grad, color: "#fff",
              borderRadius: 6, padding: "3px 9px",
              fontSize: 10, fontWeight: 800, letterSpacing: ".8px",
              boxShadow: `0 2px 8px ${r.glow}`,
              textTransform: "uppercase",
            }}>{r.label}</span>
            <span style={{
              background: "#151528", color: "#5a5a7a",
              border: "1px solid #252540",
              borderRadius: 6, padding: "3px 9px", fontSize: 11
            }}>{post.source || "Unknown"}</span>
            {post.is_civic_claim && (
              <span style={{
                background: "#0a1a3a", color: "#4da6ff",
                border: "1px solid #1a3a6a",
                borderRadius: 6, padding: "3px 9px", fontSize: 10, fontWeight: 700
              }}>CIVIC</span>
            )}
            <span style={{ fontSize: 11, color: "#2a2a45", marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
          </div>
          <p style={{
            color: "#c8c8e8", fontSize: 14, lineHeight: 1.6, margin: 0,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden"
          }}>
            {post.post_text}
          </p>
          {post.claim_summary && (
            <p style={{
              color: "#5a5a7a", fontSize: 12, marginTop: 8, fontStyle: "italic",
              borderLeft: `2px solid #252540`, paddingLeft: 10, lineHeight: 1.5
            }}>
              {post.claim_summary}
            </p>
          )}
        </div>
        <RiskGauge score={post.risk_score ?? 0} />
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
function DetailPanel({ post, onClose, isMobile }) {
  const [copied, setCopied] = useState(false);
  const r = riskColor(post.risk_score);

  function copy() {
    navigator.clipboard.writeText(post.drafted_correction || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const panelStyle = isMobile ? {
    position: "fixed", inset: 0, zIndex: 200,
    background: "#080815",
    overflowY: "auto", padding: 20,
    animation: "slideUp .3s cubic-bezier(.16,1,.3,1)",
  } : {
    width: 400, flexShrink: 0,
    background: "linear-gradient(180deg, #0a0a1a, #080815)",
    border: "1px solid #1a1a2e",
    borderRadius: 16, padding: 24,
    overflowY: "auto", maxHeight: "calc(100vh - 140px)",
    position: "sticky", top: 100,
    animation: "fadeUp .3s ease",
    boxShadow: `0 0 0 1px #1a1a2e, 0 24px 64px rgba(0,0,0,.5)`,
    alignSelf: "flex-start",
  };

  return (
    <div style={panelStyle}>
      <button onClick={onClose} style={{
        background: "#151528", border: "1px solid #252540",
        color: "#5a5a7a", borderRadius: 9, padding: "7px 14px",
        cursor: "pointer", fontSize: 13, marginBottom: 20,
        display: "flex", alignItems: "center", gap: 6,
        transition: "all .2s",
      }}
        onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#3a3a55"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#5a5a7a"; e.currentTarget.style.borderColor = "#252540"; }}
      >← {isMobile ? "Back to Feed" : "Close"}</button>

      {/* Risk banner */}
      <div style={{
        background: `linear-gradient(135deg, ${r.badge}18, ${r.badge}08)`,
        border: `1px solid ${r.badge}35`,
        borderRadius: 12, padding: "16px 18px", marginBottom: 20,
        position: "relative", overflow: "hidden"
      }}>
        <div style={{ position: "absolute", top: -10, right: -10, width: 60, height: 60, borderRadius: "50%", background: r.badge, opacity: .08, filter: "blur(15px)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RiskGauge score={post.risk_score ?? 0} />
          <div>
            <div style={{ fontSize: 14, color: r.badge, fontWeight: 800, letterSpacing: ".5px" }}>{r.label}</div>
            <div style={{ fontSize: 12, color: "#5a5a7a", marginTop: 2 }}>Risk Score: {post.risk_score}/100</div>
          </div>
        </div>
        {post.reasoning && (
          <div style={{ fontSize: 13, color: "#8888aa", marginTop: 12, lineHeight: 1.6, borderTop: `1px solid ${r.badge}20`, paddingTop: 12 }}>
            {post.reasoning}
          </div>
        )}
      </div>

      {/* Original post */}
      <Section label="Original Post">
        <div style={{ fontSize: 14, color: "#c8c8e8", lineHeight: 1.7 }}>{post.post_text}</div>
        <div style={{ fontSize: 11, color: "#2a2a45", marginTop: 10, display: "flex", gap: 12 }}>
          <span>{post.source}</span>
          {post.author && <span>·</span>}
          {post.author && <span>{post.author}</span>}
          <span>·</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>
      </Section>

      {post.claim_summary && (
        <Section label="Claim Detected">
          <div style={{ fontSize: 14, color: "#aaaacc", lineHeight: 1.6, fontStyle: "italic" }}>{post.claim_summary}</div>
        </Section>
      )}

      {post.drafted_correction && (
        <Section label="AI Drafted Correction" accent="#00c853">
          <div style={{
            fontSize: 13, color: "#86efac", lineHeight: 1.7,
            background: "rgba(0,200,83,.05)", borderRadius: 8,
            padding: "12px 14px", border: "1px solid rgba(0,200,83,.15)",
          }}>{post.drafted_correction}</div>
          <button onClick={copy} style={{
            marginTop: 12, width: "100%",
            background: copied ? "linear-gradient(135deg,#00c853,#00a040)" : "linear-gradient(135deg,#e94560,#c0303f)",
            border: "none", color: "#fff", borderRadius: 10,
            padding: "12px 16px", cursor: "pointer",
            fontWeight: 700, fontSize: 14,
            transition: "all .25s",
            boxShadow: copied ? "0 4px 16px rgba(0,200,83,.3)" : "0 4px 16px rgba(233,69,96,.3)",
            letterSpacing: ".3px",
          }}>
            {copied ? "✓ Copied to Clipboard!" : "Copy Correction"}
          </button>
        </Section>
      )}

      {post.post_url && (
        <a href={post.post_url} target="_blank" rel="noreferrer" style={{
          display: "flex", alignItems: "center", gap: 8,
          color: "#4a4a6a", fontSize: 13, textDecoration: "none",
          marginTop: 16, padding: "11px 14px",
          border: "1px solid #1a1a2e", borderRadius: 10,
          transition: "all .2s", overflow: "hidden", maxWidth: "100%",
          background: "#0e0e1f",
        }}
          onMouseEnter={e => { e.currentTarget.style.color = "#8888aa"; e.currentTarget.style.borderColor = "#252540"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#4a4a6a"; e.currentTarget.style.borderColor = "#1a1a2e"; }}
        >
          <span style={{ flexShrink: 0 }}>↗</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {post.post_url}
          </span>
        </a>
      )}
    </div>
  );
}

function Section({ label, children, accent = "#e94560" }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, color: accent, fontWeight: 800,
        textTransform: "uppercase", letterSpacing: "1.5px",
        marginBottom: 10, display: "flex", alignItems: "center", gap: 8
      }}>
        <div style={{ width: 16, height: 1.5, background: accent, borderRadius: 1 }} />
        {label}
      </div>
      <div style={{ background: "#0e0e1f", borderRadius: 10, padding: "14px 16px", border: "1px solid #1a1a2e" }}>
        {children}
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ filter }) {
  return (
    <div style={{
      textAlign: "center", padding: "64px 24px",
      background: "linear-gradient(145deg, #0e0e1f, #0b0b1a)",
      border: "1px solid #1a1a2e", borderRadius: 16,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "linear-gradient(135deg, #1a1a2e, #252540)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px", fontSize: 28,
        boxShadow: "0 0 30px rgba(233,69,96,.1)"
      }}>📡</div>
      <div style={{ fontSize: 17, color: "#6a6a8a", fontWeight: 600, marginBottom: 8 }}>No posts found</div>
      <div style={{ fontSize: 13, color: "#3a3a55", lineHeight: 1.6 }}>
        {filter !== "all" ? "Try switching to 'All Posts' to see everything." : "Data will appear once the scraper runs."}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          background: "linear-gradient(145deg, #0e0e1f, #0b0b1a)",
          border: "1px solid #1a1a2e", borderRadius: 14,
          padding: "18px", height: 110,
          animation: `shimmer 1.5s ease ${i * .15}s infinite alternate`,
        }} />
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function CitySignal() {
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);


  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
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
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  const FILTERS = [
    { id: "all", label: "All Posts" },
    { id: "civic", label: "Civic Claims" },
    { id: "high", label: "High Risk" },
    { id: "critical", label: "Critical" },
  ];

  const STATS = [
    { label: "Scanned Today", value: stats?.total, color: "#60a5fa", icon: "🔍" },
    { label: "Analyzed", value: stats?.analyzed, color: "#a78bfa", icon: "🤖" },
    { label: "Flagged (60+)", value: stats?.flagged, color: "#fbbf24", icon: "⚠️" },
    { label: "Critical (80+)", value: stats?.critical, color: "#ff4444", icon: "🚨" },
  ];

  const showDetail = selected && (!isMobile);
  const showMobileDetail = selected && isMobile;

  return (
    <div style={{ minHeight: "100vh", background: "#080815", color: "#eee", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* ── GLOBAL STYLES ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.85)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes slideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:none} }
        @keyframes shimmer { from{opacity:.4} to{opacity:.7} }
        @keyframes spin { to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #080815; }
        ::-webkit-scrollbar-thumb { background: #1a1a2e; border-radius: 2px; }
      `}</style>

      {/* ── NAV ── */}
      <div style={{
        background: "rgba(8,8,21,.92)", borderBottom: "1px solid #111122",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        padding: "0 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 62,
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 0 #111122, 0 4px 24px rgba(0,0,0,.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Logo */}
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg, #e94560, #c0303f)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 900, color: "#fff",
            boxShadow: "0 4px 14px rgba(233,69,96,.4)",
            fontFamily: "'Space Grotesk', sans-serif",
            flexShrink: 0,
          }}>CS</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#fff", lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>CitySignal</div>
            <div style={{ fontSize: 10, color: "#3a3a5a", letterSpacing: ".5px", marginTop: 1 }}>ACCRA, GHANA</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00c853", animation: "pulse 2s infinite", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#00c853", fontWeight: 600 }}>LIVE</span>
          </div>
          <span style={{ fontSize: 11, color: "#2a2a45", display: isMobile ? "none" : "block" }}>
            Updated {timeAgo(lastRefresh)}
          </span>
          <button onClick={load} style={{
            background: "#0e0e1f", border: "1px solid #1e1e35",
            color: "#5a5a7a", borderRadius: 8, padding: "6px 13px",
            cursor: "pointer", fontSize: 12, fontWeight: 600,
            transition: "all .2s", display: "flex", alignItems: "center", gap: 5,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#3a3a55"; e.currentTarget.style.color = "#aaa"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e35"; e.currentTarget.style.color = "#5a5a7a"; }}
          >
            <span style={{ fontSize: 13 }}>↻</span> Refresh
          </button>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "20px 16px" : "28px 24px" }}>

        {/* STATS GRID */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: 12, marginBottom: 28
        }}>
          {STATS.map((s, i) => <StatCard key={s.label} {...s} delay={i * 0.08} />)}
        </div>

        {/* PAGE HEADER */}
        <div style={{ marginBottom: 20, animation: "fadeUp .4s ease .15s both" }}>
          <h1 style={{
            fontSize: isMobile ? 22 : 26, fontWeight: 800, margin: 0, color: "#fff",
            fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-.5px"
          }}>Misinformation Feed</h1>
          <p style={{ color: "#3a3a55", fontSize: 13, marginTop: 5, lineHeight: 1.5 }}>
            Real-time civic claims detected across Reddit, local news & community groups
          </p>
        </div>

        {/* FILTERS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", animation: "fadeUp .4s ease .2s both" }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => { setFilter(f.id); setSelected(null); }} style={{
              background: filter === f.id ? "linear-gradient(135deg, #e94560, #c0303f)" : "#0e0e1f",
              border: `1px solid ${filter === f.id ? "transparent" : "#1e1e35"}`,
              color: filter === f.id ? "#fff" : "#5a5a7a",
              borderRadius: 9, padding: "8px 16px",
              cursor: "pointer", fontSize: 13, fontWeight: filter === f.id ? 700 : 500,
              transition: "all .2s",
              boxShadow: filter === f.id ? "0 4px 14px rgba(233,69,96,.3)" : "none",
            }}
              onMouseEnter={e => { if (filter !== f.id) { e.currentTarget.style.borderColor = "#3a3a55"; e.currentTarget.style.color = "#aaa"; } }}
              onMouseLeave={e => { if (filter !== f.id) { e.currentTarget.style.borderColor = "#1e1e35"; e.currentTarget.style.color = "#5a5a7a"; } }}
            >{f.label}</button>
          ))}
          {posts.length > 0 && !loading && (
            <span style={{ fontSize: 12, color: "#2a2a45", alignSelf: "center", marginLeft: "auto" }}>
              {posts.length} result{posts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* MAIN CONTENT — two-col on desktop */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* FEED */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? <Skeleton /> : posts.length === 0 ? <EmptyState filter={filter} /> : (
              posts.map((post, i) => (
                <PostCard
                  key={post.id} post={post} index={i}
                  selected={selected?.id === post.id}
                  onClick={p => setSelected(selected?.id === p.id ? null : p)}
                />
              ))
            )}
          </div>

          {/* DETAIL — desktop sidebar */}
          {showDetail && (
            <DetailPanel post={selected} onClose={() => setSelected(null)} isMobile={false} />
          )}
        </div>
      </div>

      {/* DETAIL — mobile fullscreen */}
      {showMobileDetail && (
        <DetailPanel post={selected} onClose={() => setSelected(null)} isMobile={true} />
      )}
    </div>
  );
}