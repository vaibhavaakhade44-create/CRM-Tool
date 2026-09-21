import React from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, style, ...props }: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-[12px] font-semibold uppercase tracking-wider leading-none"
          style={{ color: "var(--text-faint)" }}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={3}
        className={cn(
          "w-full rounded-lg border px-3 py-2.5 text-sm resize-none transition-all duration-150",
          "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
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
      />
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}
