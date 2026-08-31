// 재생 검증 — dist-web를 정적 서빙하고, 렌더러가 ws 실패→session.jsonl 재생으로 넘어가는지 확인.
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const dist = fileURLToPath(new URL("../dist-web", import.meta.url));
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".jsonl": "text/plain", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  const fp = dist + p;
  if (!existsSync(fp)) { res.writeHead(404); res.end(); return; }
  const ext = p.slice(p.lastIndexOf("."));
  res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
  res.end(readFileSync(fp));
});
await new Promise((r) => server.listen(8090, r));

const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://localhost:8090/");
await page.waitForTimeout(11000);   // ws 폴백(2.5s) + 재생 시작 + 첫 이벤트
await page.screenshot({ path: dist + "/../out/replay-check.png" });
console.log("errors:", errs.length ? errs.slice(0, 3) : "none");
await browser.close();
await new Promise((r) => server.close(r));
process.exit(0);
