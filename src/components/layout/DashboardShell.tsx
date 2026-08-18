"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { PwaInstallButton } from "@/components/pwa/PwaInstall";
import { SupportPanel } from "@/components/support/SupportPanel";
import { HelpHint } from "@/components/ui/FormField";
import { toast } from "@/components/ui/ToastProvider";
import { TAB_HINTS } from "@/content/help";
import { apiFetchJson } from "@/shared/api-fetch";
import { useOnlineStatus } from "@/shared/offline";
import { signOut } from "next-auth/react";

const navItems = [
  { id: "home", label: "Главная", icon: "⌂" },
  { id: "assets", label: "Данные", icon: "▦" },
  { id: "plan", label: "План", icon: "◎" },
  { id: "export", label: "Экспорт", icon: "⇅" },
] as const;

export type DashboardTab = (typeof navItems)[number]["id"];

function NavButton({
  active,
  label,
  icon,
  onClick,
  compact = false,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={
          active
            ? "shrink-0 rounded-full bg-accent px-3.5 py-2 text-xs font-medium text-white sm:text-sm"
            : "shrink-0 rounded-full px-3.5 py-2 text-xs text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground sm:text-sm"
        }
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "relative flex w-full items-center gap-3 rounded-xl bg-brand-light px-3 py-2.5 text-left text-sm font-medium text-brand before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-accent"
          : "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
      }
    >
      <span className="w-5 text-center text-base opacity-80" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  );
}

function handleSignOut() {
  toast.success("Выход выполнен");
  signOut({ callbackUrl: "/" });
}

export function DashboardShell({
  tab,
  onTabChange,
  children,
  supportSubTab = null,
}: {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  children: React.ReactNode;
  /** Optional assets/plan/export sub-tab for support context */
  supportSubTab?: string | null;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const online = useOnlineStatus();
  const [supportOpen, setSupportOpen] = useState(false);
  const [demoStatus, setDemoStatus] = useState<{
    active: boolean;
    hasSandbox: boolean;
    sandboxUserId: string | null;
  } | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const current = navItems.find((n) => n.id === tab);
  const firstName =
    session?.user?.name?.trim().split(/\s+/)[0] ||
    session?.user?.email?.split("@")[0] ||
    null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiFetchJson<{
        active: boolean;
        hasSandbox: boolean;
        sandboxUserId: string | null;
      }>("/api/demo-account");
      if (cancelled || !result.ok) return;
      setDemoStatus(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleDemoMode(nextActive: boolean) {
    setDemoBusy(true);
    try {
      const result = await apiFetchJson<{ ok?: true; active?: boolean }>(
        "/api/demo-account",
        { method: nextActive ? "POST" : "DELETE" },
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        nextActive
          ? "Открыта ваша demo-копия"
          : "Возврат в основной аккаунт выполнен",
      );
      router.refresh();
      window.location.reload();
    } catch {
      toast.error(
        nextActive
          ? "Не удалось открыть тестовый аккаунт"
          : "Не удалось вернуться в основной аккаунт",
      );
    } finally {
      setDemoBusy(false);
    }
  }

  async function recreateDemo() {
    setDemoBusy(true);
    try {
      const result = await apiFetchJson<{
        active: boolean;
        hasSandbox: boolean;
        sandboxUserId: string | null;
      }>("/api/demo-account", { method: "PUT" });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Demo-копия пересоздана из шаблона");
      router.refresh();
      window.location.reload();
    } catch {
      toast.error("Не удалось пересоздать demo-копию");
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-card">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:pl-4 lg:pr-8">
          <div className="flex items-center gap-3 lg:w-56 lg:shrink-0 lg:pl-2">
            <BrandLogo href="/dashboard" />
          </div>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {firstName && (
              <p className="hidden truncate text-sm text-muted sm:block">
                Добрый день,{" "}
                <span className="font-medium text-foreground">{firstName}</span>
              </p>
            )}
            <PwaInstallButton compact className="lg:hidden" />
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-brand-light hover:text-foreground"
            >
              Поддержка
            </button>
            <button
              type="button"
              disabled={demoBusy}
              onClick={() => void toggleDemoMode(!(demoStatus?.active ?? false))}
              className="rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-brand-light hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {demoBusy
                ? "Переключение…"
                : demoStatus?.active
                  ? "Вернуться из demo"
                  : "Тестовый аккаунт"}
            </button>
            <Link
              href="/dashboard/account"
              className="rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-brand-light hover:text-foreground"
            >
              Профиль
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-brand-light hover:text-foreground"
              aria-label="Выйти"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <SupportPanel
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        dashboardTab={tab}
        subTab={supportSubTab}
      />

      <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-56 flex-col border-r border-border bg-sidebar lg:flex">
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavButton
              key={item.id}
              active={tab === item.id}
              label={item.label}
              icon={item.icon}
              onClick={() => onTabChange(item.id)}
            />
          ))}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          <PwaInstallButton />
          <Link
            href="/faq"
            className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-muted hover:bg-sidebar-hover hover:text-foreground"
          >
            FAQ
          </Link>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col pt-14 lg:pl-56">
        {!online && (
          <div
            role="status"
            className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 sm:text-sm"
          >
            Нет сети — показаны сохранённые данные. Изменения недоступны.
          </div>
        )}
        {demoStatus?.active && (
          <div
            role="status"
            className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-sky-950 sm:px-6 lg:px-8"
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
              <p className="text-xs sm:text-sm">
                Вы в demo-копии: изменения сохраняются только в вашей версии и
                не затрагивают эталонный тестовый аккаунт.
              </p>
              <button
                type="button"
                disabled={demoBusy}
                onClick={() => void recreateDemo()}
                className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
              >
                {demoBusy ? "Пересоздание…" : "Пересоздать demo-копию"}
              </button>
            </div>
          </div>
        )}
        <div className="border-b border-border bg-card px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {current?.label}
          </h1>
          <HelpHint className="mt-0.5">{TAB_HINTS[tab]}</HelpHint>
          {!demoStatus?.active && (
            <p className="mt-2 text-xs text-muted">
              Можно открыть тестовый аккаунт с уже заполненными данными и
              безопасно поэкспериментировать в своей копии.
            </p>
          )}
        </div>

        <nav className="border-b border-border bg-card px-3 py-2 lg:hidden">
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-0.5">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                active={tab === item.id}
                label={item.label}
                icon={item.icon}
                onClick={() => onTabChange(item.id)}
                compact
              />
            ))}
          </div>
        </nav>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
