import { jsPDF } from "jspdf";
import { formatRub } from "@/shared/format";
import type { PdfNamedAmount, PdfReportData } from "./build-report-data";
import {
  isBlockEnabled,
  isItemEnabled,
  REGULATORY_DISCLAIMER,
} from "./report-config";

export { REGULATORY_DISCLAIMER };

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 287;

type DocCtx = {
  doc: jsPDF;
  y: number;
  page: number;
};

function ensureSpace(ctx: DocCtx, need: number) {
  if (ctx.y + need <= FOOTER_Y - 6) return;
  addFooter(ctx);
  ctx.doc.addPage();
  ctx.page += 1;
  ctx.y = 20;
}

function addFooter(ctx: DocCtx) {
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(120);
  ctx.doc.text(`Стр. ${ctx.page}`, PAGE_W / 2, FOOTER_Y, { align: "center" });
  ctx.doc.setTextColor(0);
}

function sectionTitle(ctx: DocCtx, title: string) {
  ensureSpace(ctx, 14);
  ctx.doc.setFontSize(13);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.text(title, MARGIN, ctx.y);
  ctx.doc.setFont("helvetica", "normal");
  ctx.y += 8;
}

function bodyText(ctx: DocCtx, text: string, size = 10) {
  ctx.doc.setFontSize(size);
  const lines: string[] = ctx.doc.splitTextToSize(text, CONTENT_W);
  for (const line of lines) {
    ensureSpace(ctx, 6);
    ctx.doc.text(line, MARGIN, ctx.y);
    ctx.y += 5;
  }
}

function kvLine(ctx: DocCtx, label: string, value: string) {
  ensureSpace(ctx, 7);
  ctx.doc.setFontSize(10);
  ctx.doc.text(`${label}: ${value}`, MARGIN, ctx.y);
  ctx.y += 6;
}

function drawNamedList(
  ctx: DocCtx,
  rows: PdfNamedAmount[],
  emptyLabel: string,
) {
  if (rows.length === 0) {
    bodyText(ctx, emptyLabel, 9);
    return;
  }
  for (const row of rows) {
    ensureSpace(ctx, 6);
    ctx.doc.setFontSize(9);
    const line = `${row.name} — ${formatRub(row.amount)}`;
    const wrapped: string[] = ctx.doc.splitTextToSize(line, CONTENT_W);
    for (const w of wrapped) {
      ensureSpace(ctx, 5);
      ctx.doc.text(w, MARGIN, ctx.y);
      ctx.y += 5;
    }
  }
}

function drawNetWorthChart(
  ctx: DocCtx,
  series: Array<{ label: string; value: number }>,
) {
  if (series.length < 2) return;

  const chartH = 45;
  const chartW = CONTENT_W;
  ensureSpace(ctx, chartH + 14);

  const values = series.map((s) => s.value);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 0);
  const span = maxV - minV || 1;

  const x0 = MARGIN;
  const y0 = ctx.y;
  const yBottom = y0 + chartH;

  ctx.doc.setDrawColor(180);
  ctx.doc.rect(x0, y0, chartW, chartH);

  ctx.doc.setDrawColor(40, 100, 160);
  ctx.doc.setLineWidth(0.6);
  for (let i = 0; i < series.length - 1; i++) {
    const a = series[i]!;
    const b = series[i + 1]!;
    const x1 = x0 + (i / (series.length - 1)) * chartW;
    const x2 = x0 + ((i + 1) / (series.length - 1)) * chartW;
    const y1 = yBottom - ((a.value - minV) / span) * chartH;
    const y2 = yBottom - ((b.value - minV) / span) * chartH;
    ctx.doc.line(x1, y1, x2, y2);
  }
  ctx.doc.setLineWidth(0.2);
  ctx.doc.setDrawColor(0);

  ctx.doc.setFontSize(7);
  ctx.doc.setTextColor(100);
  ctx.doc.text(formatRub(maxV), x0 + 1, y0 + 4);
  ctx.doc.text(formatRub(minV), x0 + 1, yBottom - 2);
  const first = series[0]!;
  const last = series[series.length - 1]!;
  ctx.doc.text(first.label, x0, yBottom + 5);
  ctx.doc.text(last.label, x0 + chartW, yBottom + 5, { align: "right" });
  ctx.doc.setTextColor(0);

  ctx.y = yBottom + 12;
}

function writeCover(ctx: DocCtx, data: PdfReportData) {
  const { config } = data;
  if (!isBlockEnabled(config, "cover")) return;

  if (isItemEnabled(config, "cover", "cover_title")) {
    ensureSpace(ctx, 16);
    ctx.doc.setFontSize(18);
    ctx.doc.setFont("helvetica", "bold");
    const title = config.texts.title || "FinPlan — финансовый план (CFP)";
    const lines: string[] = ctx.doc.splitTextToSize(title, CONTENT_W);
    ctx.doc.text(lines, MARGIN, ctx.y);
    ctx.doc.setFont("helvetica", "normal");
    ctx.y += lines.length * 8 + 4;
  }

  ctx.doc.setFontSize(10);
  if (isItemEnabled(config, "cover", "cover_client")) {
    kvLine(ctx, "Клиент", data.userName);
  }
  if (isItemEnabled(config, "cover", "cover_date")) {
    kvLine(ctx, "Дата", data.generatedAt);
  }

  if (isItemEnabled(config, "cover", "cover_disclaimer")) {
    ctx.y += 2;
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(80);
    bodyText(
      ctx,
      config.texts.disclaimer || REGULATORY_DISCLAIMER,
      8,
    );
    ctx.doc.setTextColor(0);
    ctx.y += 4;
  }
}

function writeExecutive(ctx: DocCtx, data: PdfReportData) {
  const { config, metrics } = data;
  if (!isBlockEnabled(config, "executive")) return;

  sectionTitle(ctx, "Исполнительное резюме");
  if (isItemEnabled(config, "executive", "exec_narrative")) {
    bodyText(ctx, config.texts.executiveNarrative, 10);
    ctx.y += 2;
  }
  if (isItemEnabled(config, "executive", "exec_netWorth")) {
    kvLine(ctx, "Чистые активы", formatRub(metrics.netWorth));
  }
  if (isItemEnabled(config, "executive", "exec_surplus")) {
    kvLine(ctx, "Месячный профицит", formatRub(metrics.surplusMonthly));
  }
  if (isItemEnabled(config, "executive", "exec_cushion")) {
    kvLine(
      ctx,
      "Подушка безопасности",
      `${metrics.cushionMonths.toFixed(1)} мес.`,
    );
  }
  if (isItemEnabled(config, "executive", "exec_kdr")) {
    kvLine(ctx, "КДР", metrics.kdr.toFixed(2));
  }
  if (isItemEnabled(config, "executive", "exec_saving")) {
    kvLine(
      ctx,
      "Рекомендуемый ежемесячный взнос",
      formatRub(metrics.recommendedMonthlySaving),
    );
  }
  ctx.y += 4;
}

function writeBalance(ctx: DocCtx, data: PdfReportData) {
  const { config } = data;
  if (!isBlockEnabled(config, "balance")) return;

  sectionTitle(ctx, "Точка 0 — баланс");
  if (isItemEnabled(config, "balance", "bal_assets")) {
    ctx.doc.setFontSize(10);
    ctx.doc.setFont("helvetica", "bold");
    ensureSpace(ctx, 6);
    ctx.doc.text(
      `Активы (${formatRub(data.metrics.assetsTotal)})`,
      MARGIN,
      ctx.y,
    );
    ctx.doc.setFont("helvetica", "normal");
    ctx.y += 6;
    drawNamedList(ctx, data.assets, "Активы не указаны");
    ctx.y += 3;
  }
  if (isItemEnabled(config, "balance", "bal_liabilities")) {
    ctx.doc.setFontSize(10);
    ctx.doc.setFont("helvetica", "bold");
    ensureSpace(ctx, 6);
    ctx.doc.text(
      `Обязательства (${formatRub(data.metrics.liabilitiesTotal)})`,
      MARGIN,
      ctx.y,
    );
    ctx.doc.setFont("helvetica", "normal");
    ctx.y += 6;
    drawNamedList(ctx, data.liabilities, "Обязательства не указаны");
    ctx.y += 3;
  }
  if (isItemEnabled(config, "balance", "bal_netWorth")) {
    kvLine(ctx, "Чистые активы", formatRub(data.metrics.netWorth));
  }
  ctx.y += 4;
}

function writeCashflow(ctx: DocCtx, data: PdfReportData) {
  const { config, metrics } = data;
  if (!isBlockEnabled(config, "cashflow")) return;

  sectionTitle(ctx, "Денежный поток (ежемесячно)");
  if (isItemEnabled(config, "cashflow", "cf_income")) {
    kvLine(ctx, "Доходы", formatRub(metrics.incomeMonthly));
  }
  if (isItemEnabled(config, "cashflow", "cf_expenses")) {
    kvLine(ctx, "Расходы", formatRub(metrics.expenseMonthly));
  }
  if (isItemEnabled(config, "cashflow", "cf_surplus")) {
    kvLine(ctx, "Профицит", formatRub(metrics.surplusMonthly));
  }
  ctx.y += 4;
}

function writeGoals(ctx: DocCtx, data: PdfReportData) {
  const { config } = data;
  if (!isBlockEnabled(config, "goals")) return;

  sectionTitle(ctx, "Цели");
  if (!isItemEnabled(config, "goals", "goals_list") || data.goals.length === 0) {
    if (isItemEnabled(config, "goals", "goals_list")) {
      bodyText(ctx, "Цели не заданы", 9);
    }
    ctx.y += 4;
    return;
  }

  for (const g of data.goals) {
    ensureSpace(ctx, 16);
    ctx.doc.setFontSize(10);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(g.name, MARGIN, ctx.y);
    ctx.doc.setFont("helvetica", "normal");
    ctx.y += 5;
    ctx.doc.setFontSize(9);
    ctx.doc.text(`Целевая сумма: ${formatRub(g.target)}`, MARGIN + 2, ctx.y);
    ctx.y += 5;

    if (
      isItemEnabled(config, "goals", "goals_funding") &&
      g.achievability !== undefined
    ) {
      const fundBits = [
        `достижимость: ${g.achievability}`,
        g.requiredMonthly !== undefined
          ? `нужно ${formatRub(g.requiredMonthly)}/мес`
          : null,
        g.allocatedMonthly !== undefined
          ? `выделено ${formatRub(g.allocatedMonthly)}/мес`
          : null,
      ].filter(Boolean);
      const line = fundBits.join(" · ");
      const wrapped: string[] = ctx.doc.splitTextToSize(line, CONTENT_W - 2);
      for (const w of wrapped) {
        ensureSpace(ctx, 5);
        ctx.doc.text(w, MARGIN + 2, ctx.y);
        ctx.y += 5;
      }
    }

    if (
      isItemEnabled(config, "goals", "goals_probability") &&
      g.probability !== undefined
    ) {
      ensureSpace(ctx, 5);
      ctx.doc.text(
        `Вероятность MC: ${(g.probability * 100).toFixed(1)}%`,
        MARGIN + 2,
        ctx.y,
      );
      ctx.y += 5;
    }
    ctx.y += 2;
  }
  ctx.y += 2;
}

function writeAssumptions(ctx: DocCtx, data: PdfReportData) {
  const { config, assumptions } = data;
  if (!isBlockEnabled(config, "assumptions")) return;

  sectionTitle(ctx, "Предположения");
  if (isItemEnabled(config, "assumptions", "asm_inflation")) {
    kvLine(ctx, "Инфляция", `${assumptions.inflation}% годовых`);
  }
  if (isItemEnabled(config, "assumptions", "asm_horizon")) {
    kvLine(ctx, "Горизонт", `${assumptions.horizonYears} лет`);
  }
  if (isItemEnabled(config, "assumptions", "asm_tax")) {
    kvLine(ctx, "Налог на доход", `${assumptions.incomeTaxPct}%`);
  }
  ctx.y += 4;
}

function writeProjection(ctx: DocCtx, data: PdfReportData) {
  const { config, summary } = data;
  if (!isBlockEnabled(config, "projection")) return;

  sectionTitle(ctx, "Прогноз");
  if (isItemEnabled(config, "projection", "proj_finalNw")) {
    kvLine(
      ctx,
      "Чистые активы на конец горизонта",
      formatRub(summary.finalNetWorth),
    );
  }
  if (isItemEnabled(config, "projection", "proj_avgSurplus")) {
    kvLine(
      ctx,
      "Средний месячный профицит",
      formatRub(summary.avgMonthlySurplus),
    );
  }
  if (isItemEnabled(config, "projection", "proj_chart") && data.nwSeries.length > 1) {
    ensureSpace(ctx, 8);
    ctx.doc.setFontSize(10);
    ctx.doc.text("Динамика чистых активов", MARGIN, ctx.y);
    ctx.y += 6;
    drawNetWorthChart(ctx, data.nwSeries);
  }
  ctx.y += 2;
}

function writeInsightBlock(
  ctx: DocCtx,
  title: string,
  intro: string,
  rows: Array<{ title: string; body: string }>,
  showList: boolean,
) {
  sectionTitle(ctx, title);
  if (intro) {
    bodyText(ctx, intro, 9);
    ctx.y += 2;
  }
  if (!showList) {
    ctx.y += 2;
    return;
  }
  if (rows.length === 0) {
    bodyText(ctx, "Нет пунктов для отображения", 9);
    ctx.y += 4;
    return;
  }
  for (const row of rows) {
    ensureSpace(ctx, 12);
    ctx.doc.setFontSize(10);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.text(`• ${row.title}`, MARGIN, ctx.y);
    ctx.doc.setFont("helvetica", "normal");
    ctx.y += 5;
    bodyText(ctx, row.body, 9);
    ctx.y += 2;
  }
  ctx.y += 2;
}

export function generatePlanPdf(data: PdfReportData): Uint8Array {
  const doc = new jsPDF();
  const ctx: DocCtx = { doc, y: 20, page: 1 };

  writeCover(ctx, data);
  writeExecutive(ctx, data);
  writeBalance(ctx, data);
  writeCashflow(ctx, data);
  writeGoals(ctx, data);
  writeAssumptions(ctx, data);
  writeProjection(ctx, data);

  if (isBlockEnabled(data.config, "insights")) {
    writeInsightBlock(
      ctx,
      "Инсайты",
      data.config.texts.insightsIntro,
      isItemEnabled(data.config, "insights", "insights_list")
        ? data.insights
        : [],
      isItemEnabled(data.config, "insights", "insights_list"),
    );
  }
  if (isBlockEnabled(data.config, "recommendations")) {
    writeInsightBlock(
      ctx,
      "Рекомендации",
      data.config.texts.recommendationsIntro,
      isItemEnabled(data.config, "recommendations", "recs_list")
        ? data.recommendations
        : [],
      isItemEnabled(data.config, "recommendations", "recs_list"),
    );
  }

  addFooter(ctx);
  return new Uint8Array(doc.output("arraybuffer"));
}
