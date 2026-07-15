"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/ToastProvider";

function signInErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "CredentialsSignin":
      return "Неверный email или пароль";
    case "MissingCSRF":
      return "Ошибка безопасности. Обновите страницу и попробуйте снова.";
    default:
      return code
        ? "Не удалось войти. Попробуйте ещё раз."
        : "Неверный email или пароль";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const registered = searchParams.get("registered") === "1";
  const sessionExpired = searchParams.get("session") === "expired";
  const urlError = searchParams.get("error");

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
        const message = signInErrorMessage(res?.error);
        setError(message);
        toast.error(message);
        return;
      }
      toast.success("Вход выполнен");
      router.push("/dashboard");
      router.refresh();
    } catch {
      const message = "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Вход"
      subtitle="Персональное финансовое планирование с прогнозом риска"
    >
      {registered && (
        <p className="mt-4 rounded-lg bg-brand-light px-4 py-2 text-sm text-brand">
          Аккаунт создан. Войдите с вашим email и паролем.
        </p>
      )}
      {sessionExpired && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Сессия истекла. Войдите снова.
        </p>
      )}
      {urlError && !error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-danger">
          {signInErrorMessage(urlError)}
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormField label="Email" hint="Адрес, указанный при регистрации" htmlFor="login-email">
          <Input
            id="login-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </FormField>
        <FormField label="Пароль" htmlFor="login-password">
          <Input
            id="login-password"
            type="password"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </FormField>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Вход…" : "Войти"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Регистрация
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="px-6 py-16 text-muted">Загрузка…</main>}>
      <LoginForm />
    </Suspense>
  );
}
