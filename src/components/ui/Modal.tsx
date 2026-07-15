"use client";

import { useEffect, type ReactNode } from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 pt-8 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]"
      >
        <div className="relative shrink-0 border-b border-border px-4 py-3.5 sm:px-6 sm:py-4">
          <h2
            id="modal-title"
            className="pr-10 text-center text-base font-semibold tracking-tight text-foreground sm:text-lg"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-lg leading-none text-muted hover:bg-brand-light hover:text-foreground"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Inner bordered form shell for modal editors */
export function ModalFormBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/80 p-3 sm:p-5 [&_input]:border-transparent [&_input]:bg-brand-light [&_select]:border-transparent [&_select]:bg-brand-light">
      {children}
    </div>
  );
}
