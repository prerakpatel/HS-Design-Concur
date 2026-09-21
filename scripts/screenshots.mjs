// Design preview screenshots. Run the dev server with DESIGN_PREVIEW=1 first:
//   DESIGN_PREVIEW=1 npm run dev
//   node scripts/screenshots.mjs [outDir] [screen...]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const base = process.env.PREVIEW_URL ?? "http://localhost:3000";
const out = process.argv[2] ?? "screenshots";
const only = process.argv.slice(3);
const screens = ["login", "events", "event", "slot", "settings", "requests", "inbox", "wizard-basics", "wizard-brief", "wizard-formats", "wizard-assign", "wizard-review"].filter((s) => !only.length || only.includes(s));
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
mkdirSync(out, { recursive: true });

let executablePath = process.env.CHROME_PATH;
if (!executablePath) { try { executablePath = execSync("ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1").toString().trim() || undefined; } catch { /* use bundled */ } }
// Route the browser through the same outbound proxy as the shell so Google Fonts load (no-op when unset).
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({ executablePath, proxy: proxy ? { server: proxy, bypass: "localhost,127.0.0.1" } : undefined, args: proxy ? ["--ignore-certificate-errors"] : [] });
for (const [vp, viewport] of Object.entries(viewports)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.deviceScaleFactor ?? 1, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
  const page = await ctx.newPage();
  for (const s of screens) {
    const url = s === "login" ? `${base}/login` : `${base}/preview/${s}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${out}/${s}-${vp}.png`, fullPage: true });
    console.log(`${s}-${vp}.png`);
  }
  await ctx.close();
}
await browser.close();
