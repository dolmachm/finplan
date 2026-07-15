"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { HelpHint } from "@/components/ui/FormField";
import { toast } from "@/components/ui/ToastProvider";
import { TAB_HINTS } from "@/content/help";
import { signOut } from "next-auth/react";

const navItems = [
  { id: "home", label: "Главная" },
  { id: "assets", label: "Данные" },
  { id: "plan", label: "План" },
  { id: "export", label: "Экспорт" },
] as const;

export type DashboardTab = (typeof navItems)[number]["id"];

function NavButton({
  active,
  label,
  onClick,
  compact = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? compact
            ? "shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-medium text-white sm:px-3.5 sm:text-sm"
            : "rounded-xl bg-brand px-3 py-2.5 text-left text-sm font-medium text-white"
          : compact
            ? "shrink-0 rounded-xl px-3 py-2 text-xs text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground sm:px-3.5 sm:text-sm"
            : "rounded-xl px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
      }
    >
      {label}
    </button>
  );
}

export function DashboardShell({
  tab,
  onTabChange,
  children,
}: {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  children: React.ReactNode;
}) {
  const current = navItems.find((n) => n.id === tab);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-full flex-col">
          <div className="shrink-0 px-5 py-5">
            <BrandLogo href="/dashboard" />
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                active={tab === item.id}
                label={item.label}
                onClick={() => onTabChange(item.id)}
              />
            ))}
          </nav>
          <div className="mt-auto shrink-0 space-y-0.5 border-t border-border p-3">
            <Link
              href="/faq"
              className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-muted hover:bg-sidebar-hover hover:text-foreground"
            >
              FAQ
            </Link>
            <button
              type="button"
              onClick={() => {
                toast.success("Выход выполнен");
                signOut({ callbackUrl: "/" });
              }}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-muted hover:bg-sidebar-hover hover:text-foreground"
            >
              Выйти
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-56">
        <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between gap-3 lg:block">
            <BrandLogo href="/dashboard" className="lg:hidden" />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  toast.success("Выход выполнен");
                  signOut({ callbackUrl: "/" });
                }}
                className="text-sm text-muted hover:text-foreground lg:hidden"
              >
                Выйти
              </button>
              <div className="min-w-0 text-right lg:text-left">
                <h1 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {current?.label}
                </h1>
                <HelpHint className="hidden sm:block">{TAB_HINTS[tab]}</HelpHint>
              </div>
            </div>
          </div>
          <HelpHint className="mt-2 sm:hidden">{TAB_HINTS[tab]}</HelpHint>
        </header>

        <nav className="border-b border-border bg-card px-3 py-2 lg:hidden">
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-0.5">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                active={tab === item.id}
                label={item.label}
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
