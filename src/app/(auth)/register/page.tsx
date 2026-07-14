"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/ToastProvider";
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error ?? "Ошибка регистрации";
        const message = data.fix ? `${msg}. ${data.fix}` : msg;
        setError(message);
        toast.error(message);
        if (data.issues) setFieldErrors(issuesByField(data.issues));
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!signInRes?.ok) {
        toast.success("Аккаунт создан");
        router.push("/login?registered=1");
        return;
      }
      toast.success("Аккаунт создан");
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
    <AuthShell title="Регистрация" subtitle="Создайте личный кабинет ФИНКОН">
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormField
          label="Имя"
          hint="Необязательно — отображается в кабинете"
          htmlFor="register-name"
          error={fieldErrors.name}
        >
          <Input
            id="register-name"
            placeholder="Иван"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>
        <FormField label="Email" htmlFor="register-email" error={fieldErrors.email}>
          <Input
            id="register-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </FormField>
        <FormField
          label="Пароль"
          hint="Минимум 8 символов"
          htmlFor="register-password"
          error={fieldErrors.password}
        >
          <Input
            id="register-password"
            type="password"
            placeholder="Минимум 8 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
          />
        </FormField>
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
