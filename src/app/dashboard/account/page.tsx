"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/ToastProvider";
import { issuesByField, type ValidationIssue } from "@/shared/api-client";
import { apiFetchJson } from "@/shared/api-fetch";
import { signOut } from "next-auth/react";

type AccountProfile = {
  id: string;
  email: string;
  name: string | null;
};

export default function AccountPage() {
  const { update } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileFieldErrors, setProfileFieldErrors] = useState<
    Record<string, string>
  >({});
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<
    Record<string, string>
  >({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await apiFetchJson<AccountProfile>("/api/account");
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.message);
        setLoading(false);
        return;
      }
      setName(result.data.name ?? "");
      setEmail(result.data.email);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileFieldErrors({});
    setSavingProfile(true);
    try {
      const result = await apiFetchJson<AccountProfile>("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim(),
        }),
      });
      if (!result.ok) {
        setProfileError(result.message);
        toast.error(result.message);
        if (result.issues) {
          setProfileFieldErrors(
            issuesByField(result.issues as ValidationIssue[]),
          );
        }
        return;
      }
      setName(result.data.name ?? "");
      setEmail(result.data.email);
      await update({ name: result.data.name, email: result.data.email });
      toast.success("Профиль сохранён");
    } catch {
      const message = "Не удалось сохранить профиль";
      setProfileError(message);
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordFieldErrors({});

    if (newPassword !== confirmPassword) {
      const message = "Пароли не совпадают";
      setPasswordFieldErrors({ confirmPassword: message });
      setPasswordError(message);
      toast.error(message);
      return;
    }

    setSavingPassword(true);
    try {
      const result = await apiFetchJson<{ ok: true }>("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      if (!result.ok) {
        setPasswordError(result.message);
        toast.error(result.message);
        if (result.issues) {
          setPasswordFieldErrors(
            issuesByField(result.issues as ValidationIssue[]),
          );
        }
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Пароль изменён");
    } catch {
      const message = "Не удалось сменить пароль";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-card">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <BrandLogo href="/dashboard" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-brand-light hover:text-foreground"
            >
              Кабинет
            </Link>
            <button
              type="button"
              onClick={() => {
                toast.success("Выход выполнен");
                signOut({ callbackUrl: "/" });
              }}
              className="rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-brand-light hover:text-foreground"
              aria-label="Выйти"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-10 pt-20 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Профиль
        </h1>
        <p className="mt-1 text-sm text-muted">
          Имя, email и пароль вашего аккаунта
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-muted">Загрузка…</p>
        ) : (
          <div className="mt-8 space-y-10">
            <form onSubmit={onSaveProfile} className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Данные</h2>
              <FormField
                label="Имя"
                htmlFor="account-name"
                error={profileFieldErrors.name}
              >
                <Input
                  id="account-name"
                  placeholder="Иван"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </FormField>
              <FormField
                label="Email"
                htmlFor="account-email"
                error={profileFieldErrors.email}
              >
                <Input
                  id="account-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </FormField>
              {profileError && (
                <p className="text-sm text-danger">{profileError}</p>
              )}
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Сохранение…" : "Сохранить"}
              </Button>
            </form>

            <form onSubmit={onChangePassword} className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Пароль</h2>
              <FormField
                label="Текущий пароль"
                htmlFor="account-current-password"
                error={passwordFieldErrors.currentPassword}
              >
                <Input
                  id="account-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </FormField>
              <FormField
                label="Новый пароль"
                hint="Минимум 8 символов"
                htmlFor="account-new-password"
                error={passwordFieldErrors.newPassword}
              >
                <Input
                  id="account-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </FormField>
              <FormField
                label="Подтверждение"
                htmlFor="account-confirm-password"
                error={passwordFieldErrors.confirmPassword}
              >
                <Input
                  id="account-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </FormField>
              {passwordError && (
                <p className="text-sm text-danger">{passwordError}</p>
              )}
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Смена…" : "Сменить пароль"}
              </Button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
