"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  modalActionBtnClass,
  modalActionsClass,
} from "@/components/ui/form-controls";

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
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]"
      >
        <div className="relative shrink-0 px-4 py-3.5 sm:px-6 sm:py-4">
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
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:px-6 sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Inner bordered form shell — buttons go in ModalFormActions below */
export function ModalFormBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-5">{children}</div>
  );
}

export function ModalFormActions({
  onCancel,
  onSubmit,
  submitLabel,
  submitting = false,
  submittingLabel = "Сохранение…",
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submitting?: boolean;
  submittingLabel?: string;
}) {
  return (
    <div className={modalActionsClass}>
      <Button
        type="button"
        variant="outline"
        className={modalActionBtnClass}
        onClick={onCancel}
      >
        Отмена
      </Button>
      <Button
        type="button"
        className={modalActionBtnClass}
        onClick={onSubmit}
        disabled={submitting}
      >
        {submitting ? submittingLabel : submitLabel}
      </Button>
    </div>
  );
}
