"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, HelpHint } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { Modal, ModalFormBox, ModalFormActions } from "@/components/ui/Modal";
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
  const [open, setOpen] = useState(false);
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

  function openEditor() {
    if (macro) {
      setInflation(String(macro.baseInflationPct));
      setTax(String(macro.incomeTaxPct));
      setHorizon(String(macro.planHorizonYears));
    }
    setOpen(true);
  }

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
      setOpen(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">Общие настройки прогноза</h2>
          <HelpHint className="mt-1">
            Инфляция, налог на доход (НДФЛ) и горизонт плана — общие настройки для расчётов.
          </HelpHint>
          {macro && (
            <p className="mt-3 text-sm text-muted">
              Инфляция {macro.baseInflationPct}% · НДФЛ {macro.incomeTaxPct}% ·{" "}
              {macro.planHorizonYears} лет · {macro.baseCurrency}
            </p>
          )}
        </div>
        <Button type="button" variant="secondary" onClick={openEditor}>
          Изменить
        </Button>
      </Card>

      <Modal open={open} title="Настройки прогноза" onClose={() => setOpen(false)}>
        <ModalFormBox>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Инфляция, % год." htmlFor="macro-inf" hint={FIELD_HINTS.inflation}>
              <Input
                id="macro-inf"
                value={inflation}
                onChange={(e) => setInflation(e.target.value)}
              />
            </FormField>
            <FormField label="НДФЛ, %" htmlFor="macro-tax" hint={FIELD_HINTS.incomeTax}>
              <Input id="macro-tax" value={tax} onChange={(e) => setTax(e.target.value)} />
            </FormField>
            <FormField label="Горизонт, лет" htmlFor="macro-hz" hint={FIELD_HINTS.planHorizon}>
              <Input
                id="macro-hz"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
              />
            </FormField>
          </div>
        </ModalFormBox>
        <ModalFormActions
          onCancel={() => setOpen(false)}
          onSubmit={save}
          submitting={saving}
          submitLabel="Сохранить"
        />
      </Modal>
    </>
  );
}
