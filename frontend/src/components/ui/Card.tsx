import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> { children: React.ReactNode; }

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={cn("rounded-xl border", className)}
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: CardProps) {
  return (
    <div className={cn("px-5 py-4 flex items-center justify-between", className)}
      style={{ borderBottom: "1px solid var(--border)" }} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ children, className, ...props }: CardProps) {
  return (
    <div className={cn("px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}
