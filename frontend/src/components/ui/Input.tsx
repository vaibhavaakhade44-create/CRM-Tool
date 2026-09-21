import React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({ label, error, hint, leftIcon, rightIcon, className, id, style, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[12px] font-semibold uppercase tracking-wider leading-none"
          style={{ color: "var(--text-faint)" }}>
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-ghost)" }}>
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={cn(
            "w-full h-11 rounded-lg border px-3 py-2 text-sm transition-all duration-150",
            "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-red-500/60 hover:border-red-500/80 focus:border-red-500 focus:ring-red-500/20",
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            className
          )}
          style={{
            background: "var(--bg-input)",
            borderColor: error ? undefined : "var(--border-input)",
            color: "var(--text-primary)",
            ...style,
          }}
          placeholder={props.placeholder}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-ghost)" }}>
            {rightIcon}
          </span>
        )}
      </div>
      {error && <p className="text-[12px] text-red-500">{error}</p>}
      {hint && !error && <p className="text-[12px]" style={{ color: "var(--text-ghost)" }}>{hint}</p>}
    </div>
  );
}
