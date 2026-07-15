import type { InputHTMLAttributes } from "react";
import { formControlClass } from "@/components/ui/form-controls";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={`${formControlClass} ${className}`.trim()} {...props} />
  );
}
