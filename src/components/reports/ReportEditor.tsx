"use client";

import { useEffect, useState } from "react";
import { HelpHint } from "@/components/ui/FormField";
import { FEATURE_HINTS } from "@/content/help";
import {
  createDefaultReportConfig,
  DEFAULT_REPORT_TEXTS,
  mergeReportConfig,
  REPORT_BLOCK_DEFS,
  REPORT_CONFIG_STORAGE_KEY,
  type ReportBlockId,
  type ReportConfig,
  type ReportItemId,
  type ReportTextKey,
} from "@/modules/reports/report-config";

const TEXT_FIELDS: Array<{ key: ReportTextKey; label: string }> = [
  { key: "title", label: "Заголовок отчёта" },
  { key: "disclaimer", label: "Дисклеймер" },
  { key: "executiveNarrative", label: "Текст исполнительного резюме" },
  { key: "insightsIntro", label: "Вступление к инсайтам" },
  { key: "recommendationsIntro", label: "Вступление к рекомендациям" },
];

function loadStoredConfig(): ReportConfig {
  if (typeof window === "undefined") return createDefaultReportConfig();
  try {
    const raw = localStorage.getItem(REPORT_CONFIG_STORAGE_KEY);
    if (!raw) return createDefaultReportConfig();
    return mergeReportConfig(JSON.parse(raw) as Partial<ReportConfig>);
  } catch {
    return createDefaultReportConfig();
  }
}

export function ReportEditor({
  onUnauthorized,
}: {
  onUnauthorized?: (res: Response) => boolean;
}) {
  const [config, setConfig] = useState<ReportConfig>(createDefaultReportConfig);
  const [hydrated, setHydrated] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfig(loadStoredConfig());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(REPORT_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* ignore quota */
    }
  }, [config, hydrated]);

  function setBlock(id: ReportBlockId, enabled: boolean) {
    setConfig((prev) => ({
      ...prev,
      blocks: { ...prev.blocks, [id]: enabled },
    }));
  }

  function setItem(id: ReportItemId, enabled: boolean) {
    setConfig((prev) => ({
      ...prev,
      items: { ...prev.items, [id]: enabled },
    }));
  }

  function setText(key: ReportTextKey, value: string) {
    setConfig((prev) => ({
      ...prev,
      texts: { ...prev.texts, [key]: value },
    }));
  }

  function resetTemplates() {
    setConfig((prev) => ({
      ...prev,
      texts: { ...DEFAULT_REPORT_TEXTS },
    }));
  }

  function resetAll() {
    setConfig(createDefaultReportConfig());
  }

  const enabledOutline = REPORT_BLOCK_DEFS.filter((b) => config.blocks[b.id]);

  async function downloadPdf() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (onUnauthorized?.(res)) return;
      if (!res.ok) {
        setError("Не удалось сформировать PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "finplan-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Ошибка сети при скачивании");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-medium">Финансовый отчёт в PDF</h2>
        <HelpHint className="mt-1">{FEATURE_HINTS.pdfExport}</HelpHint>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          {REPORT_BLOCK_DEFS.map((block) => {
            const open = config.blocks[block.id];
            return (
              <div
                key={block.id}
                className="rounded-xl border border-border bg-card"
              >
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2.5 sm:px-4">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(e) => setBlock(block.id, e.target.checked)}
                    className="size-4 accent-[var(--brand)]"
                  />
                  <span className="text-sm font-medium">{block.label}</span>
                </label>
                {open && (
                  <div className="space-y-2 border-t border-border px-3 py-3 sm:px-4">
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {block.items.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-1.5 text-xs text-muted"
                        >
                          <input
                            type="checkbox"
                            checked={config.items[item.id]}
                            onChange={(e) =>
                              setItem(item.id, e.target.checked)
                            }
                            className="size-3.5 accent-[var(--brand)]"
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Редактируемые тексты</h3>
              <button
                type="button"
                onClick={resetTemplates}
                className="text-xs text-muted underline-offset-2 hover:underline"
              >
                Сбросить к шаблону
              </button>
            </div>
            <div className="space-y-3">
              {TEXT_FIELDS.map((field) => (
                <label key={field.key} className="block space-y-1">
                  <span className="text-xs text-muted">{field.label}</span>
                  <textarea
                    value={config.texts[field.key]}
                    onChange={(e) => setText(field.key, e.target.value)}
                    rows={field.key === "disclaimer" ? 3 : 2}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Состав отчёта
            </p>
            {enabledOutline.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Нет выбранных блоков</p>
            ) : (
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm">
                {enabledOutline.map((b) => (
                  <li key={b.id}>{b.label}</li>
                ))}
              </ol>
            )}
          </div>

          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading || enabledOutline.length === 0}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {downloading ? "Формирование…" : "Скачать PDF"}
          </button>
          <button
            type="button"
            onClick={resetAll}
            className="w-full rounded-lg border border-border px-4 py-2 text-xs text-muted hover:bg-muted/30"
          >
            Сбросить всё
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </aside>
      </div>
    </div>
  );
}
