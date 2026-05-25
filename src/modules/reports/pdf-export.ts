import { jsPDF } from "jspdf";

export interface PdfReportData {
  userName: string;
  generatedAt: string;
  disclaimer: string;
  assumptions: {
    inflation: number;
    horizonYears: number;
  };
  goals: Array<{
    name: string;
    probability?: number;
    target: number;
    median?: number;
  }>;
  summary: {
    finalNetWorth: number;
    recommendedSaving: number;
  };
}

export function generatePlanPdf(data: PdfReportData): Uint8Array {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.text("FinPlan — отчёт финансового плана", 14, y);
  y += 12;

  doc.setFontSize(10);
  doc.text(`Пользователь: ${data.userName}`, 14, y);
  y += 6;
  doc.text(`Дата: ${data.generatedAt}`, 14, y);
  y += 10;

  doc.setFontSize(9);
  const disclaimerLines = doc.splitTextToSize(data.disclaimer, 180);
  doc.text(disclaimerLines, 14, y);
  y += disclaimerLines.length * 5 + 8;

  doc.setFontSize(12);
  doc.text("Предположения", 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`Инфляция: ${data.assumptions.inflation}% годовых`, 14, y);
  y += 6;
  doc.text(`Горизонт: ${data.assumptions.horizonYears} лет`, 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("Сводка", 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(
    `Прогноз чистых активов (конец): ${formatMoney(data.summary.finalNetWorth)}`,
    14,
    y,
  );
  y += 6;
  doc.text(
    `Рекомендуемый ежемесячный взнос: ${formatMoney(data.summary.recommendedSaving)}`,
    14,
    y,
  );
  y += 10;

  doc.setFontSize(12);
  doc.text("Цели", 14, y);
  y += 8;
  doc.setFontSize(10);
  for (const g of data.goals) {
    const prob =
      g.probability !== undefined
        ? ` — вероятность ${(g.probability * 100).toFixed(1)}%`
        : "";
    doc.text(`${g.name}: ${formatMoney(g.target)}${prob}`, 14, y);
    y += 6;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

export const REGULATORY_DISCLAIMER =
  "Результаты носят информационный характер и не являются индивидуальной инвестиционной рекомендацией. Все расчёты основаны на ваших предположениях о доходности, инфляции и налогах.";
