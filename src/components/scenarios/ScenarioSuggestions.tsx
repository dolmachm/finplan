"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpHint } from "@/components/ui/FormField";
import { toast } from "@/components/ui/ToastProvider";
import { readApiError } from "@/shared/api-client";
import { apiFetch } from "@/shared/api-fetch";
import {
  getCfpScenarioSuggestions,
  type ScenarioTemplate,
} from "@/modules/scenarios/scenario.templates";
import { useFinanceStore } from "@/modules/finance/finance-store";

const DISMISS_KEY = "finplan.scenarioSuggestions.dismissed";

type ScenarioRow = {
  id: string;
  name: string;
  isActive: boolean;
  templateKey?: string | null;
  rules: unknown;
};

export function ScenarioSuggestions({
  scenarios,
  onRefresh,
  compact = false,
}: {
  scenarios: ScenarioRow[];
  onRefresh: () => void;
  compact?: boolean;
}) {
  const { assets, incomes, goals } = useFinanceStore();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const planReady =
    assets.length > 0 && incomes.length > 0 && goals.length > 0;

  const suggestions = useMemo(
    () =>
      getCfpScenarioSuggestions(scenarios.map((s) => s.templateKey)),
    [scenarios],
  );

  async function accept(tpl: ScenarioTemplate) {
    setBusy(tpl.key);
    try {
      const res = await apiFetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tpl.name,
          templateKey: tpl.key,
          params: { templateKey: tpl.key },
          rules: tpl.rules,
        }),
      });
      if (!res?.ok) {
        toast.error(res ? (await readApiError(res)).message : "Ошибка сети");
        return;
      }
      toast.success(`Сценарий «${tpl.name}» добавлен — можете править правила`);
      onRefresh();
    } finally {
      setBusy(null);
    }
  }

  async function acceptAll() {
    setBusy("all");
    try {
      for (const tpl of suggestions) {
        const res = await apiFetch("/api/scenarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tpl.name,
            templateKey: tpl.key,
            params: { templateKey: tpl.key },
            rules: tpl.rules,
          }),
        });
        if (!res?.ok) {
          toast.error(res ? (await readApiError(res)).message : "Ошибка сети");
          break;
        }
      }
      toast.success("Рекомендуемые сценарии добавлены");
      onRefresh();
    } finally {
      setBusy(null);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (dismissed === null || !planReady || suggestions.length === 0) {
    return null;
  }

  if (dismissed) {
    return (
      <button
        type="button"
        className="text-xs text-muted underline hover:text-foreground"
        onClick={() => {
          try {
            localStorage.removeItem(DISMISS_KEY);
          } catch {
            /* ignore */
          }
          setDismissed(false);
        }}
      >
        Показать подсказки CFP ({suggestions.length})
      </button>
    );
  }

  return (
    <Card className={compact ? "!p-3 space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Подсказки CFP
          </p>
          <h3 className="text-sm font-medium">
            Как ещё может развиваться ваша финансовая жизнь
          </h3>
          <HelpHint className="mt-1">
            Базовый план готов. Ниже — типичные what-if из практики планирования.
            Примите готовый сценарий, затем отредактируйте или добавьте свой.
          </HelpHint>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            disabled={!!busy}
            onClick={() => void acceptAll()}
          >
            {busy === "all" ? "…" : "Добавить все"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            onClick={dismiss}
          >
            Скрыть
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {suggestions.map((tpl) => (
          <li
            key={tpl.key}
            className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border px-2.5 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{tpl.name}</p>
              <p className="text-xs text-muted">{tpl.description}</p>
              {tpl.cfpTip && (
                <p className="mt-0.5 text-xs text-brand">{tpl.cfpTip}</p>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 text-xs"
              disabled={!!busy}
              onClick={() => void accept(tpl)}
            >
              {busy === tpl.key ? "…" : "Принять"}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
