import { ShieldOff } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

// Role hierarchy matching the backend
const ROLE_LEVEL: Record<string, number> = {
  OWNER: 6, ADMIN: 5, MANAGER: 4, ACCOUNTANT: 3, STAFF: 2, VIEWER: 1,
};

interface Props {
  /** Minimum role required — same names as MemberRole on the backend */
  minRole: "OWNER" | "ADMIN" | "MANAGER" | "ACCOUNTANT" | "STAFF" | "VIEWER";
  children: React.ReactNode;
  /** Optional custom message */
  message?: string;
}

/**
 * Renders children only if the current user's role meets the minimum.
 * Shows a clean "access denied" screen otherwise.
 * OWNER and ADMIN always pass through.
 */
export default function RoleGate({ minRole, children, message }: Props) {
  const { activeOrg } = useAuthStore();
  const role = activeOrg?.role ?? "VIEWER";

  const userLevel = ROLE_LEVEL[role] ?? 1;
  const requiredLevel = ROLE_LEVEL[minRole] ?? 1;

  if (userLevel >= requiredLevel) return <>{children}</>;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "70vh", padding: 32,
    }}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: "rgba(239,68,68,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <ShieldOff size={28} color="#ef4444" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>
          Access Restricted
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-ghost)", lineHeight: 1.6, marginBottom: 16 }}>
          {message || `This section requires ${minRole} or higher access. Your current role is `}
          {!message && <strong style={{ color: "var(--text-sec)" }}>{role}</strong>}
          {!message && "."}
        </p>
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "12px 16px", display: "inline-block",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-ghost)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Your Role
          </div>
          <div style={{
            fontSize: 15, fontWeight: 700,
            color: role === "OWNER" || role === "ADMIN" ? "#10b981" : "#818cf8",
          }}>
            {role}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-ghost)", marginTop: 16 }}>
          Contact your organisation admin to request elevated access.
        </p>
      </div>
    </div>
  );
}
