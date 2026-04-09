import { useEffect, useState, useCallback, CSSProperties } from "react";
import axios, { AxiosError } from "axios";

// ── Types ─────────────────────────────────────────────────────────
interface Moderation {
  verdict:          "abusive" | "borderline" | "safe" | null;
  score:            number | null;
  detectedLanguage: string | null;
  reason:           string | null;
  action:           "deleted" | "hidden" | null;
  moderatedAt:      string | null;
}

interface ModeratedComment {
  _id:        string;
  username:   string;
  senderId:   string;
  message:    string;
  mediaId:    string;
  commentId:  string;
  Timestamp:  string;
  createdAt:  string;
  moderation: Moderation;
}

type FilterType = "all" | "deleted" | "hidden";
type BadgeType  = "deleted" | "hidden" | "abusive" | "borderline" | "lang";
type StatColor  = "red" | "amber" | "blue" | "teal";

// ── helpers ───────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

// ── ScoreBar ──────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const pct   = Math.round(score * 100);
  const color = score >= 0.85 ? "#E24B4A" : score >= 0.6 ? "#BA7517" : "#639922";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: "#e5e7eb", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: 4, width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: "#6b7280", minWidth: 28, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────
const BADGE_STYLES: Record<BadgeType, CSSProperties> = {
  deleted:    { background: "#FCEBEB", color: "#791F1F" },
  hidden:     { background: "#FAEEDA", color: "#633806" },
  abusive:    { background: "#F7C1C1", color: "#501313" },
  borderline: { background: "#FAC775", color: "#412402" },
  lang:       { background: "#f3f4f6", color: "#374151", border: "0.5px solid #e5e7eb" },
};

function Badge({ type, value }: { type: string | null | undefined; value: string }) {
  const s = (type && BADGE_STYLES[type as BadgeType]) || BADGE_STYLES.lang;
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 8px",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 500,
      whiteSpace: "nowrap",
      ...s,
    }}>
      {value}
    </span>
  );
}

// ── StatCard ──────────────────────────────────────────────────────
const COLOR_MAP: Record<StatColor, string> = {
  red:   "#A32D2D",
  amber: "#854F0B",
  blue:  "#185FA5",
  teal:  "#0F6E56",
};

function StatCard({ label, value, color }: { label: string; value: string | number; color: StatColor }) {
  return (
    <div style={{
      background: "#f9fafb",
      borderRadius: 10,
      padding: "12px 14px",
      flex: "1 1 0",
      minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: COLOR_MAP[color] }}>{value}</div>
    </div>
  );
}

// ── CommentCard (mobile-friendly card) ───────────────────────────
function CommentCard({ c }: { c: ModeratedComment }) {
  return (
    <div style={{
      background: "#fff",
      border: "0.5px solid #e5e7eb",
      borderRadius: 12,
      padding: "14px 14px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {/* top row: user + date */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>@{c.username || "unknown"}</div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, wordBreak: "break-all" }}>{c.senderId}</div>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", flexShrink: 0, marginTop: 2 }}>
          {formatDate(c.moderation?.moderatedAt)}
        </div>
      </div>

      {/* comment text */}
      <div style={{
        fontSize: 13,
        color: "#111827",
        lineHeight: 1.55,
        wordBreak: "break-word",
        background: "#f9fafb",
        borderRadius: 8,
        padding: "10px 12px",
        borderLeft: "3px solid #e5e7eb",
      }}>
        {c.message}
      </div>

      {/* reason */}
      {c.moderation?.reason && (
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>
          {c.moderation.reason}
        </div>
      )}

      {/* badges + score row */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <Badge type={c.moderation?.verdict} value={c.moderation?.verdict || "—"} />
        <Badge type={c.moderation?.action}  value={c.moderation?.action  || "—"} />
        <Badge type="lang" value={c.moderation?.detectedLanguage || "—"} />
        <div style={{ flex: 1, minWidth: 80 }}>
          {c.moderation?.score != null
            ? <ScoreBar score={c.moderation.score} />
            : <span style={{ fontSize: 12, color: "#9ca3af" }}>No score</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function ModerationCommentsList() {
  const tenentId = localStorage.getItem("tenentid") ?? "";

  const [comments, setComments] = useState<ModeratedComment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<FilterType>("all");
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const PER_PAGE = 20;

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { tenentId };
      if (filter !== "all") params.action = filter;
      const { data } = await axios.get<{ comments: ModeratedComment[] }>(
        "/api/commentmoderationroute/moderated",
        { params }
      );
      setComments(data.comments || []);
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      setError(axiosErr.response?.data?.message || axiosErr.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [tenentId, filter]);

  useEffect(() => { fetchComments(); }, [fetchComments]);
  useEffect(() => { setPage(1); }, [filter, search]);

  const filtered = comments.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.username?.toLowerCase().includes(q) ||
      c.message?.toLowerCase().includes(q)
    );
  });

  const totalPages   = Math.ceil(filtered.length / PER_PAGE);
  const paged        = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const deletedCount = comments.filter(c => c.moderation?.action === "deleted").length;
  const hiddenCount  = comments.filter(c => c.moderation?.action === "hidden").length;
  const avgScore     = comments.length
    ? Math.round(comments.reduce((a, c) => a + (c.moderation?.score || 0), 0) / comments.length * 100)
    : 0;

  function filterBtnStyle(f: FilterType): CSSProperties {
    const active = filter === f;
    const base: CSSProperties = {
      height: 34, padding: "0 12px",
      border: "0.5px solid #d1d5db", borderRadius: 8,
      cursor: "pointer", fontSize: 13, fontWeight: active ? 500 : 400,
      flexShrink: 0,
    };
    if (active) {
      if (f === "deleted") return { ...base, background: "#FCEBEB", borderColor: "#F09595", color: "#791F1F" };
      if (f === "hidden")  return { ...base, background: "#FAEEDA", borderColor: "#EF9F27", color: "#633806" };
      return { ...base, background: "#f3f4f6", borderColor: "#9ca3af", color: "#111827" };
    }
    return { ...base, background: "#fff", color: "#6b7280" };
  }

  return (
    <div style={{ padding: "1.25rem 1rem 5rem", fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "0 auto" }}>

      {/* header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: 0 }}>Moderated comments</h1>
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          Comments automatically deleted or hidden by AI moderation
        </p>
      </div>

      {/* stat cards — 2×2 grid on narrow, 4-col on wide */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 8,
        marginBottom: "1.25rem",
      }}>
        <StatCard label="Total moderated" value={comments.length} color="blue"  />
        <StatCard label="Deleted"          value={deletedCount}    color="red"   />
        <StatCard label="Hidden"           value={hiddenCount}     color="amber" />
        <StatCard label="Avg toxicity"     value={`${avgScore}%`}  color="teal"  />
      </div>

      {/* search */}
      <input
        type="text"
        placeholder="Search by username or comment…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", height: 40,
          padding: "0 12px", border: "0.5px solid #d1d5db",
          borderRadius: 10, fontSize: 13, boxSizing: "border-box",
          marginBottom: 10,
          outline: "none",
        }}
      />

      {/* filter + refresh row */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", overflowX: "auto", paddingBottom: 2 }}>
        {(["all", "deleted", "hidden"] as FilterType[]).map(f => (
          <button key={f} style={filterBtnStyle(f)} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "deleted" && ` (${deletedCount})`}
            {f === "hidden"  && ` (${hiddenCount})`}
          </button>
        ))}
        <button
          onClick={fetchComments}
          style={{
            height: 34, padding: "0 12px",
            border: "0.5px solid #d1d5db", borderRadius: 8,
            fontSize: 13, cursor: "pointer", background: "#fff", color: "#374151",
            marginLeft: "auto", flexShrink: 0,
          }}
        >
          Refresh
        </button>
      </div>

      {/* content */}
      {loading ? (
        <div style={{ padding: "3rem 0", textAlign: "center", color: "#6b7280", fontSize: 14 }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: "2rem 0", textAlign: "center", color: "#A32D2D", fontSize: 14 }}>Error: {error}</div>
      ) : paged.length === 0 ? (
        <div style={{ padding: "3rem 0", textAlign: "center", color: "#6b7280", fontSize: 14 }}>
          No comments match the current filter.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {paged.map(c => <CommentCard key={c._id} c={c} />)}
        </div>
      )}

      {/* pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: "1rem", gap: 8,
        }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            Page {page} / {totalPages} &nbsp;·&nbsp; {filtered.length} results
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{
                height: 34, padding: "0 14px",
                border: "0.5px solid #d1d5db", borderRadius: 8,
                cursor: page === 1 ? "default" : "pointer",
                fontSize: 13, background: "#fff",
                color: page === 1 ? "#9ca3af" : "#374151",
              }}
            >← Prev</button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{
                height: 34, padding: "0 14px",
                border: "0.5px solid #d1d5db", borderRadius: 8,
                cursor: page === totalPages ? "default" : "pointer",
                fontSize: 13, background: "#fff",
                color: page === totalPages ? "#9ca3af" : "#374151",
              }}
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
