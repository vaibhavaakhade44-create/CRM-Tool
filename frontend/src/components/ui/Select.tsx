import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className, id, style, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-[12px] font-semibold uppercase tracking-wider leading-none"
          style={{ color: "var(--text-faint)" }}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "w-full h-11 appearance-none rounded-lg border pl-3 pr-9 py-2 text-sm transition-all duration-150",
            "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-red-500/60 focus:border-red-500 focus:ring-red-500/20",
            className
          )}
          style={{
            background: "var(--bg-input)",
            borderColor: error ? undefined : "var(--border-input)",
            color: "var(--text-primary)",
            ...style,
          }}
          {...props}
        >
          {placeholder && <option value="" style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: "var(--text-ghost)" }} />
      </div>
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}
