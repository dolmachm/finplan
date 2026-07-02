"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/input";
import { issuesByField } from "@/shared/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email,
          password,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Ошибка регистрации");
        if (data.issues) setFieldErrors(issuesByField(data.issues));
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!signInRes?.ok) {
        setError(
          "Аккаунт создан, но автоматический вход не удался. Перейдите на страницу входа и войдите вручную.",
        );
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Регистрация" subtitle="Создайте личный кабинет ФИНКОН">
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <Input
            placeholder="Имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FieldError message={fieldErrors.name} />
        </div>
        <div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <FieldError message={fieldErrors.email} />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Пароль (мин. 8 символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
          <FieldError message={fieldErrors.password} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Создание…" : "Создать аккаунт"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Уже есть аккаунт
        </Link>
      </p>
    </AuthShell>
  );
}
