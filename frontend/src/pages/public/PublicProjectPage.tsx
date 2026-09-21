import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API = (import.meta.env.VITE_API_URL as string) || "http://localhost:5000/api";

const STATUS_COLOR: Record<string, string> = {
  PLANNING:  "#6366f1",
  ACTIVE:    "#22c55e",
  ON_HOLD:   "#f59e0b",
  COMPLETED: "#3b82f6",
  CANCELLED: "#ef4444",
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#6b7280", MEDIUM: "#f59e0b", HIGH: "#f97316", URGENT: "#ef4444",
};
const TYPE_LABEL: Record<string, string> = {
  WEB_APP: "Web App", MOBILE_APP: "Mobile App", API_SERVICE: "API / Service",
  DESKTOP_APP: "Desktop App", DATA_ANALYTICS: "Data & Analytics",
  AI_ML: "AI / ML", DEVOPS_INFRA: "DevOps & Infra", ECOMMERCE: "E-Commerce",
  ERP_CRM: "ERP / CRM", CONSULTING: "Consulting", OTHER: "Other",
};
const ROLE_LABEL: Record<string, string> = {
  PROJECT_MANAGER: "Project Manager", PROJECT_INCHARGE: "Project Incharge",
  TECH_LEAD: "Tech Lead", DEVELOPER: "Developer", QA: "QA Engineer",
  DEVOPS: "DevOps", DESIGNER: "Designer", CONSULTANT: "Consultant",
};
const TASK_STATUS_COLOR: Record<string, string> = {
  TODO: "#6b7280", IN_PROGRESS: "#6366f1", IN_REVIEW: "#f59e0b", DONE: "#22c55e",
};

interface Milestone { id: string; title: string; dueDate: string; completedAt: string | null; description: string | null; }
interface Member { role: string; employee: { name: string; designation: string; department: string; } }
interface Sprint { id: string; name: string; status: string; startDate: string; endDate: string; goal: string | null; }
interface Task { id: string; title: string; status: string; priority: string; storyPoints: number | null; }
interface SprintBoard { sprint: Sprint; board: Record<string, Task[]>; velocity: { totalPoints: number; donePoints: number; pct: number }; }
interface ProjectData {
  name: string; description: string | null; status: string; projectType: string; priority: string;
  clientName: string | null; startDate: string | null; endDate: string | null;
  budget: number | null; totalEstHours: number | null; techStack: string[];
  repoUrl: string | null; liveUrl: string | null;
  members: Member[]; milestones: Milestone[]; sprints: Sprint[];
  taskProgress: { total: number; done: number; inProgress: number; pct: number };
  sprintBoard: SprintBoard | null;
  sharedAt: string | null;
}

function Bar({ pct, color = "#6366f1" }: { pct: number; color?: string }) {
  return (
    <div style={{ height: 8, background: "#1e1e3a", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 8, transition: "width .6s ease" }} />
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: ".04em", background: color + "22", color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

export default function PublicProjectPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ProjectData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/public/project/${token}`)
      .then(r => r.json())
      .then(r => {
        if (r.success) setData(r.data);
        else setError(r.message ?? "Project not found.");
      })
      .catch(() => setError("Could not load project. Please try again."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a18" }}>
      <div style={{ color: "#6366f1", fontSize: 16 }}>Loading project status…</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a18", gap: 12 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ color: "#f87171", fontSize: 18, fontWeight: 600 }}>{error}</div>
      <div style={{ color: "#6b7280", fontSize: 13 }}>This link may have been revoked or doesn't exist.</div>
    </div>
  );

  if (!data) return null;

  const { taskProgress, sprintBoard, milestones, members, sprints } = data;
  const completedMilestones = milestones.filter(m => m.completedAt).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a18", color: "#e2e2f0", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1a1a3e,#0f0f2e)", borderBottom: "1px solid #1e1e3a", padding: "0 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 0 24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Badge label={data.status} color={STATUS_COLOR[data.status] ?? "#6366f1"} />
                <Badge label={data.priority} color={PRIORITY_COLOR[data.priority] ?? "#f59e0b"} />
                <Badge label={TYPE_LABEL[data.projectType] ?? data.projectType} color="#6366f1" />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.2 }}>{data.name}</h1>
              {data.clientName && <p style={{ margin: "6px 0 0", color: "#7070a0", fontSize: 13 }}>Client: <span style={{ color: "#a5a5c9" }}>{data.clientName}</span></p>}
              {data.description && <p style={{ margin: "8px 0 0", color: "#9090b8", fontSize: 13, maxWidth: 560, lineHeight: 1.6 }}>{data.description}</p>}
            </div>
            <div style={{ textAlign: "right" }}>
              {data.startDate && (
                <div style={{ fontSize: 12, color: "#7070a0" }}>
                  {new Date(data.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  {" → "}
                  {data.endDate ? new Date(data.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "TBD"}
                </div>
              )}
              {data.totalEstHours && <div style={{ fontSize: 12, color: "#7070a0", marginTop: 4 }}>Est. {data.totalEstHours}h</div>}
            </div>
          </div>

          {/* Overall progress bar */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#7070a0" }}>Overall completion</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>{taskProgress.pct}%</span>
            </div>
            <Bar pct={taskProgress.pct} color="#22c55e" />
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {[
                { label: "Total tasks",   val: taskProgress.total,      color: "#7070a0" },
                { label: "In progress",   val: taskProgress.inProgress, color: "#6366f1" },
                { label: "Completed",     val: taskProgress.done,       color: "#22c55e" },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ fontSize: 11, color }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{val}</span>{" "}{label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 48px" }}>
        <div className="grid-r2" style={{ gap: 20 }}>

          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Tech stack */}
            {data.techStack.length > 0 && (
              <Card title="Tech Stack">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {data.techStack.map(t => (
                    <span key={t} style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, background: "#1e1e3a", color: "#a5b4fc", border: "1px solid #2e2e5a" }}>{t}</span>
                  ))}
                </div>
              </Card>
            )}

            {/* Milestones */}
            {milestones.length > 0 && (
              <Card title={`Milestones (${completedMilestones}/${milestones.length})`}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {milestones.map(m => {
                    const done = !!m.completedAt;
                    const overdue = !done && new Date(m.dueDate) < new Date();
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: done ? "#22c55e22" : "#1e1e3a", border: `2px solid ${done ? "#22c55e" : overdue ? "#ef4444" : "#3e3e6a"}`, color: done ? "#22c55e" : overdue ? "#ef4444" : "#6b7280" }}>
                          {done ? "✓" : ""}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: done ? "#6b7280" : "#e2e2f0", textDecoration: done ? "line-through" : "none" }}>{m.title}</div>
                          <div style={{ fontSize: 11, color: overdue ? "#ef4444" : "#6b7280", marginTop: 2 }}>
                            {done ? `Completed ${new Date(m.completedAt!).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : `Due ${new Date(m.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}${overdue ? " · Overdue" : ""}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 12 }}>
                  <Bar pct={milestones.length ? (completedMilestones / milestones.length) * 100 : 0} color="#6366f1" />
                </div>
              </Card>
            )}

            {/* Team */}
            {members.length > 0 && (
              <Card title="Team">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {members.map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                        {m.employee.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e2f0" }}>{m.employee.name}</div>
                        <div style={{ fontSize: 11, color: "#7070a0" }}>{m.employee.designation} · <span style={{ color: "#6366f1" }}>{ROLE_LABEL[m.role] ?? m.role}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Active sprint */}
            {sprintBoard && (
              <Card title={`Sprint: ${sprintBoard.sprint.name}`}>
                <div style={{ fontSize: 11, color: "#7070a0", marginBottom: 8 }}>
                  {new Date(sprintBoard.sprint.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  {" → "}
                  {new Date(sprintBoard.sprint.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
                {sprintBoard.sprint.goal && (
                  <div style={{ fontSize: 12, color: "#9090b8", marginBottom: 12, fontStyle: "italic" }}>"{sprintBoard.sprint.goal}"</div>
                )}

                {/* Velocity */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#7070a0" }}>Sprint velocity</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc" }}>{sprintBoard.velocity.donePoints}/{sprintBoard.velocity.totalPoints} pts ({sprintBoard.velocity.pct}%)</span>
                  </div>
                  <Bar pct={sprintBoard.velocity.pct} color="#a5b4fc" />
                </div>

                {/* Task columns */}
                {(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const).map(col => {
                  const tasks = sprintBoard.board[col] ?? [];
                  if (!tasks.length) return null;
                  return (
                    <div key={col} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: TASK_STATUS_COLOR[col] }} />
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: "#7070a0", textTransform: "uppercase" }}>{col.replace("_", " ")} ({tasks.length})</span>
                      </div>
                      {tasks.map(t => (
                        <div key={t.id} style={{ padding: "6px 8px", borderRadius: 6, background: "#13132a", border: "1px solid #1e1e3a", marginBottom: 4 }}>
                          <div style={{ fontSize: 12, color: "#c4c4e0" }}>{t.title}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 10, color: PRIORITY_COLOR[t.priority] ?? "#7070a0" }}>{t.priority}</span>
                            {t.storyPoints != null && <span style={{ fontSize: 10, color: "#6366f1" }}>{t.storyPoints}pts</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </Card>
            )}

            {/* Sprint history */}
            {sprints.length > 1 && (
              <Card title="Sprint History">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sprints.map(s => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1a1a30" }}>
                      <div style={{ fontSize: 12, color: "#c4c4e0" }}>{s.name}</div>
                      <Badge label={s.status} color={s.status === "COMPLETED" ? "#22c55e" : s.status === "ACTIVE" ? "#6366f1" : "#6b7280"} />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Links */}
            {(data.repoUrl || data.liveUrl) && (
              <Card title="Links">
                {data.repoUrl && (
                  <a href={data.repoUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#13132a", border: "1px solid #1e1e3a", color: "#a5b4fc", textDecoration: "none", fontSize: 12, marginBottom: 6 }}>
                    <span>🔗</span> Repository
                  </a>
                )}
                {data.liveUrl && (
                  <a href={data.liveUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "#13132a", border: "1px solid #1e1e3a", color: "#22c55e", textDecoration: "none", fontSize: 12 }}>
                    <span>🌐</span> Live URL
                  </a>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "16px 24px 32px", borderTop: "1px solid #1a1a30" }}>
        <span style={{ fontSize: 11, color: "#3e3e6a" }}>
          Powered by{" "}
          <span style={{ color: "#6366f1", fontWeight: 700 }}>BusinessOS</span>
          {data.sharedAt && ` · Shared ${new Date(data.sharedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
        </span>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#0f0f22", border: "1px solid #1e1e3a", borderRadius: 12, padding: "16px 18px" }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "#7070a0" }}>{title}</h3>
      {children}
    </div>
  );
}
