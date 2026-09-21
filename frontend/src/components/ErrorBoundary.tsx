import React from "react";

interface State { hasError: boolean; message: string; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", background: "var(--bg-main)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid #2a1a1a", borderRadius: 16, padding: "32px 40px", maxWidth: 500, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, margin: "0 0 10px" }}>Something went wrong</h2>
            <p style={{ color: "var(--text-faint)", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>{this.state.message}</p>
            <button
              onClick={() => { localStorage.clear(); window.location.href = "/login"; }}
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
            >
              Clear cache &amp; reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
