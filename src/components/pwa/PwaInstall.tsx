"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pwa-banner-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaInstallContextValue = {
  canInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  install: () => Promise<void>;
  showIosHint: boolean;
  dismissIosHint: () => void;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error("usePwaInstall must be used within PwaInstallProvider");
  }
  return ctx;
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandaloneDisplay());
    setIsIos(isIosDevice());
    setIsMobile(isMobileViewport());
    try {
      setBannerDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setBannerDismissed(false);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(max-width: 1023px)");
    const onMq = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onMq);

    let updateTimer: ReturnType<typeof setInterval> | undefined;
    let onControllerChange: (() => void) | undefined;
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator &&
      window.isSecureContext
    ) {
      // Reload only when an updated worker replaces an existing controller.
      if (navigator.serviceWorker.controller) {
        onControllerChange = () => {
          window.location.reload();
        };
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          onControllerChange,
        );
      }

      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          void registration.update();
          updateTimer = setInterval(() => {
            void registration.update();
          }, 60 * 60 * 1000);
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener("change", onMq);
      if (onControllerChange) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
      }
      if (updateTimer) clearInterval(updateTimer);
    };
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") {
        setDeferred(null);
        setIsInstalled(true);
      }
      return;
    }
    if (isIosDevice() && !isStandaloneDisplay()) {
      setShowIosHint(true);
    }
  }, [deferred]);

  const dismissIosHint = useCallback(() => setShowIosHint(false), []);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const canInstall = Boolean(deferred) || (isIos && !isInstalled);
  const showBanner =
    !isInstalled && !bannerDismissed && isMobile && canInstall;

  const value: PwaInstallContextValue = {
    canInstall,
    isInstalled,
    isIos,
    install,
    showIosHint,
    dismissIosHint,
  };

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-4 shadow-[0_-4px_20px_rgba(26,59,93,0.08)] lg:hidden">
          <p className="text-sm font-medium text-foreground">
            Установите ФИНКОН на устройство
          </p>
          <p className="mt-1 text-xs text-muted">
            {isIos && !deferred
              ? "Нажмите «Поделиться», затем «На экран „Домой“»."
              : "Быстрый доступ с домашнего экрана без магазина приложений."}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                void install();
                if (deferred) dismissBanner();
              }}
            >
              Установить
            </Button>
            <Button type="button" variant="ghost" onClick={dismissBanner}>
              Позже
            </Button>
          </div>
        </div>
      )}
      {showIosHint && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-pwa-title"
          onClick={dismissIosHint}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="ios-pwa-title"
              className="text-base font-semibold text-foreground"
            >
              Установка на iPhone / iPad
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
              <li>Нажмите кнопку «Поделиться» в Safari</li>
              <li>Выберите «На экран „Домой“»</li>
              <li>Подтвердите «Добавить»</li>
            </ol>
            <Button
              type="button"
              className="mt-4 w-full"
              onClick={dismissIosHint}
            >
              Понятно
            </Button>
          </div>
        </div>
      )}
    </PwaInstallContext.Provider>
  );
}

export function PwaInstallButton({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { canInstall, isInstalled, install } = usePwaInstall();

  if (isInstalled || !canInstall) return null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-brand-light hover:text-foreground ${className}`}
        aria-label="Установить приложение"
      >
        Установить
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm text-muted hover:bg-sidebar-hover hover:text-foreground ${className}`}
    >
      Установить приложение
    </button>
  );
}
