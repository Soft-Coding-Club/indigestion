import type { Page } from "playwright";
import { path as cursorPath } from "ghost-cursor";

export type Vec = { x: number; y: number };
export type Box = Vec & { width: number; height: number };
export type ReadEvent = { text: string; box: Box };
export type NextTarget = { threadUrl?: string; feedUrl?: string; why?: string } | null;
export type Movement = "배회" | "정독" | "폭식" | "되새김" | "침묵";
export type MotorApi = {
  glide: (to: Vec, speed?: number) => Promise<void>;
  dwell: (ms: number) => Promise<void>;
  scrollBy: (dy: number) => Promise<void>;
  readonly cur: Vec;
};
export type Hooks = {
  onEnterThread?: (title: string) => void | Promise<void>;
  onReading?: (ev: ReadEvent) => void | Promise<void>;
  onRead: (ev: ReadEvent) => Promise<{ ruminate?: boolean; abort?: boolean }>;
  onMotor?: (motor: { readonly cur: Vec }) => void;
  decideNext?: () => Promise<NextTarget>;
  nextMovement?: () => Promise<{ name: Movement; durMs: number }>;
  onMovement?: (name: Movement) => void | Promise<void>;
  onGulp?: (ev: ReadEvent) => void;
  onRuminate?: (motor: MotorApi, durMs: number) => Promise<void>;
  // 이 피드에서 아직 안 읽은 글이 하나도 없다 — 다른 게시판/정렬로 옮겨달라는 요청
  onExhausted?: () => Promise<boolean>;
  log?: (msg: string) => void;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function makeMotor(page: Page, view: { width: number; height: number }) {
  let cur: Vec = { x: view.width / 2, y: view.height / 2 };

  async function glide(to: Vec, speed = 1) {
    const pts = cursorPath(cur, to) as Vec[];
    for (const p of pts) {
      await page.mouse.move(p.x, p.y);
      await sleep(rand(4, 12) / speed);
    }
    cur = { ...to };
  }

  async function dwell(ms: number) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      await page.mouse.move(cur.x + rand(-2, 2), cur.y + rand(-1.5, 1.5));
      await sleep(rand(160, 420));
    }
  }

  async function scrollBy(dy: number) {
    const steps = Math.max(6, Math.round(Math.abs(dy) / 60));
    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 1 : i / (steps - 1);
      const ease = Math.sin(t * Math.PI);
      await page.mouse.wheel(0, (dy / steps) * (0.5 + ease));
      await sleep(rand(30, 90));
    }
  }

  return {
    glide,
    dwell,
    scrollBy,
    get cur() {
      return cur;
    },
  };
}

type Motor = ReturnType<typeof makeMotor>;

async function visibleTitleBoxes(page: Page, view: { width: number; height: number }) {
  const posts = page.locator("shreddit-post");
  const n = await posts.count();
  const out: { box: Box; title: string; permalink: string }[] = [];
  for (let i = 0; i < Math.min(n, 20); i++) {
    const post = posts.nth(i);
    const titleEl = post.locator('a[slot="title"]').first();
    if ((await titleEl.count()) === 0) continue;
    const box = await titleEl.boundingBox().catch(() => null);
    if (!box || box.y < 60 || box.y > view.height - 100) continue;
    const title = ((await post.getAttribute("post-title")) ?? "").slice(0, 70);
    const permalink = (await post.getAttribute("permalink")) ?? "";
    if (permalink) out.push({ box, title, permalink });
  }
  return out;
}

// 요소를 편안한 독서 높이(화면 상단 1/3)로 데려온다
async function bringIntoView(motor: Motor, getBox: () => Promise<Box | null>, view: { height: number }) {
  for (let i = 0; i < 12; i++) {
    const box = await getBox();
    if (!box) return null;
    if (box.y > view.height * 0.58) {
      await motor.scrollBy(Math.min(320, box.y - view.height * 0.4));
      await sleep(rand(90, 220));
    } else if (box.y < 70) {
      await motor.scrollBy(-160);
      await sleep(rand(90, 200));
    } else return box;
  }
  return await getBox();
}

// 스레드 안이면 피드로 물러난다
async function backToFeed(page: Page) {
  if (page.url().includes("/comments/")) {
    await page.goBack().catch(() => {});
    await page.waitForSelector("shreddit-post", { timeout: 10_000 }).catch(() => {});
    await sleep(800);
  }
}

// Ⅰ 배회 — 먹지 않고 어슬렁거린다
async function wander(
  page: Page,
  view: { width: number; height: number },
  motor: Motor,
  durMs: number,
) {
  await backToFeed(page);
  const end = Date.now() + durMs;
  while (Date.now() < end) {
    const cands = await visibleTitleBoxes(page, view);
    if (cands.length) {
      const c = pick(cands);
      await motor.glide({
        x: c.box.x + rand(10, Math.max(20, c.box.width * 0.6)),
        y: c.box.y + c.box.height / 2,
      });
      await motor.dwell(rand(700, 1800));
    }
    await motor.scrollBy(rand(150, 420));
    await sleep(rand(400, 1100));
  }
}

// Ⅲ 폭식 — 씹지 않고 삼킨다
async function binge(
  page: Page,
  view: { width: number; height: number },
  motor: Motor,
  hooks: Hooks,
  durMs: number,
  deadline: number,
) {
  const end = Math.min(Date.now() + durMs, deadline);
  while (Date.now() < end) {
    await motor.scrollBy(rand(450, 850));
    await sleep(rand(120, 320));
    const sel = page.url().includes("/comments/")
      ? "shreddit-comment p"
      : 'shreddit-post a[slot="title"]';
    const els = page.locator(sel);
    const n = await els.count().catch(() => 0);
    if (n) {
      const el = els.nth(Math.floor(Math.random() * Math.min(n, 30)));
      const box = await el.boundingBox().catch(() => null);
      const text = ((await el.textContent().catch(() => "")) ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 200);
      if (box && box.y > 40 && box.y < view.height - 40 && text.length > 15) {
        await motor.glide(
          { x: box.x + rand(10, Math.max(20, box.width * 0.5)), y: box.y + box.height / 2 },
          1.7,
        );
        hooks.onGulp?.({ text, box });
        await sleep(rand(250, 550));
      }
    }
    if (Math.random() < 0.25) {
      if (page.url().includes("/comments/")) await backToFeed(page);
      else {
        const links = await page
          .$$eval('a[href*="/comments/"]', (as) =>
            as.map((a) => a.getAttribute("href") ?? "").filter((h) => h.includes("/comments/")).slice(0, 10),
          )
          .catch(() => [] as string[]);
        if (links.length) {
          await page
            .goto(new URL(pick(links), "https://www.reddit.com").toString(), { waitUntil: "domcontentloaded" })
            .catch(() => {});
          await sleep(900);
        }
      }
    }
  }
}

// Ⅴ 침묵 — 커서가 거의 죽은 듯 떠 있다
async function stillness(motor: Motor, durMs: number) {
  const end = Date.now() + durMs;
  while (Date.now() < end) {
    await motor.glide(
      { x: motor.cur.x + rand(-40, 40), y: motor.cur.y + rand(-25, 25) },
      0.3,
    );
    await sleep(rand(2500, 5000));
  }
}

// Ⅱ 정독 — 한 스레드를 제대로 먹는다
async function studyOne(
  page: Page,
  view: { width: number; height: number },
  motor: Motor,
  hooks: Hooks,
  seen: Set<string>,
  deadline: number,
  log: (m: string) => void,
) {
  // 기억이 끌어당기는 곳이 있는가
  const target = (await hooks.decideNext?.().catch(() => null)) ?? null;
  if (target?.threadUrl) {
    if (target.why) log(`기억을 따라간다: ${target.why}`);
    const tu = target.threadUrl.includes("?") ? target.threadUrl : `${target.threadUrl}?sort=controversial`;
    await page.goto(tu, { waitUntil: "domcontentloaded" }).catch(() => {});
    await sleep(2000);
    const title = ((await page.locator('h1[slot="title"]').first().textContent().catch(() => "")) ?? "").trim();
    log(`스레드 진입(기억): "${title.slice(0, 60)}"`);
    await hooks.onEnterThread?.(title);
    await readThread(page, view, motor, hooks, deadline).catch((e) =>
      log(`읽기 중단: ${(e as Error).message.split("\n")[0]}`),
    );
    return;
  }
  if (target?.feedUrl) {
    await page.goto(target.feedUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
    await sleep(2000);
  }
  await backToFeed(page);

  let cands = await visibleTitleBoxes(page, view);
    let guard = 0;
    while (cands.length === 0 && guard < 5) {
      await motor.scrollBy(350);
      await sleep(600);
      cands = await visibleTitleBoxes(page, view);
      guard += 1;
    }
    if (cands.length === 0) {
      log("피드 비어있음 — 새로고침");
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      await sleep(2500);
      return;
    }
    const passes = Math.round(rand(1, 3));
    for (let i = 0; i < passes && cands.length; i++) {
      const c = pick(cands);
      await motor.glide({
        x: c.box.x + rand(10, Math.max(20, c.box.width * 0.6)),
        y: c.box.y + c.box.height / 2,
      });
      await motor.dwell(rand(500, 1400));
      if (Math.random() < 0.4) {
        await motor.scrollBy(rand(120, 380));
        cands = await visibleTitleBoxes(page, view);
      }
    }
    if (!cands.length) return;
    // 읽은 스레드는 다시 들어가지 않는다.
    // 예전엔 여기서 한 번 스크롤하고 돌아갔는데, 그러면 피드 첫 화면만 맴돌다
    // 되새김 루프에 갇힌다(8/31 녹화 실패의 원인). 이제는 끝까지 내려가 보고,
    // 그래도 없으면 다른 게시판으로 옮긴다.
    let unseen = cands.filter((c) => !seen.has(c.permalink));
    for (let dive = 0; unseen.length === 0 && dive < 8; dive++) {
      await motor.scrollBy(rand(600, 900));
      await sleep(700);
      cands = await visibleTitleBoxes(page, view);
      unseen = cands.filter((c) => !seen.has(c.permalink));
    }
    if (unseen.length === 0) {
      log("이 피드는 다 먹었다 — 다른 곳으로");
      const moved = await hooks.onExhausted?.().catch(() => false);
      if (!moved) await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      await sleep(2000);
      return;
    }
    const chosen = pick(unseen);
    seen.add(chosen.permalink);
    await motor.glide({
      x: chosen.box.x + rand(10, Math.max(20, chosen.box.width * 0.5)),
      y: chosen.box.y + chosen.box.height / 2,
    });
    await motor.dwell(rand(400, 900));
    log(`스레드 진입: "${chosen.title}"`);
    await hooks.onEnterThread?.(chosen.title);
    // 기본(best) 정렬은 위로와 농담을 위로 올린다. controversial이라야 경멸이 먼저 온다.
    await page.mouse.click(motor.cur.x, motor.cur.y);
    await page
      .goto(`https://www.reddit.com${chosen.permalink}?sort=controversial`, { waitUntil: "domcontentloaded" })
      .catch(() => {});
    await sleep(1200);

    await readThread(page, view, motor, hooks, deadline).catch((e) =>
      log(`읽기 중단: ${(e as Error).message.split("\n")[0]}`),
    );

    log("피드로 복귀");
    await page.goBack().catch(() => {});
    await page.waitForSelector("shreddit-post", { timeout: 10_000 }).catch(() => {});
    await sleep(1000);
}

// 악장의 순환 — 몸의 상태가 다음 악장을 고른다
export async function browseLoop(
  page: Page,
  view: { width: number; height: number },
  hooks: Hooks,
  deadlineMs: number,
) {
  const motor = makeMotor(page, view);
  hooks.onMotor?.(motor);
  const log = hooks.log ?? (() => {});
  const deadline = deadlineMs > 0 ? Date.now() + deadlineMs : Infinity;
  const seen = new Set<string>();

  while (Date.now() < deadline) {
    const mv = (await hooks.nextMovement?.().catch(() => null)) ?? { name: "정독" as Movement, durMs: 0 };
    await hooks.onMovement?.(mv.name);
    if (mv.name !== "정독") log(`악장: ${mv.name} (${Math.round(mv.durMs / 1000)}초)`);
    try {
      if (mv.name === "침묵") await stillness(motor, mv.durMs);
      else if (mv.name === "배회") await wander(page, view, motor, mv.durMs);
      else if (mv.name === "폭식") await binge(page, view, motor, hooks, mv.durMs, deadline);
      else if (mv.name === "되새김") await hooks.onRuminate?.(motor, mv.durMs);
      else await studyOne(page, view, motor, hooks, seen, deadline, log);
    } catch (e) {
      log(`악장 중단: ${(e as Error).message.split("\n")[0]}`);
      await sleep(1500);
    }
  }
}

// 꼼꼼히 읽는다: 본문 먼저, 그다음 댓글을 위에서 아래로
async function readThread(
  page: Page,
  view: { width: number; height: number },
  motor: Motor,
  hooks: Hooks,
  deadline: number,
) {
  await page.waitForSelector("shreddit-comment", { timeout: 15_000 });
  const budget = rand(100_000, 160_000);
  const start = Date.now();
  const over = () => Date.now() - start > budget || Date.now() > deadline;

  // 1. 글 본문은 빠르게 훑는다 — 식사는 댓글이다
  const title = page.locator('h1[slot="title"]').first();
  if ((await title.count()) > 0) {
    const box = await title.boundingBox().catch(() => null);
    if (box) {
      await motor.glide({ x: box.x + rand(20, box.width * 0.5), y: box.y + box.height / 2 });
      await motor.dwell(rand(900, 1600));
    }
  }
  const bodyParas = page.locator('div[slot="text-body"] p');
  const nBody = Math.min(await bodyParas.count(), 3);
  let bodyText = "";
  let bodyBox: Box | null = null;
  for (let i = 0; i < nBody && !over(); i++) {
    const el = bodyParas.nth(i);
    const box = await bringIntoView(motor, () => el.boundingBox().catch(() => null), view);
    if (!box) continue;
    const text = ((await el.textContent().catch(() => "")) ?? "").trim().replace(/\s+/g, " ");
    if (text.length < 20) continue;
    if (!bodyBox) bodyBox = box;
    bodyText += (bodyText ? " " : "") + text;
    await motor.glide({ x: box.x + rand(20, Math.max(30, box.width * 0.7)), y: box.y + rand(4, Math.max(6, box.height - 4)) });
    await motor.dwell(Math.min(2500, 300 + text.length * rand(6, 12)));
  }
  // 본문도 삼킨다 — 부모의 말이 곧 독이다 (insaneparents류: 본문=막말 원문)
  if (bodyText.length >= 40 && bodyBox && !over()) {
    const btext = bodyText.slice(0, 400);
    await hooks.onReading?.({ text: btext, box: bodyBox });
    const d = await hooks.onRead({ text: btext, box: bodyBox });
    if (d.abort) return;
  }

  // 2. 댓글을 순서대로 — 문단 하나하나, 짧은 것도 눈길은 준다
  const visited: { idx: number; label: string }[] = [];
  let idx = 0;
  let stuck = 0;
  while (!over() && idx < 16 && stuck < 4) {
    const comments = page.locator("shreddit-comment");
    const count = await comments.count();
    if (idx >= count) {
      await motor.scrollBy(rand(250, 450));
      await sleep(600);
      stuck += 1;
      continue;
    }
    stuck = 0;
    const comment = comments.nth(idx);
    const paras = comment.locator("p");
    const nP = Math.min(await paras.count().catch(() => 0), 8);
    if (nP === 0) {
      idx += 1;
      continue;
    }

    // 전체 텍스트를 먼저 모은다 — 무대에는 댓글 전문이 올라가야 한다
    const paraTexts: string[] = [];
    for (let j = 0; j < nP; j++) {
      const t = ((await paras.nth(j).textContent().catch(() => "")) ?? "")
        .trim()
        .replace(/\s+/g, " ");
      if (t.length >= 2) paraTexts.push(t);
    }
    const text = paraTexts.join(" ").slice(0, 700);
    if (text.length === 0) {
      idx += 1;
      continue;
    }

    const first = paras.first();
    const box0 = await bringIntoView(motor, () => first.boundingBox().catch(() => null), view);
    if (!box0) {
      idx += 1;
      continue;
    }
    await motor.glide({
      x: box0.x + rand(20, Math.max(30, Math.min(box0.width, 500) * 0.8)),
      y: box0.y + rand(6, Math.max(8, Math.min(box0.height, 60))),
    });
    // 아주 짧은 것은 눈길만 주고 넘어간다 — 그래도 건너뛰지는 않는다
    if (text.length < 15) {
      await motor.dwell(rand(300, 700));
      idx += 1;
      continue;
    }
    // 스크롤 관성이 잦아든 뒤 다시 잰다 — 스포트라이트가 어긋나지 않게
    const box = (await first.boundingBox().catch(() => null)) ?? box0;
    await hooks.onReading?.({ text, box });

    // 커서는 문단마다 내려가며 정독한다
    for (let j = 0; j < nP && !over(); j++) {
      const el = paras.nth(j);
      const b2 = await bringIntoView(motor, () => el.boundingBox().catch(() => null), view);
      if (!b2) continue;
      const tl = (paraTexts[Math.min(j, paraTexts.length - 1)] ?? "").length || 30;
      await motor.glide({
        x: b2.x + rand(20, Math.max(30, Math.min(b2.width, 500) * 0.8)),
        y: b2.y + rand(6, Math.max(8, Math.min(b2.height, 60))),
      });
      await motor.dwell(Math.min(6_500, 350 + tl * rand(11, 18)));
    }
    visited.push({ idx, label: text.slice(0, 28) });

    const directive = await hooks.onRead({ text, box });
    // 게운 몸은 식탁을 떠난다
    if (directive.abort) return;

    // 되새김질: 걸리는 말이 있으면 이미 읽은 자리로 돌아간다
    if (directive.ruminate && visited.length > 1 && !over()) {
      const back = pick(visited.slice(0, -1));
      hooks.log?.(`되새김질 → "${back.label}…"`);
      const bp = page.locator("shreddit-comment").nth(back.idx).locator("p").first();
      const bbox = await bringIntoView(motor, () => bp.boundingBox().catch(() => null), view);
      if (bbox) {
        const btext = ((await bp.textContent().catch(() => "")) ?? "").trim().slice(0, 400).replace(/\s+/g, " ");
        await motor.glide({ x: bbox.x + rand(20, Math.max(30, bbox.width * 0.6)), y: bbox.y + rand(6, Math.max(8, bbox.height / 2)) }, 0.7);
        await hooks.onReading?.({ text: btext, box: bbox });
        await motor.dwell(rand(2000, 3500));
      }
    }

    idx += 1;
    await sleep(rand(200, 600));
  }
}
