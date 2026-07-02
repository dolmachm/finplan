import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[var(--shadow-card)] ${className}`}
      {...props}
    />
  );
}
