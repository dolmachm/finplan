import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { jsPDF } from "jspdf";

/** Unicode font with Cyrillic (Helvetica cannot render Russian). */
export const REPORT_FONT = "NotoSans";

const fontsDir = join(process.cwd(), "src/modules/reports/fonts");

let regularB64: string | null = null;
let boldB64: string | null = null;

function loadFontBase64() {
  if (!regularB64 || !boldB64) {
    regularB64 = readFileSync(join(fontsDir, "NotoSans-Regular.ttf"), "base64");
    boldB64 = readFileSync(join(fontsDir, "NotoSans-Bold.ttf"), "base64");
  }
  return { regular: regularB64, bold: boldB64 };
}

export function applyReportFont(doc: jsPDF) {
  const { regular, bold } = loadFontBase64();
  doc.addFileToVFS("NotoSans-Regular.ttf", regular);
  doc.addFont("NotoSans-Regular.ttf", REPORT_FONT, "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", bold);
  doc.addFont("NotoSans-Bold.ttf", REPORT_FONT, "bold");
  doc.setFont(REPORT_FONT, "normal");
}
