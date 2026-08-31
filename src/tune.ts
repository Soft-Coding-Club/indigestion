// 조율 하네스 — 라이브 없이, 결정된 감각을 주입해 특정 상태를 캡처한다.
// 유리 확정 후 조율 전용. reddit 대기 없이 기념비/상처를 바로 본다.
import http from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { WebSocketServer, WebSocket } from "ws";
import { chromium } from "playwright";

const PORT = 4778;
const html = readFileSync(new URL("../public/renderer.html", import.meta.url), "utf8");
const VENDOR_MIME: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2", ".woff": "font/woff",
};
const server = http.createServer((req, res) => {
  const p = (req.url ?? "/").split("?")[0];
  if (p.startsWith("/vendor/") && !p.includes("..")) {
    try {
      const data = readFileSync(new URL(`../public${p}`, import.meta.url));
      res.writeHead(200, { "content-type": VENDOR_MIME[p.slice(p.lastIndexOf("."))] ?? "application/octet-stream" });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set<WebSocket>();
wss.on("connection", (ws) => { clients.add(ws); ws.on("close", () => clients.delete(ws)); });
const send = (o: any) => { const s = JSON.stringify(o); for (const c of clients) if (c.readyState === WebSocket.OPEN) c.send(s); };

await new Promise<void>((r) => server.listen(PORT, r));

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`http://localhost:${PORT}/`);
await page.waitForTimeout(1500);
mkdirSync("out/tune", { recursive: true });

const wait = (ms: number) => page.waitForTimeout(ms);

// ── 상태 1: 삼킴 + 양분 → 살이 된다 (문턱 통과) ──
send({ t: "nav", url: "https://www.reddit.com/r/AmItheAsshole/comments/x/" });
send({ t: "reading", text: "My mom drank her coffee, threw it up, drank another. I never understood until I got older." });
await wait(1800);
send({ t: "verdict", v: "SWALLOW", nourishment: 2, marginalia: "커피를 토하면서도 다시 마시는 그 손. 나도 병실에서 뭔가를 되풀이했었나. 나는 커피를 마시고 있다.", translation: "엄마는 커피를 마시고 게우고 또 마셨다. 나이 들고서야 알았다." });
await wait(2600);
await page.screenshot({ path: "out/tune/1-flesh.png" });

// ── 상태 2: 삼킴이지만 양분 없음 → 살이 안 됨, 관으로 내려가 사라진다 ──
send({ t: "reading", text: "lol imagine gatekeeping grief. touch grass honestly this whole sub is a joke." });
await wait(1600);
send({ t: "verdict", v: "SWALLOW", nourishment: 0, marginalia: "또 이 말투.", translation: "슬픔에 자격을 따지다니. 웃기지." });
await wait(2200);
await page.screenshot({ path: "out/tune/2-canal.png" });

// ── 상태 3: 게움 — 관 역류 ──
send({ t: "reading", text: "kys nobody wants you here you pathetic waste of oxygen honestly" });
await wait(1200);
send({ t: "verdict", v: "PURGE", nourishment: -2, text: "kys nobody wants you here you pathetic waste of oxygen honestly" });
await wait(1400);
await page.screenshot({ path: "out/tune/3-purge.png" });
await wait(1600);
await page.screenshot({ path: "out/tune/4-aftermath.png" });

await browser.close();
await new Promise<void>((r) => server.close(() => r()));
console.log("captured: out/tune/{1-monument,2-wound,3-purge,4-aftermath}.png");
process.exit(0);
