import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { MessageSquare, Send, Trash2, Lock } from "lucide-react";

interface Comment {
  id: string;
  comment: string;
  authorName?: string;
  authorEmail?: string;
  isInternal: boolean;
  createdAt: string;
}

interface Props {
  entityType: string;
  entityId: string;
  showInternal?: boolean;
}

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function getInitials(name?: string) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function RecordComments({ entityType, entityId, showInternal = true }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/comments?entityType=${entityType}&entityId=${entityId}`);
      setComments(r.data.data ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post("/comments", { entityType, entityId, comment: text.trim(), isInternal });
      setText("");
      load();
    } catch { /* silent */ }
    setSending(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this comment?")) return;
    await api.delete(`/comments/${id}`);
    load();
  };

  const visible = showInternal ? comments : comments.filter(c => !c.isInternal);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <MessageSquare size={14} style={{ color: "var(--text-ghost)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-ghost)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Comments ({visible.length})
        </span>
      </div>

      {/* Comment list */}
      {loading ? (
        <p style={{ fontSize: 12, color: "var(--text-ghost)", padding: "8px 0" }}>Loading…</p>
      ) : visible.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-ghost)", padding: "8px 0" }}>No comments yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {visible.map(c => (
            <div key={c.id} style={{
              display: "flex", gap: 10, padding: "10px 12px", borderRadius: 10,
              background: c.isInternal ? "#6366f108" : "var(--bg-hover)",
              border: `1px solid ${c.isInternal ? "#6366f120" : "var(--border)"}`,
            }}>
              {/* Avatar */}
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                {getInitials(c.authorName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{c.authorName ?? "Unknown"}</span>
                  {c.isInternal && (
                    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#818cf8", background: "#6366f115", padding: "1px 6px", borderRadius: 4 }}>
                      <Lock size={9} /> Internal
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--text-ghost)", marginLeft: "auto" }}>{timeAgo(c.createdAt)}</span>
                  <button onClick={() => remove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-ghost)", padding: 2, display: "flex", alignItems: "center", borderRadius: 4 }}>
                    <Trash2 size={11} />
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-sec)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.comment}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New comment input */}
      <div style={{ border: "1px solid var(--border-input)", borderRadius: 10, background: "var(--bg-hover)", overflow: "hidden" }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
          placeholder="Add a comment… (Ctrl+Enter to send)"
          rows={2}
          style={{ width: "100%", background: "transparent", border: "none", padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", minHeight: 60 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderTop: "1px solid var(--border)" }}>
          {showInternal && (
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-ghost)", cursor: "pointer" }}>
              <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} style={{ accentColor: "#6366f1" }} />
              Internal only
            </label>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 8, border: "none", background: text.trim() ? "#6366f1" : "var(--bg-hover)", color: text.trim() ? "white" : "var(--text-ghost)", cursor: text.trim() ? "pointer" : "default", fontSize: 12, fontWeight: 600, transition: "all 0.15s" }}
          >
            <Send size={12} /> {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
