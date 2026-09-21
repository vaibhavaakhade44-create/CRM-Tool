import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  children, variant = "primary", size = "md", loading = false,
  icon, className, disabled, style, ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-[0.98]";

  const sizeMap = {
    xs: "px-2.5 py-1.5 text-xs",
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-sm",
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary:   {},
    secondary: { background: "var(--bg-hover)", color: "var(--text-sec)", border: "1px solid var(--border-input)" },
    ghost:     { background: "transparent",      color: "var(--text-muted)" },
    danger:    {},
    outline:   { background: "transparent",      color: "var(--text-sec)", border: "1px solid var(--border-input)" },
  };

  const variantClasses: Record<string, string> = {
    primary:   "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-lg shadow-brand-900/20 focus-visible:ring-brand-500",
    secondary: "hover:opacity-80 focus-visible:ring-brand-400",
    ghost:     "hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:ring-brand-400",
    danger:    "bg-red-600/15 text-red-500 hover:bg-red-600/25 border border-red-500/30 focus-visible:ring-red-500",
    outline:   "hover:bg-[var(--bg-hover)] focus-visible:ring-brand-400",
  };

  return (
    <button
      className={cn(base, variantClasses[variant], sizeMap[size], className)}
      style={{ ...variantStyles[variant], ...style }}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
