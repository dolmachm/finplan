import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary:
    "bg-accent text-white hover:bg-accent-hover shadow-sm disabled:opacity-60",
  secondary:
    "border border-border bg-card text-foreground hover:bg-brand-light",
  ghost: "text-muted hover:bg-brand-light hover:text-foreground",
  danger: "bg-danger text-white hover:opacity-90",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
