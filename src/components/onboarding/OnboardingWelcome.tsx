"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PATH = [
  {
    n: "1",
    title: "Точка 0",
    text: "Активы и долги — сколько у вас сейчас.",
  },
  {
    n: "2",
    title: "Поток",
    text: "Доходы и расходы — что остаётся каждый месяц.",
  },
  {
    n: "3",
    title: "Цели",
    text: "Суммы и сроки — к чему идём.",
  },
  {
    n: "4",
    title: "План",
    text: "Прогноз, риски и сценарии «что если».",
  },
] as const;

/**
 * Первый заход: коротко объяснить сервис, затем вести в заполнение.
 * Два экрана — educate → commit, без лишней теории.
 */
export function OnboardingWelcome({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const [screen, setScreen] = useState<"why" | "how">("why");

  if (screen === "why") {
    return (
      <Card className="overflow-hidden border-brand/20 bg-gradient-to-br from-brand-light/80 to-card">
        <p className="text-xs font-medium uppercase tracking-wide text-brand">
          Добро пожаловать в ФИНКОН
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Личный финансовый план за несколько шагов
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          Сервис собирает вашу картину денег и показывает, хватает ли ресурсов
          на цели — без сложных таблиц и «инвест-советов от брокера».
        </p>
        <ul className="mt-6 space-y-2 text-sm text-foreground">
          <li className="flex gap-2">
            <span className="text-brand" aria-hidden>
              ·
            </span>
            Сначала данные — потом расчёты и сценарии
          </li>
          <li className="flex gap-2">
            <span className="text-brand" aria-hidden>
              ·
            </span>
            Можно править в любой момент — план пересчитается
          </li>
          <li className="flex gap-2">
            <span className="text-brand" aria-hidden>
              ·
            </span>
            Результаты справочные, не индивидуальная рекомендация
          </li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button type="button" onClick={() => setScreen("how")}>
            Как это устроено
          </Button>
          <Button type="button" variant="ghost" onClick={onSkip}>
            Пропустить
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-brand/20">
      <p className="text-xs font-medium uppercase tracking-wide text-brand">
          Шаг за шагом
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
        Сначала заполним данные, затем откроем план
      </h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Идите по порядку — после каждого блока подскажем, куда дальше.
      </p>

      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {PATH.map((step) => (
          <li
            key={step.n}
            className="flex gap-3 rounded-xl border border-border bg-background/60 p-3"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white"
              aria-hidden
            >
              {step.n}
            </span>
            <div>
              <p className="text-sm font-medium">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onStart}>
          Начать с точки 0
        </Button>
        <Button type="button" variant="secondary" onClick={() => setScreen("why")}>
          Назад
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          Уже знаком — к главной
        </button>
      </div>
    </Card>
  );
}
