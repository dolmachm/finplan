"use client";

import { useState } from "react";

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30 sm:px-4"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <span className="shrink-0 text-xs text-muted" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
          {children}
        </div>
      )}
    </section>
  );
}
