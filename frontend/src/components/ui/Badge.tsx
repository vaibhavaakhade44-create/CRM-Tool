import { cn } from "@/lib/utils";

type BadgeVariant = "blue" | "green" | "yellow" | "red" | "purple" | "orange" | "slate";

const styles: Record<BadgeVariant, string> = {
  blue:   "text-[#2E9CC4]",
  green:  "text-[#22C55E]",
  yellow: "text-[#FCD34D]",
  red:    "text-[#F87171]",
  purple: "text-[#C084FC]",
  orange: "text-[#FBBF24]",
  slate:  "text-[var(--text-muted)]",
};

const bgs: Record<BadgeVariant, string> = {
  blue:   "rgba(116,205,232,0.16)",
  green:  "rgba(34,197,94,0.10)",
  yellow: "rgba(245,158,11,0.1)",
  red:    "rgba(239,68,68,0.1)",
  purple: "rgba(139,92,246,0.12)",
  orange: "rgba(245,158,11,0.1)",
  slate:  "rgba(144,144,176,0.1)",
};

const borders: Record<BadgeVariant, string> = {
  blue:   "rgba(116,205,232,0.35)",
  green:  "rgba(34,197,94,0.22)",
  yellow: "rgba(245,158,11,0.2)",
  red:    "rgba(239,68,68,0.2)",
  purple: "rgba(139,92,246,0.25)",
  orange: "rgba(245,158,11,0.2)",
  slate:  "rgba(144,144,176,0.15)",
};

interface BadgeProps { label: string; variant?: BadgeVariant; className?: string; }

export function Badge({ label, variant = "slate", className }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", styles[variant], className)}
      style={{ background: bgs[variant], border: `1px solid ${borders[variant]}` }}
    >
      {label}
    </span>
  );
}
