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
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted"
      >
        {label}
      </label>
      {hint && <p className="mt-0.5 text-[11px] text-muted/80">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      <FieldError message={error} />
    </div>
  );
}
