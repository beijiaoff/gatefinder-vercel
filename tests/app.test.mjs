import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("includes every imported gate record", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../public/data/manifest.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.total, 7636);
  assert.equal(manifest.categories.length, 7);
});

test("keeps the confirmed search and editing interface", async () => {
  const source = await readFile(
    new URL("../app/GateFinder.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /width: "6", height: "7", head: "35"/);
  assert.match(source, /清空限制/);
  assert.match(source, /输入范围/);
  assert.match(source, /每页最多100条/);
  assert.match(source, /存在OCR错误请复核使用/);
});

test("uses Vercel-compatible Postgres persistence", async () => {
  const source = await readFile(
    new URL("../lib/database.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /@neondatabase\/serverless/);
  assert.doesNotMatch(source, /cloudflare:workers/);
});

test("ships an installable offline-capable PWA", async () => {
  const manifest = await readFile(new URL("../app/manifest.ts", import.meta.url), "utf8");
  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const interfaceSource = await readFile(new URL("../app/GateFinder.tsx", import.meta.url), "utf8");
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /icon-maskable-512\.png/);
  assert.match(serviceWorker, /gatefinder-shell-v3/);
  assert.match(serviceWorker, /submerged-slide\.json/);
  assert.match(interfaceSource, /className="era-sort"/);
  assert.doesNotMatch(interfaceSource, /className="result-tools"/);
  assert.match(interfaceSource, /启闭机 · 型式/);
  assert.match(interfaceSource, /完整资料 ›/);
  assert.doesNotMatch(interfaceSource, /<th>资料状态<\/th>/);
});

test("uses full-width desktop layout and Windows-native UI scaling", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(css, /min\(1440px/);
  assert.match(css, /html\.windows-ui main/);
  assert.match(css, /zoom:\s*1\.25/);
  assert.match(layout, /\/Windows\/i\.test\(navigator\.userAgent\)/);
});

test("uses category-specific head defaults and the supplied compact logo", async () => {
  const source = await readFile(new URL("../app/GateFinder.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const logo = await readFile(new URL("../public/icons/logo.png", import.meta.url));
  assert.match(source, /surface-slide.*surface-wheel.*surface-radial/);
  assert.match(source, /SURFACE_GATE_SLUGS\.has\(slug\).*clearLimit\("head"\)/s);
  assert.match(source, /submerged-slide.*submerged-wheel.*submerged-radial/);
  assert.match(source, /SUBMERGED_GATE_SLUGS\.has\(slug\).*head: DEFAULT_TARGET\.head/s);
  assert.match(source, /src="\/icons\/logo\.png"/);
  assert.doesNotMatch(source, /className="brand-mark"/);
  assert.match(css, /\.brand-logo[^}]*border-radius:/);
  assert.equal(logo.readUInt32BE(16), 86);
  assert.equal(logo.readUInt32BE(20), 86);
});
