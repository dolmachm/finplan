"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, ModalFormActions, ModalFormBox } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/FormField";
import { FormError } from "@/components/ui/FormError";
import { toast } from "@/components/ui/ToastProvider";
import { apiFetch } from "@/shared/api-fetch";
import { readApiError } from "@/shared/api-client";
import type { DashboardTab } from "@/components/layout/DashboardShell";
import {
  SUPPORT_LOCATION_OPTIONS,
  SUPPORT_STATUS_LABELS,
  suggestFaq,
} from "@/content/support";
import type {
  SupportLocationArea,
  SupportMessage,
  SupportTicket,
} from "@/shared/types";

type TicketRow = SupportTicket & { createdAt: string; updatedAt: string };
type MessageRow = SupportMessage & { createdAt: string };

const AUTHOR_LABELS: Record<string, string> = {
  USER: "Вы",
  ADMIN: "Поддержка",
  SYSTEM: "Система",
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SupportPanel({
  open,
  onClose,
  dashboardTab,
  subTab = null,
}: {
  open: boolean;
  onClose: () => void;
  dashboardTab: DashboardTab;
  subTab?: string | null;
}) {
  const [mode, setMode] = useState<"list" | "new" | "thread">("list");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<{
    ticket: TicketRow;
    messages: MessageRow[];
  } | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [locationArea, setLocationArea] =
    useState<SupportLocationArea>("form");
  const [locationHint, setLocationHint] = useState("");

  const page =
    typeof window !== "undefined" ? window.location.pathname : "/dashboard";

  const faqTips = suggestFaq(dashboardTab, `${subject} ${body}`);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/support/tickets");
      if (!res) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setMode("list");
    setActiveId(null);
    setThread(null);
    setError("");
    void loadTickets();
  }, [open, loadTickets]);

  async function openThread(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/support/tickets/${id}`);
      if (!res) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      const data = await res.json();
      setThread(data);
      setActiveId(id);
      setMode("thread");
      setReply("");
    } finally {
      setLoading(false);
    }
  }

  async function submitNew() {
    setError("");
    setSending(true);
    try {
      const res = await apiFetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          page,
          dashboardTab,
          subTab,
          locationArea,
          locationHint: locationHint || null,
        }),
      });
      if (!res) return;
      if (!res.ok) {
        setError((await readApiError(res)).message);
        return;
      }
      const data = await res.json();
      toast.success("Обращение отправлено");
      setSubject("");
      setBody("");
      setLocationHint("");
      await openThread(data.ticket.id);
      void loadTickets();
    } finally {
      setSending(false);
    }
  }

  async function submitReply() {
    if (!activeId || !reply.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await apiFetch(`/api/support/tickets/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply }),
      });
      if (!res) return;
      if (!res.ok) {
        setError((await readApiError(res)).message);
        return;
      }
      setReply("");
      await openThread(activeId);
      void loadTickets();
    } finally {
      setSending(false);
    }
  }

  const title =
    mode === "new"
      ? "Новое обращение"
      : mode === "thread"
        ? (thread?.ticket.subject ?? "Обращение")
        : "Поддержка";

  return (
    <Modal open={open} title={title} onClose={onClose}>
      {mode === "list" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Опишите проблему — укажем страницу и место на экране.
            </p>
            <Button type="button" onClick={() => setMode("new")}>
              Написать
            </Button>
          </div>
          {loading && <p className="text-sm text-muted">Загрузка…</p>}
          {!loading && tickets.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              Пока нет обращений
            </p>
          )}
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void openThread(t.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:bg-brand-light"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {t.subject}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {t.page}
                      {t.dashboardTab ? ` · ${t.dashboardTab}` : ""}
                      {" · "}
                      {formatWhen(t.updatedAt)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand">
                    {SUPPORT_STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === "new" && (
        <div className="space-y-4">
          <button
            type="button"
            className="text-sm text-muted hover:text-foreground"
            onClick={() => setMode("list")}
          >
            ← К списку
          </button>

          {faqTips.length > 0 && (
            <div className="rounded-xl border border-border bg-background px-3 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Возможно поможет
              </p>
              <ul className="space-y-2">
                {faqTips.map((f) => (
                  <li key={f.q} className="text-sm">
                    <p className="font-medium text-foreground">{f.q}</p>
                    <p className="mt-0.5 text-muted">{f.a}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ModalFormBox>
            <div className="space-y-3">
              <p className="text-xs text-muted">
                Страница: <span className="text-foreground">{page}</span>
                {" · "}
                вкладка:{" "}
                <span className="text-foreground">{dashboardTab}</span>
                {subTab ? (
                  <>
                    {" · "}подраздел:{" "}
                    <span className="text-foreground">{subTab}</span>
                  </>
                ) : null}
              </p>
              <FormField label="Тема">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Кратко: что не так"
                  maxLength={120}
                />
              </FormField>
              <FormField label="Где на экране">
                <select
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  value={locationArea}
                  onChange={(e) =>
                    setLocationArea(e.target.value as SupportLocationArea)
                  }
                >
                  {SUPPORT_LOCATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Уточнение места (необязательно)">
                <Input
                  value={locationHint}
                  onChange={(e) => setLocationHint(e.target.value)}
                  placeholder="Например: кнопка «Скачать PDF»"
                  maxLength={200}
                />
              </FormField>
              <FormField label="Описание">
                <textarea
                  className="min-h-[120px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Что ожидали и что произошло"
                  maxLength={4000}
                />
              </FormField>
              {error && <FormError message={error} />}
            </div>
          </ModalFormBox>
          <ModalFormActions
            onCancel={() => setMode("list")}
            onSubmit={() => void submitNew()}
            submitLabel="Отправить"
            submitting={sending}
            submittingLabel="Отправка…"
          />
        </div>
      )}

      {mode === "thread" && thread && (
        <div className="space-y-4">
          <button
            type="button"
            className="text-sm text-muted hover:text-foreground"
            onClick={() => {
              setMode("list");
              setThread(null);
            }}
          >
            ← К списку
          </button>
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted">
            <p>
              Статус:{" "}
              <span className="font-medium text-foreground">
                {SUPPORT_STATUS_LABELS[thread.ticket.status] ??
                  thread.ticket.status}
              </span>
            </p>
            <p className="mt-1">
              {thread.ticket.page}
              {thread.ticket.dashboardTab
                ? ` · ${thread.ticket.dashboardTab}`
                : ""}
              {thread.ticket.subTab ? ` / ${thread.ticket.subTab}` : ""}
              {" · "}
              {
                SUPPORT_LOCATION_OPTIONS.find(
                  (o) => o.value === thread.ticket.locationArea,
                )?.label
              }
              {thread.ticket.locationHint
                ? ` — ${thread.ticket.locationHint}`
                : ""}
            </p>
          </div>

          <ul className="max-h-[40vh] space-y-3 overflow-y-auto pr-1">
            {thread.messages.map((m) => (
              <li
                key={m.id}
                className={
                  m.author === "USER"
                    ? "ml-6 rounded-xl bg-brand-light px-3 py-2 text-sm"
                    : "mr-6 rounded-xl border border-border px-3 py-2 text-sm"
                }
              >
                <p className="mb-1 text-xs text-muted">
                  {AUTHOR_LABELS[m.author] ?? m.author} ·{" "}
                  {formatWhen(m.createdAt)}
                </p>
                <p className="whitespace-pre-wrap text-foreground">{m.body}</p>
              </li>
            ))}
          </ul>

          {thread.ticket.status !== "CLOSED" ? (
            <div className="space-y-2">
              <textarea
                className="min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Ваш ответ…"
                maxLength={4000}
              />
              {error && <FormError message={error} />}
              <Button
                type="button"
                disabled={sending || !reply.trim()}
                onClick={() => void submitReply()}
              >
                {sending ? "Отправка…" : "Ответить"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Обращение закрыто. Создайте новое, если проблема осталась.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
