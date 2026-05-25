"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const registered = searchParams.get("registered") === "1";
  const sessionExpired = searchParams.get("session") === "expired";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res?.ok) {
        setError("Неверный email или пароль");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900">Вход в FinPlan</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Персональное финансовое планирование с Monte Carlo
      </p>
      {registered && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          Аккаунт создан. Войдите с вашим email и паролем.
        </p>
      )}
      {sessionExpired && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Сессия истекла. Войдите снова.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-4 py-2"
          required
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-4 py-2"
          required
          autoComplete="current-password"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-700 py-2.5 text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {loading ? "Вход…" : "Войти"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-600">
        Нет аккаунта?{" "}
        <Link href="/register" className="text-emerald-700 underline">
          Регистрация
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="px-6 py-16 text-zinc-500">Загрузка…</main>}>
      <LoginForm />
    </Suspense>
  );
}
