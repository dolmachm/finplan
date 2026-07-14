import type { ReactNode } from "react";
import { FieldError } from "@/components/ui/FormError";

export function HelpHint({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={`text-sm text-muted ${className}`.trim()}>{children}</p>;
}

export function FormField({
  label,
  hint,
  htmlFor,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      <FieldError message={error} />
    </div>
  );
}
