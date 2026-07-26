"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/ToastProvider";

export const OFFLINE_WRITE_MESSAGE =
  "Нужен интернет, чтобы сохранить изменения.";

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/** Returns false and shows a toast when offline. */
export function ensureOnlineForWrite(): boolean {
  if (isOnline()) return true;
  toast.error(OFFLINE_WRITE_MESSAGE);
  return false;
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}
