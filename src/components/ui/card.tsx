import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-6 ${className}`}
      {...props}
    />
  );
}
