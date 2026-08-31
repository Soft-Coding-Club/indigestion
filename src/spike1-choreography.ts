import { chromium, type Page } from "playwright";
import { path as cursorPath } from "ghost-cursor";

type Vec = { x: number; y: number };
type Box = Vec & { width: number; height: number };

const SUB = process.env.SUB ?? "AmItheAsshole";
const DURATION_MS = Number(process.env.DURATION_MS ?? 90_000);
const VIEW = { width: 1280, height: 800 };

let cur: Vec = { x: VIEW.width / 2, y: VIEW.height / 2 };
let shotN = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const log = (msg: string) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

async function glide(page: Page, to: Vec, speed = 1) {
  const pts = cursorPath(cur, to) as Vec[];
  for (const p of pts) {
    await page.mouse.move(p.x, p.y);
    await sleep(rand(4, 12) / speed);
  }
  cur = { ...to };
}

// hover in place with micro-jitter, like eyes resting on a line
async function dwell(page: Page, ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await page.mouse.move(cur.x + rand(-3, 3), cur.y + rand(-2, 2));
    await sleep(rand(120, 380));
  }
}

async function scrollBy(page: Page, dy: number) {
  const steps = Math.max(6, Math.round(Math.abs(dy) / 60));
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 1 : i / (steps - 1);
    const ease = Math.sin(t * Math.PI);
    await page.mouse.wheel(0, (dy / steps) * (0.5 + ease));
    await sleep(rand(30, 90));
  }
}

// the OS cursor is invisible to screenshots/screencast, so the page draws its own
async function injectCursor(page: Page) {
  await page.addInitScript(() => {
    const mk = () => {
      if (document.getElementById("__agent_cursor")) return;
      const d = document.createElement("div");
      d.id = "__agent_cursor";
      Object.assign(d.style, {
        position: "fixed",
        width: "14px",
        height: "14px",
        border: "2px solid #111",
        borderRadius: "50%",
        background: "rgba(255,255,255,.75)",
        zIndex: "999999",
        pointerEvents: "none",
        left: "0px",
        top: "0px",
        transform: "translate(-50%,-50%)",
      });
      document.documentElement.appendChild(d);
      window.addEventListener(
        "mousemove",
        (e) => {
          d.style.left = e.clientX + "px";
          d.style.top = e.clientY + "px";
        },
        { passive: true },
      );
    };
    if (document.readyState !== "loading") mk();
    else document.addEventListener("DOMContentLoaded", mk);
  });
}

async function shot(page: Page, tag: string) {
  shotN += 1;
  const file = `out/spike1-${String(shotN).padStart(2, "0")}-${tag}.png`;
  await page.screenshot({ path: file });
  log(`screenshot → ${file}`);
}

async function visibleTitleBoxes(page: Page) {
  const posts = page.locator("shreddit-post");
  const n = await posts.count();
  const out: { box: Box; title: string; permalink: string }[] = [];
  for (let i = 0; i < Math.min(n, 20); i++) {
    const post = posts.nth(i);
    const titleEl = post.locator('a[slot="title"]').first();
    if ((await titleEl.count()) === 0) continue;
    const box = await titleEl.boundingBox();
    if (!box || box.y < 70 || box.y > VIEW.height - 120) continue;
    const title = ((await post.getAttribute("post-title")) ?? "").slice(0, 70);
    const permalink = (await post.getAttribute("permalink")) ?? "";
    if (permalink) out.push({ box, title, permalink });
  }
  return out;
}

async function feedWander(page: Page): Promise<string | null> {
  let cands = await visibleTitleBoxes(page);
  let guard = 0;
  while (cands.length === 0 && guard < 5) {
    await scrollBy(page, 350);
    await sleep(600);
    cands = await visibleTitleBoxes(page);
    guard += 1;
  }
  if (cands.length === 0) return null;

  const passes = Math.round(rand(2, 4));
  for (let i = 0; i < passes; i++) {
    const c = pick(cands);
    await glide(page, {
      x: c.box.x + rand(10, Math.max(20, c.box.width * 0.6)),
      y: c.box.y + c.box.height / 2,
    });
    await dwell(page, rand(400, 1400));
    if (Math.random() < 0.5) {
      await scrollBy(page, rand(120, 420));
      cands = await visibleTitleBoxes(page);
      if (cands.length === 0) break;
    }
  }
  if (cands.length === 0) return null;

  const c = pick(cands);
  await glide(page, {
    x: c.box.x + rand(10, Math.max(20, c.box.width * 0.5)),
    y: c.box.y + c.box.height / 2,
  });
  await dwell(page, rand(300, 800));
  log(`스레드 진입: "${c.title}"`);
  return c.permalink;
}

async function readThread(page: Page) {
  await page.waitForSelector("shreddit-comment", { timeout: 15_000 });
  const visited: { x: number; y: number; label: string }[] = [];
  const start = Date.now();
  const budget = rand(20_000, 40_000);
  while (Date.now() - start < budget) {
    const paras = page.locator("shreddit-comment p");
    const n = await paras.count();
    const cands: { box: Box; text: string }[] = [];
    for (let i = 0; i < Math.min(n, 60); i++) {
      const el = paras.nth(i);
      const box = await el.boundingBox().catch(() => null);
      if (!box || box.y < 80 || box.y > VIEW.height - 140 || box.height < 16) continue;
      const text = ((await el.textContent()) ?? "").trim().slice(0, 80).replace(/\s+/g, " ");
      if (text.length > 10) cands.push({ box, text });
    }
    if (!cands.length) {
      await scrollBy(page, rand(200, 500));
      continue;
    }
    const c = pick(cands);
    await glide(page, {
      x: c.box.x + rand(20, Math.max(30, Math.min(c.box.width, 400) * 0.8)),
      y: c.box.y + rand(6, Math.max(8, Math.min(c.box.height, 60))),
    });
    const readMs = Math.min(6000, 600 + c.text.length * rand(18, 35));
    log(`읽는 중 ${Math.round(readMs)}ms: "${c.text}"`);
    await dwell(page, readMs);
    visited.push({ x: cur.x, y: cur.y, label: c.text.slice(0, 28) });

    if (visited.length > 2 && Math.random() < 0.25) {
      const back = pick(visited.slice(0, -1));
      log(`되새김질 → "${back.label}…"`);
      await scrollBy(page, -rand(300, 700));
      await sleep(rand(200, 500));
      await glide(
        page,
        { x: back.x + rand(-10, 10), y: Math.max(120, back.y - rand(0, 80)) },
        0.7,
      );
      await dwell(page, rand(2000, 5000));
    }
    await scrollBy(page, rand(150, 450));
  }
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: VIEW, locale: "en-US" });
  const page = await ctx.newPage();
  await injectCursor(page);

  log(`www.reddit.com/r/${SUB} 로 이동 (로그인 없음)`);
  await page.goto(`https://www.reddit.com/r/${SUB}/`, { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await shot(page, "feed");

  const deadline = Date.now() + DURATION_MS;
  while (Date.now() < deadline) {
    const permalink = await feedWander(page);
    if (permalink) {
      await page.mouse.click(cur.x, cur.y);
      await page
        .waitForURL(`**${permalink}**`, { timeout: 8000 })
        .catch(async () => {
          log("클릭 항법 실패 → 직접 이동");
          await page.goto(`https://www.reddit.com${permalink}`, {
            waitUntil: "domcontentloaded",
          });
        });
      try {
        await readThread(page);
        await shot(page, "thread");
      } catch (e) {
        log(`스레드 읽기 중단: ${(e as Error).message.split("\n")[0]}`);
      }
      log("피드로 복귀");
      await page.goBack().catch(() => {});
      await page.waitForSelector("shreddit-post", { timeout: 10_000 }).catch(() => {});
      await sleep(1000);
    } else {
      log("피드에서 글을 찾지 못함 — 새로고침");
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      await sleep(2000);
    }
  }

  await shot(page, "final");
  await browser.close();
  log("스파이크 1 종료");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
