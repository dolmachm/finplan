"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/ToastProvider";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  accountStatus: string;
  balance: number;
  createdAt: string;
};

type LogItem = {
  id: string;
  source?: "user" | "admin";
  label: string;
  meta?: string;
  action?: string;
  createdAt: string;
  detail?: unknown;
};

type FinanceBundle = {
  assets: Record<string, unknown>[];
  liabilities: Record<string, unknown>[];
  incomes: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  macro: Record<string, unknown> | null;
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активен",
  STAKING: "Стейкинг",
  LISTING: "Листинг",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  STAKING: "bg-amber-100 text-amber-800",
  LISTING: "bg-blue-100 text-blue-800",
};

const FINANCE_SECTIONS: { key: keyof FinanceBundle; kind: string; title: string }[] = [
  { key: "assets", kind: "asset", title: "Активы" },
  { key: "liabilities", kind: "liability", title: "Обязательства" },
  { key: "incomes", kind: "income", title: "Доходы" },
  { key: "expenses", kind: "expense", title: "Расходы" },
  { key: "goals", kind: "goal", title: "Цели" },
];

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      if (!res.ok) {
        setError("Неверный логин или пароль");
        toast.error("Неверный логин или пароль");
        return;
      }
      toast.success("Вход выполнен");
      onSuccess();
    } catch {
      setError("Ошибка соединения");
      toast.error("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[linear-gradient(180deg,#eff6ff_0%,var(--background)_45%)] px-6">
      <div className="mb-8">
        <BrandLogo />
      </div>
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Админ-панель</h1>
        <p className="mt-1 text-sm text-muted">ФИНКОН — управление данными пользователей</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Input
            placeholder="Логин"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            autoComplete="username"
          />
          <Input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Вход…" : "Войти"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function LogsList({ items }: { items: LogItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (items.length === 0) {
    return <p className="text-sm text-muted">Записей пока нет</p>;
  }
  return (
    <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
      {items.map((r) => (
        <li key={r.id} className="border-b border-border/50 pb-2">
          <button
            type="button"
            className="flex w-full justify-between gap-2 text-left"
            onClick={() => setOpenId(openId === r.id ? null : r.id)}
          >
            <span className="font-medium">{r.label}</span>
            <span className="shrink-0 text-xs text-muted">
              {new Date(r.createdAt).toLocaleString("ru-RU")}
            </span>
          </button>
          <p className="text-xs text-muted">
            {r.source === "admin" ? "Админ" : r.source === "user" ? "Пользователь" : "Админ"}
            {r.meta || r.action ? ` · ${r.meta ?? r.action}` : ""}
          </p>
          {openId === r.id && r.detail != null && (
            <pre className="mt-2 overflow-x-auto rounded-lg bg-brand-light p-2 text-xs">
              {JSON.stringify(r.detail, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}

function FinanceEditor({
  userId,
  onChanged,
}: {
  userId: string;
  onChanged: () => void;
}) {
  const [finance, setFinance] = useState<FinanceBundle | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ kind: string; id: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${userId}/finance`);
    if (!res.ok) return;
    const data = await res.json();
    setFinance(data.finance);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(kind: string, entity: Record<string, unknown>) {
    setEditing({ kind, id: String(entity.id) });
    setDraft(JSON.stringify(entity, null, 2));
  }

  async function save() {
    if (!editing) return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(draft);
    } catch {
      toast.error("Некорректный JSON");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/finance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: editing.kind, entityId: editing.id, data }),
      });
      if (!res.ok) throw new Error();
      toast.success("Сохранено");
      setEditing(null);
      await load();
      onChanged();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  }

  async function remove(kind: string, entityId: string) {
    if (!confirm("Удалить запись?")) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/users/${userId}/finance?kind=${kind}&entityId=${entityId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();
      toast.success("Удалено");
      await load();
      onChanged();
    } catch {
      toast.error("Ошибка удаления");
    } finally {
      setLoading(false);
    }
  }

  if (!finance) return <p className="text-sm text-muted">Загрузка данных…</p>;

  return (
    <div className="space-y-4">
      {FINANCE_SECTIONS.map((sec) => {
        const rows = (finance[sec.key] as Record<string, unknown>[]) ?? [];
        return (
          <div key={sec.key}>
            <h3 className="mb-2 text-sm font-medium">
              {sec.title} ({rows.length})
            </h3>
            {rows.length === 0 ? (
              <p className="text-xs text-muted">Пусто</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {rows.map((row) => (
                  <li
                    key={String(row.id)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <span>
                      {String(row.name ?? row.id)}
                      {"currentValue" in row || "amount" in row || "remainingBalance" in row || "targetAmountNominal" in row ? (
                        <span className="ml-2 font-mono text-xs text-muted">
                          {Number(
                            row.currentValue ??
                              row.amount ??
                              row.remainingBalance ??
                              row.targetAmountNominal ??
                              0,
                          ).toLocaleString("ru-RU")}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex gap-1">
                      <Button variant="ghost" onClick={() => startEdit(sec.kind, row)}>
                        Изменить
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={loading}
                        onClick={() => remove(sec.kind, String(row.id))}
                      >
                        Удалить
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div>
        <h3 className="mb-2 text-sm font-medium">Макропараметры</h3>
        {finance.macro ? (
          <Button
            variant="secondary"
            onClick={() => startEdit("macro", finance.macro as Record<string, unknown>)}
          >
            Редактировать макро
          </Button>
        ) : (
          <p className="text-xs text-muted">Нет настроек</p>
        )}
      </div>

      {editing && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">
            JSON: {editing.kind} · {editing.id}
          </p>
          <textarea
            className="h-56 w-full rounded-lg border border-border bg-card p-3 font-mono text-xs"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex gap-2">
            <Button disabled={loading} onClick={save}>
              Сохранить
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Отмена
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserEditor({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"profile" | "data" | "logs">("profile");
  const [form, setForm] = useState({
    email: user.email,
    name: user.name ?? "",
    role: user.role,
    balance: String(user.balance),
    baseCurrency: "RUB",
    baseInflationPct: "4",
    incomeTaxPct: "13",
    planHorizonYears: "30",
  });
  const [balanceAmount, setBalanceAmount] = useState("");
  const balanceValid = Number(balanceAmount) > 0;
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);

  useEffect(() => {
    fetch(`/api/admin/users/${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        const m = d.user?.macroSettings;
        if (!m) return;
        setForm((f) => ({
          ...f,
          baseCurrency: m.baseCurrency ?? f.baseCurrency,
          baseInflationPct: String(m.baseInflationPct ?? 4),
          incomeTaxPct: String(m.incomeTaxPct ?? 13),
          planHorizonYears: String(m.planHorizonYears ?? 30),
        }));
      })
      .catch(() => {});
  }, [user.id]);

  const loadLogs = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${user.id}/history?limit=60`);
    if (!res.ok) return;
    const data = await res.json();
    setLogs(data.items ?? []);
  }, [user.id]);

  useEffect(() => {
    if (tab === "logs") loadLogs();
  }, [tab, loadLogs]);

  async function save() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          name: form.name || null,
          role: form.role,
          balance: Number(form.balance),
          baseCurrency: form.baseCurrency,
        }),
      });
      if (!res.ok) throw new Error();
      await fetch(`/api/admin/users/${user.id}/finance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "macro",
          entityId: user.id,
          data: {
            baseCurrency: form.baseCurrency,
            baseInflationPct: Number(form.baseInflationPct),
            incomeTaxPct: Number(form.incomeTaxPct),
            planHorizonYears: Number(form.planHorizonYears),
          },
        }),
      });
      toast.success("Данные пользователя сохранены");
      onSaved();
    } catch {
      toast.error("Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Статус: ${STATUS_LABELS[status]}`);
      onSaved();
    } catch {
      toast.error("Ошибка смены статуса");
    } finally {
      setLoading(false);
    }
  }

  async function adjustBalance(operation: "add" | "subtract") {
    const amount = Number(balanceAmount);
    if (!amount || amount <= 0) {
      toast.error("Укажите сумму больше нуля");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "balance", amount, operation }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm((f) => ({ ...f, balance: String(data.user.balance) }));
      setBalanceAmount("");
      toast.success(operation === "add" ? "Начислено" : "Списано");
      onSaved();
    } catch {
      toast.error("Ошибка операции");
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: "profile" as const, label: "Профиль" },
    { id: "data" as const, label: "Данные" },
    { id: "logs" as const, label: "Логи" },
  ];

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{user.email}</h2>
        <button onClick={onClose} className="text-sm text-muted hover:text-foreground">
          ✕
        </button>
      </div>

      <div className="mt-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm ${
              tab === t.id
                ? "border-b-2 border-brand font-medium text-brand"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-muted">Email</span>
              <Input
                className="mt-1"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">Имя</span>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">Роль</span>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="USER">USER</option>
                <option value="CONSULTANT">CONSULTANT</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="text-muted">Баланс</span>
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">Валюта</span>
              <Input
                className="mt-1"
                value={form.baseCurrency}
                onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">Инфляция %</span>
              <Input
                className="mt-1"
                type="number"
                value={form.baseInflationPct}
                onChange={(e) => setForm({ ...form, baseInflationPct: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">НДФЛ %</span>
              <Input
                className="mt-1"
                type="number"
                value={form.incomeTaxPct}
                onChange={(e) => setForm({ ...form, incomeTaxPct: e.target.value })}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted">Горизонт лет</span>
              <Input
                className="mt-1"
                type="number"
                value={form.planHorizonYears}
                onChange={(e) => setForm({ ...form, planHorizonYears: e.target.value })}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={loading} onClick={() => changeStatus("STAKING")}>
              → Стейкинг
            </Button>
            <Button variant="secondary" disabled={loading} onClick={() => changeStatus("LISTING")}>
              → Листинг
            </Button>
            <Button variant="secondary" disabled={loading} onClick={() => changeStatus("ACTIVE")}>
              ← Вернуть
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="text-muted">Сумма</span>
              <Input
                className="mt-1 w-32"
                type="number"
                step="0.01"
                min="0"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
              />
            </label>
            <Button disabled={loading || !balanceValid} onClick={() => adjustBalance("add")}>
              + Начислить
            </Button>
            <Button
              variant="danger"
              disabled={loading || !balanceValid}
              onClick={() => adjustBalance("subtract")}
            >
              − Списать
            </Button>
          </div>

          <Button disabled={loading} onClick={save}>
            Сохранить профиль
          </Button>
        </div>
      )}

      {tab === "data" && <div className="mt-4"><FinanceEditor userId={user.id} onChanged={onSaved} /></div>}

      {tab === "logs" && (
        <div className="mt-4">
          <p className="mb-3 text-xs text-muted">
            История правок пользователя и действий администратора (человекочитаемые метки).
          </p>
          <LogsList items={logs} />
        </div>
      )}
    </Card>
  );
}

function JobsPanel() {
  const [data, setData] = useState<{
    queue: { pending: number; running: number; failed: number; completedToday: number };
    recent: { id: string; userId: string; status: string; errorMessage: string | null; createdAt: string }[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/jobs")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return <p className="text-sm text-muted">Очередь симуляций…</p>;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-3">
        <span>Ожидают: {data.queue.pending}</span>
        <span>Бегут: {data.queue.running}</span>
        <span>Ошибки: {data.queue.failed}</span>
        <span>Готово сегодня: {data.queue.completedToday}</span>
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {data.recent.slice(0, 15).map((j) => (
          <li key={j.id} className="text-xs text-muted">
            {j.status} · {j.userId.slice(0, 8)}… ·{" "}
            {new Date(j.createdAt).toLocaleString("ru-RU")}
            {j.errorMessage ? ` — ${j.errorMessage}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"users" | "logs" | "jobs">("users");
  const [globalLogs, setGlobalLogs] = useState<LogItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.users);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (view !== "logs") return;
    fetch("/api/admin/logs?limit=80")
      .then((r) => r.json())
      .then((d) => setGlobalLogs(d.items ?? []))
      .catch(() => setGlobalLogs([]));
  }, [view]);

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    toast.success("Выход выполнен");
    window.location.reload();
  }

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <BrandLogo />
            <span className="text-sm font-medium text-muted">Админ</span>
          </div>
          <Button variant="ghost" onClick={logout}>
            Выйти
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex gap-1 border-b border-border">
          {(
            [
              { id: "users" as const, label: "Пользователи" },
              { id: "logs" as const, label: "Журнал" },
              { id: "jobs" as const, label: "Очередь" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={`px-3 py-2 text-sm ${
                view === t.id
                  ? "border-b-2 border-brand font-medium text-brand"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {view === "logs" && (
          <Card>
            <h1 className="mb-3 text-lg font-semibold">Журнал админ-действий</h1>
            <LogsList items={globalLogs} />
          </Card>
        )}

        {view === "jobs" && (
          <Card>
            <h1 className="mb-3 text-lg font-semibold">Очередь симуляций</h1>
            <JobsPanel />
          </Card>
        )}

        {view === "users" && (
          <>
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-xl font-semibold">Пользователи ({users.length})</h1>
              <Input
                className="max-w-xs"
                placeholder="Поиск…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <p className="mt-8 text-muted">Загрузка…</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Имя</th>
                      <th className="px-4 py-3 font-medium">Статус</th>
                      <th className="px-4 py-3 font-medium">Баланс</th>
                      <th className="px-4 py-3 font-medium">Роль</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">{u.email}</td>
                        <td className="px-4 py-3 text-muted">{u.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[u.accountStatus] ?? ""}`}
                          >
                            {STATUS_LABELS[u.accountStatus] ?? u.accountStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {u.balance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-muted">{u.role}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            onClick={() => setSelected(selected?.id === u.id ? null : u)}
                          >
                            {selected?.id === u.id ? "Скрыть" : "Открыть"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted">
                          Нет пользователей
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {selected && (
              <UserEditor
                user={users.find((u) => u.id === selected.id) ?? selected}
                onClose={() => setSelected(null)}
                onSaved={load}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/admin/users", { method: "HEAD" })
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted">Загрузка…</main>
    );
  }

  if (!authed) {
    return <LoginForm onSuccess={() => setAuthed(true)} />;
  }

  return <AdminPanel />;
}
