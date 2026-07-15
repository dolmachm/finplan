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
  { id: "iplan", label: "Инвест-план" },
  { id: "scenarios", label: "Сценарии" },
  { id: "export", label: "Экспорт" },
] as const;

export type DashboardTab = (typeof navItems)[number]["id"];

export function DashboardShell({
  tab,
  onTabChange,
  children,
}: {
  tab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full bg-background">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="px-5 py-5">
          <BrandLogo href="/dashboard" />
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={
                tab === item.id
                  ? "rounded-xl bg-brand px-3 py-2.5 text-left text-sm font-medium text-white"
                  : "rounded-xl px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-sidebar-hover hover:text-foreground"
              }
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="space-y-0.5 border-t border-border p-3">
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
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card px-8 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {navItems.find((n) => n.id === tab)?.label}
          </h1>
          <HelpHint>{TAB_HINTS[tab]}</HelpHint>
        </header>
        <main className="flex-1 px-8 py-7">{children}</main>
      </div>
    </div>
  );
}
