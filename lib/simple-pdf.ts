import { readFileSync } from "node:fs";
import path from "node:path";

type PdfSection = { heading?: string; body?: string };
type PdfPage = {
  page_number?: number;
  title?: string;
  subtitle?: string;
  sections?: PdfSection[];
  bullets?: string[];
  callout?: string;
};

type PdfReport = {
  title?: string;
  period_start?: string | null;
  period_end?: string | null;
  document_json?: { document_title?: string; pages?: PdfPage[] } | null;
  watermark_removed_at?: string | null;
};

type PdfObject = string | Buffer;
const LOGO_WIDTH = 96;
const LOGO_HEIGHT = 102;
let logoCache: Buffer | null = null;

function getLumawayLogoData() {
  if (logoCache) return logoCache;
  try {
    logoCache = readFileSync(path.join(process.cwd(), "public", "brand", "lumaway-pdf-logo.rgbz"));
  } catch {
    logoCache = Buffer.alloc(0);
  }
  return logoCache;
}

function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

function escPdf(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, max = 86) {
  const words = ascii(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function textLine(text: string, x: number, y: number, size = 10, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escPdf(ascii(text))}) Tj ET\n`;
}

function logoCommand() {
  return "q 29 0 0 31 44 787 cm /Logo Do Q\n";
}

function buildPageContent(page: PdfPage, index: number, report: PdfReport) {
  const commands: string[] = [];
  const title = page.title || report.document_json?.document_title || report.title || "Lumaway AI Analytics Report";
  const subtitle = page.subtitle || "";
  const isCover = index === 0;

  commands.push(logoCommand());
  commands.push("0 0 0 rg\n");
  commands.push(textLine("LUMAWAY.", 80, 798, 10, true));
  commands.push(textLine("AI ANALYTICS REPORT", 44, 775, 7, false));
  commands.push("0.86 0.87 0.90 RG 0.7 w 44 765 m 551 765 l S\n");

  if (!report.watermark_removed_at) {
    commands.push("0.94 0.94 0.96 rg\n");
    commands.push("q 0.82 0.57 -0.57 0.82 155 300 cm\n");
    commands.push(textLine("LUMAWAY", 0, 0, 48, true));
    commands.push("Q\n0 0 0 rg\n");
  }

  if (isCover) {
    let y = 600;
    commands.push(textLine("LUMAWAY AFFILIATE INTELLIGENCE", 54, y + 64, 8, true));
    for (const line of wrap(title, 38)) {
      commands.push(textLine(line, 54, y, 24, true));
      y -= 32;
    }
    y -= 10;
    for (const line of wrap(subtitle, 70)) {
      commands.push(textLine(line, 54, y, 11, false));
      y -= 16;
    }
    commands.push("0.39 0.36 1 RG 3 w 54 360 m 170 360 l S\n");
    commands.push(textLine(`${report.period_start || "ALL DATA"} - ${report.period_end || "ALL DATA"}`, 54, 338, 9, false));
  } else {
    let y = 720;
    commands.push(textLine(String(page.page_number || index + 1).padStart(2, "0"), 520, 735, 8, false));
    for (const line of wrap(title, 48)) {
      commands.push(textLine(line, 48, y, 20, true));
      y -= 26;
    }
    if (subtitle) {
      y -= 4;
      for (const line of wrap(subtitle, 82)) {
        commands.push(textLine(line, 48, y, 10, false));
        y -= 14;
      }
    }

    for (const section of page.sections || []) {
      if (y < 145) break;
      y -= 12;
      commands.push("0.86 0.87 0.90 RG 0.5 w 48 " + (y + 8) + " m 547 " + (y + 8) + " l S\n");
      commands.push(textLine(section.heading || "Insight", 48, y - 8, 10, true));
      y -= 26;
      for (const line of wrap(section.body || "", 88)) {
        if (y < 120) break;
        commands.push(textLine(line, 48, y, 9, false));
        y -= 13;
      }
    }

    if (y > 165 && page.bullets?.length) {
      y -= 12;
      commands.push(textLine("KEY POINTS", 48, y, 10, true));
      y -= 18;
      for (const bullet of page.bullets.slice(0, 9)) {
        for (const [lineIndex, line] of wrap(bullet, 82).entries()) {
          if (y < 120) break;
          commands.push(textLine(`${lineIndex === 0 ? "- " : "  "}${line}`, 58, y, 9, false));
          y -= 13;
        }
      }
    }

    if (y > 145 && page.callout) {
      y -= 8;
      commands.push("0.95 0.95 1 rg 48 " + (y - 54) + " 499 62 re f\n0 0 0 rg\n");
      let calloutY = y - 14;
      for (const line of wrap(page.callout, 80).slice(0, 3)) {
        commands.push(textLine(line, 60, calloutY, 9, true));
        calloutY -= 14;
      }
    }
  }

  commands.push("0.86 0.87 0.90 RG 0.5 w 44 52 m 551 52 l S\n");
  commands.push(textLine(`Copyright ${new Date().getFullYear()} Lumaway - Light Up Your Potential.`, 44, 36, 7, false));
  commands.push(textLine(`Page ${index + 1}`, 510, 36, 7, false));
  return commands.join("");
}

function imageObject(data: Buffer) {
  if (!data.length) {
    const pixel = Buffer.from([255, 255, 255]);
    return Buffer.concat([
      Buffer.from("<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n", "ascii"),
      pixel,
      Buffer.from("\nendstream", "ascii"),
    ]);
  }
  return Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${LOGO_WIDTH} /Height ${LOGO_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.length} >>\nstream\n`, "ascii"),
    data,
    Buffer.from("\nendstream", "ascii"),
  ]);
}

function asBuffer(object: PdfObject) {
  return Buffer.isBuffer(object) ? object : Buffer.from(object, "ascii");
}

export function generateReportPdf(report: PdfReport) {
  const sourcePages = report.document_json?.pages || [];
  const pages = sourcePages.length ? sourcePages.slice(0, 20) : [{ title: report.title || "Lumaway Report" }];

  const objects: PdfObject[] = [];
  // 1: catalog, 2: pages tree, 3/4 fonts, 5: official Lumaway logo image.
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids: string[] = [];
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  objects[5] = imageObject(getLumawayLogoData());

  pages.forEach((page, index) => {
    const pageObject = 6 + index * 2;
    const contentObject = pageObject + 1;
    kids.push(`${pageObject} 0 R`);
    const stream = buildPageContent(page, index, report);
    objects[contentObject] = `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`;
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents ${contentObject} 0 R >>`;
  });

  objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%LUMAWAY\n", "ascii")];
  const offsets: number[] = [0];
  let byteOffset = chunks[0].length;

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = byteOffset;
    const prefix = Buffer.from(`${i} 0 obj\n`, "ascii");
    const body = asBuffer(objects[i]);
    const suffix = Buffer.from("\nendobj\n", "ascii");
    chunks.push(prefix, body, suffix);
    byteOffset += prefix.length + body.length + suffix.length;
  }

  const xrefOffset = byteOffset;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}
