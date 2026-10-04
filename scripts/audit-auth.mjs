// Measure the rendered auth layout instead of eyeballing screenshots.
// Reports computed font sizes, control heights, and any horizontal overflow,
// which is what actually breaks usability on phones.
// Run with: node scripts/audit-auth.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PAGES = [
  ["login", "/login"],
  ["register", "/register"],
];
const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];

const browser = await chromium.launch();

for (const [vp, viewport] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();

  for (const [name, path] of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(800);

    const report = await page.evaluate(() => {
      const cs = (el) => getComputedStyle(el);
      const pick = (sel) => Array.from(document.querySelectorAll(sel));

      const texts = [];
      for (const el of pick("h1, p, label span, label, button, a, small, .auth-v7-legal, .auth-v7-helper")) {
        const t = (el.textContent || "").trim();
        if (!t || el.offsetParent === null) continue;
        texts.push({
          sel: el.className || el.tagName.toLowerCase(),
          size: parseFloat(cs(el).fontSize),
          text: t.slice(0, 34),
        });
      }

      const controls = [];
      for (const el of pick("button, input, a.auth-v7-secondary-link")) {
        if (el.offsetParent === null) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        controls.push({
          sel: (el.className || el.tagName.toLowerCase()).toString().slice(0, 34),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }

      const de = document.documentElement;
      return {
        scrollW: de.scrollWidth,
        clientW: de.clientWidth,
        texts,
        controls,
      };
    });

    const overflow = report.scrollW > report.clientW + 1;
    const tiny = report.texts.filter((t) => t.size < 12);
    const small = report.controls.filter((c) => c.h < 40 && c.h > 0);

    console.log(`\n${"=".repeat(58)}\n${name} @ ${vp} (${viewport.width}px)\n${"=".repeat(58)}`);
    console.log(`overflow horizontal : ${overflow ? `YA (${report.scrollW} > ${report.clientW})` : "tidak ada"}`);
    console.log(`teks < 12px        : ${tiny.length}`);
    for (const t of tiny.slice(0, 8)) console.log(`   ${t.size}px  "${t.text}"`);
    console.log(`kontrol < 40px     : ${small.length}`);
    for (const c of small.slice(0, 8)) console.log(`   ${c.h}px  ${c.sel}`);

    const sizes = [...new Set(report.texts.map((t) => t.size))].sort((a, b) => a - b);
    console.log(` ukuran teks ada   : ${sizes.join(", ")}`);
  }
  await ctx.close();
}

await browser.close();
