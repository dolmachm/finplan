"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/ToastProvider";
import { readApiError } from "@/shared/api-client";
import { FIELD_HINTS } from "@/content/help";
import type { MacroSettings } from "@/shared/types";

export function MacroSettingsCard({
  onUnauthorized,
  onSaved,
}: {
  onUnauthorized: (res: Response) => boolean;
  onSaved?: () => void;
}) {
  const [macro, setMacro] = useState<MacroSettings | null>(null);
  const [inflation, setInflation] = useState("4");
  const [tax, setTax] = useState("13");
  const [horizon, setHorizon] = useState("30");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/macro", { cache: "no-store" });
    if (onUnauthorized(res)) return;
    if (!res.ok) return;
    const m = (await res.json()) as MacroSettings | null;
    setMacro(m);
    if (m) {
      setInflation(String(m.baseInflationPct));
      setTax(String(m.incomeTaxPct));
      setHorizon(String(m.planHorizonYears));
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/macro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseInflationPct: Number(inflation.replace(",", ".")) || 0,
          incomeTaxPct: Number(tax.replace(",", ".")) || 0,
          planHorizonYears: Math.min(50, Math.max(1, Number(horizon) || 30)),
        }),
      });
      if (onUnauthorized(res)) return;
      if (!res.ok) {
        toast.error((await readApiError(res)).message);
        return;
      }
      setMacro(await res.json());
      toast.success("Макропараметры сохранены");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-medium">Общие настройки прогноза</h2>
        <HelpHint>
          Общие допущения для всего плана: рост цен, налог и на сколько лет смотреть вперёд.
        </HelpHint>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Инфляция, % год." hint={FIELD_HINTS.inflation}>
          <Input value={inflation} onChange={(e) => setInflation(e.target.value)} />
        </FormField>
        <FormField label="НДФЛ, %" hint={FIELD_HINTS.incomeTax}>
          <Input value={tax} onChange={(e) => setTax(e.target.value)} />
        </FormField>
        <FormField label="Горизонт, лет" hint={FIELD_HINTS.planHorizon}>
          <Input value={horizon} onChange={(e) => setHorizon(e.target.value)} />
        </FormField>
      </div>
      <Button type="button" onClick={save} disabled={saving}>
        {saving ? "…" : "Сохранить макро"}
      </Button>
      {macro && (
        <p className="text-xs text-muted">
          Валюта: {macro.baseCurrency}. Обновлено:{" "}
          {new Date(macro.updatedAt).toLocaleString("ru-RU")}
        </p>
      )}
    </Card>
  );
}
