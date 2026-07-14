"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type Listener = (toast: Omit<ToastItem, "id">) => void;

const listeners = new Set<Listener>();
let nextId = 0;

function emit(message: string, type: ToastType) {
  for (const listener of listeners) {
    listener({ message, type });
  }
}

export const toast = {
  success: (message: string) => emit(message, "success"),
  error: (message: string) => emit(message, "error"),
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = ({ message, type }) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
              t.type === "success"
                ? "bg-success text-white"
                : "bg-danger text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
