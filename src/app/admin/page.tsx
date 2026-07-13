"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  accountStatus: string;
  balance: number;
  createdAt: string;
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
        return;
      }
      onSuccess();
    } catch {
      setError("Ошибка соединения");
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
        <p className="mt-1 text-sm text-muted">Управление пользователями</p>
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

function UserEditor({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    email: user.email,
    name: user.name ?? "",
    role: user.role,
    balance: String(user.balance),
    baseCurrency: "RUB",
  });
  const [balanceAmount, setBalanceAmount] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${user.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.macroSettings?.baseCurrency) {
          setForm((f) => ({ ...f, baseCurrency: d.user.macroSettings.baseCurrency }));
        }
      })
      .catch(() => {});
  }, [user.id]);

  async function save() {
    setLoading(true);
    setMsg("");
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
      setMsg("Сохранено");
      onSaved();
    } catch {
      setMsg("Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(status: string) {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", status }),
      });
      if (!res.ok) throw new Error();
      setMsg(`Статус: ${STATUS_LABELS[status]}`);
      onSaved();
    } catch {
      setMsg("Ошибка смены статуса");
    } finally {
      setLoading(false);
    }
  }

  async function adjustBalance(operation: "add" | "subtract") {
    const amount = Number(balanceAmount);
    if (!amount || amount <= 0) return;
    setLoading(true);
    setMsg("");
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
      setMsg(operation === "add" ? "Начислено" : "Списано");
      onSaved();
    } catch {
      setMsg("Ошибка операции");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{user.email}</h2>
        <button onClick={onClose} className="text-sm text-muted hover:text-foreground">
          ✕
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          <span className="text-muted">Базовая валюта</span>
          <Input
            className="mt-1"
            value={form.baseCurrency}
            onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
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

      <div className="mt-4 flex flex-wrap items-end gap-2">
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
        <Button disabled={loading} onClick={() => adjustBalance("add")}>
          + Начислить
        </Button>
        <Button variant="danger" disabled={loading} onClick={() => adjustBalance("subtract")}>
          − Списать
        </Button>
      </div>

      <div className="mt-4 flex gap-2">
        <Button disabled={loading} onClick={save}>
          Сохранить
        </Button>
        {msg && <span className="self-center text-sm text-muted">{msg}</span>}
      </div>
    </Card>
  );
}

function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
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
                        {selected?.id === u.id ? "Скрыть" : "Изменить"}
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
    return <main className="flex min-h-screen items-center justify-center text-muted">Загрузка…</main>;
  }

  if (!authed) {
    return <LoginForm onSuccess={() => setAuthed(true)} />;
  }

  return <AdminPanel />;
}
