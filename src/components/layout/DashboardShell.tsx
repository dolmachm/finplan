"use client";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { toast } from "@/components/ui/ToastProvider";
import { signOut } from "next-auth/react";

const navItems = [
  { id: "plan", label: "План" },
  { id: "assets", label: "Данные" },
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
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-white">
        <div className="border-b border-white/10 px-5 py-5">
          <BrandLogo href="/dashboard" variant="light" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={
                tab === item.id
                  ? "rounded-lg bg-white/15 px-3 py-2.5 text-left text-sm font-medium text-white"
                  : "rounded-lg px-3 py-2.5 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
              }
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => {
              toast.success("Выход выполнен");
              signOut({ callbackUrl: "/" });
            }}
            className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            Выйти
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-card px-8 py-5">
          <h1 className="text-xl font-semibold text-foreground">
            {navItems.find((n) => n.id === tab)?.label}
          </h1>
        </header>
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
