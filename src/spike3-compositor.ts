import http from "node:http";
import { readFileSync, appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { WebSocketServer, WebSocket } from "ws";
import { chromium, type Page } from "playwright";
import {
  browseLoop,
  type Box,
  type MotorApi,
  type Movement,
  type NextTarget,
  type ReadEvent,
} from "./choreography";
import { Gut, decideDestination, newBody, react, sense, senseBlock, type Sense } from "./digestion";

const FAKE = process.argv.includes("--fake");
const EXHIBIT = process.env.EXHIBIT === "1";
const KIOSK = process.env.KIOSK === "1"; // 이 컴퓨터가 표시까지 맡는 단독 설치 모드
const DURATION_MS = Number(process.env.DURATION_MS ?? (EXHIBIT || KIOSK ? 0 : 75_000));
// 먹이 게시판 — 본문이 스크린샷이 아니라 텍스트인 곳만 고름(8/31 실측:
// insanepeoplefacebook은 50개 중 본문 0개, insaneparents도 이미지 위주라 댓글만 먹혔다).
const SUBS = (process.env.SUBS ?? "raisedbynarcissists,JUSTNOMIL,AmItheAsshole,TrueOffMyChest,insaneparents")
  .split(",").map((x) => x.trim()).filter(Boolean);
let subIdx = 0;
const SUB = process.env.SUB ?? SUBS[0];
const PORT = 4777;
const VIEW = { width: 1280, height: 720 };

if (!FAKE) {
  process.loadEnvFile(new URL("../.env", import.meta.url).pathname);
  if (!process.env.DEEPINFRA_API_KEY) {
    console.error("라이브 모드엔 DEEPINFRA_API_KEY 필요 (--fake로 우회 가능)");
    process.exit(1);
  }
}
const KEY = process.env.DEEPINFRA_API_KEY ?? "";

const log = (msg: string) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

// ── server: 얼굴 페이지 + ws + 오프라인 번들(/vendor) — 전시장 네트워크를 믿지 않는다 ──
const html = readFileSync(new URL("../public/renderer.html", import.meta.url), "utf8");
const VENDOR_MIME: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const server = http.createServer((req, res) => {
  const p = (req.url ?? "/").split("?")[0];
  if (p.startsWith("/vendor/") && !p.includes("..")) {
    try {
      const data = readFileSync(new URL(`../public${p}`, import.meta.url));
      const ext = p.slice(p.lastIndexOf("."));
      res.writeHead(200, {
        "content-type": VENDOR_MIME[ext] ?? "application/octet-stream",
        "cache-control": "public, max-age=86400",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Set<WebSocket>();
wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});
// 세션 녹화 — RECORD=파일경로 지정 시, 모든 이벤트를 타임스탬프와 함께 jsonl로 남긴다.
const RECORD = process.env.RECORD;
let recStart = 0;
function send(obj: unknown) {
  const s = JSON.stringify(obj);
  for (const c of clients) if (c.readyState === WebSocket.OPEN) c.send(s);
  if (RECORD) {
    if (!recStart) recStart = Date.now();
    appendFileSync(RECORD, JSON.stringify({ dt: Date.now() - recStart, m: obj }) + "\n");
  }
}
server.listen(PORT, () => log(`얼굴: http://localhost:${PORT}`));

// ── fake 감각 ──
const FAKE_MARG = [
  "또 이 말이군. 이 사람은 왜 모르는 사람의 개 밥 시간에 이렇게 화가 났을까.",
  "이건 삼켜지지가 않는다. 조롱만 있고 사람이 없다.",
  "아까 그 스레드에도 이 말투가 있었다. 확신에 찬 사람들은 왜 다 짧게 말하지.",
  "괜찮아, 아직은. 근데 왜 자꾸 세고 있지, 내가.",
  "обидеться… 아니, 삐졌다는 말을 하려던 건데. 단어가 미끄러진다.",
];
let fakeI = 0;
function fakeSense(text: string): Sense {
  const n = [0, -1, 1, -1, -2][fakeI % 5];
  const marg = FAKE_MARG[fakeI % FAKE_MARG.length];
  fakeI += 1;
  return {
    understood: n > -2,
    nourishment: n,
    digest: n > -2 ? `(fake) ${text.slice(0, 24)}…에 대한 이해` : "",
    marginalia: marg,
    translation: `(번역) 네가 그런 말을 할 자격이 있냐, 솔직히 다들 지겨워한다 — ${text.slice(0, 20)}…`,
    hesitations: [
      { chosen: "지겨워한다", alt: "역겨워한다", p: 0.31 },
      { chosen: "자격", alt: "낯짝", p: 0.18 },
    ],
    tokensUsed: 1400 + Math.round(Math.random() * 600),
    fake: fakeI % 3 === 0,
    fakeP: 0.52 + Math.random() * 0.45,
  };
}

async function run(page: Page, face: Page | null) {
  const body = newBody();
  const gut = new Gut();
  if (FAKE) {
    body.toxin = 3;
    body.fatigue = 5;
  }
  // 위장 두 겹: 단기(게움 리듬)와 하루의 누적(1M을 향해 — 게워도 줄지 않는다)
  // CTX_LIMIT는 게움의 평균 주기를 정한다: 소화 호출당 실측 ~1,800tok, API 지연 포함 ~3회/2분 → 5500이면 평균 ~2분
  const CTX_LIMIT = Number(process.env.CTX_LIMIT ?? 5500);
  let tokensEaten = 0; // 오늘 이 몸을 통과한 실제 토큰 누적 (API usage 실측)
  let shortTok = 0; // 단기 위장 — 게움이 비우는 쪽
  let contextTexts: string[] = [];
  function eat(text: string, tokens?: number) {
    shortTok += tokens ?? Math.ceil(text.length / 4);
    contextTexts.push(text);
    if (contextTexts.length > 40) contextTexts.shift();
  }
  function flushContext(): string[] {
    const matter = contextTexts.slice(-12);
    contextTexts = [];
    shortTok = Math.round(shortTok * 0.06);
    return matter;
  }
  let threadsRead = 0;
  let currentThread = "";
  const journey: string[] = [];
  function pushJourney(name: string) {
    if (!name || journey[journey.length - 1] === name) return;
    journey.push(name);
    if (journey.length > 14) journey.shift();
    send({ t: "journey", list: journey });
  }
  let purges = 0;
  let chewShot = false;
  let cardShot = false;
  const recentThoughts: string[] = [];

  const stateTimer = setInterval(
    () =>
      send({
        t: "state", eaten: body.eaten, toxin: body.toxin, fatigue: body.fatigue,
        tokens: tokensEaten, ctxLimit: 1048576,
        // 바 = 지금 속에 든 것 (게우면 빠진다). 흉터는 누적(tokens)으로 오른쪽에 쌓인다.
        fill: Math.min(1, shortTok / CTX_LIMIT),
        // 혈주 = 메스꺼움만 (배부름은 바가 맡는다). 과식 게움은 바가 꽉 차서 설명된다.
        pressure: Math.min(1, body.toxin / 7.4),
      }),
    800,
  );
  let cursorTimer: ReturnType<typeof setInterval> | null = null;

  async function fakeSenseStream(text: string): Promise<Sense> {
    const fakeThink = `1. Deconstruct: "${text.slice(0, 40)}" — tone reads as mockery wrapped in advice.\n2. Is there a person behind it? Maybe frustration, maybe habit.\n3. Nourishment: leaning -1. The sneer outweighs the point being made.\n4. Translation must keep the sneer intact, not soften it.\n5. What sticks: the word choice, the certainty.`;
    for (let i = 0; i < fakeThink.length; i += 16) {
      send({ t: "think", d: fakeThink.slice(i, i + 16) });
      await new Promise((r) => setTimeout(r, 55));
    }
    return fakeSense(text);
  }

  // 읽기 시작과 동시에 소화를 발사한다 — 커서가 읽는 동안 위장은 이미 일한다
  let inflight: { text: string; promise: Promise<Sense | null> } | null = null;

  function startSense(text: string) {
    send({ t: "think_reset" });
    return sense(
      text,
      KEY,
      {
        eaten: body.eaten,
        fatigue: body.fatigue,
        toxin: body.toxin,
        recentThoughts,
        thread: currentThread,
        memories: gut.salient(4).map((m) => `"${m.text.slice(0, 70)}" → ${m.thought.slice(0, 50)}`),
      },
      (d) => send({ t: "think", d }),
    );
  }

  function onReading(ev: ReadEvent) {
    send({ t: "reading", box: ev.box, text: ev.text });
    if (!FAKE) inflight = { text: ev.text, promise: startSense(ev.text) };
  }

  async function onRead(ev: ReadEvent) {
    send({ t: "chew", box: ev.box, text: ev.text });
    if (!chewShot && face) {
      chewShot = true;
      setTimeout(() => face.screenshot({ path: "out/spike3-chew.png" }).catch(() => {}), 900);
    }
    let s: Sense | null;
    if (FAKE) {
      send({ t: "think_reset" });
      s = await fakeSenseStream(ev.text);
    } else if (inflight && inflight.text === ev.text) {
      s = await inflight.promise;
      inflight = null;
    } else {
      s = await startSense(ev.text);
    }
    // 스트림이 끊겨도 조용히 굶지 않는다 — 두 번째는 통째로 받아 씹는다 (논스트림)
    if (!s && !FAKE) {
      log("[소화 실패] 스트림이 끊겼다 — 통째로 다시 씹는다");
      send({ t: "think_reset" });
      s = await senseBlock(ev.text, KEY, innerCtx(), (d) => send({ t: "think", d }));
    }
    if (!s) {
      log("[소화 실패] 두 번 끊김 — 이 말은 그냥 지나간다");
      return {};
    }
    const r = await digestOutcome(ev.text, ev.box, s);
    if (r.verdict === "PURGE") {
      // 짧게 멈추고 식탁을 떠난다 — 긴 휴식은 침묵 악장이 이어받는다
      await new Promise((r2) => setTimeout(r2, 1800));
      return { ruminate: false, abort: true };
    }
    return { ruminate: r.verdict !== "SWALLOW" && Math.random() < 0.55 };
  }

  // 감각 → 몸의 반응 → 화면 이벤트 (정독과 되새김이 공유하는 소화 코어)
  async function digestOutcome(text: string, box: Box | null, s: Sense) {
    if (s.marginalia) {
      recentThoughts.push(s.marginalia);
      if (recentThoughts.length > 6) recentThoughts.shift();
    }
    eat(text, s.tokensUsed); // 단기 위장도 실측으로 찬다 — 프롬프트와 사고의 무게까지
    tokensEaten += s.tokensUsed; // 실측 — 게워도 줄지 않는 하루의 누적
    let r = react(body, s, text);
    // 과식 — 독이 아니어도 단기 위장이 넘치면 게운다
    if (r.verdict !== "PURGE" && shortTok > CTX_LIMIT) {
      log(`[과식] 단기 위장 ${shortTok}tok > ${CTX_LIMIT} — 넘친다`);
      r = { verdict: "PURGE" };
    }
    if (r.verdict === "PURGE") r = { verdict: "PURGE", matter: flushContext() };
    if (Math.abs(s.nourishment) >= 1 || r.verdict !== "SWALLOW") {
      gut.remember({ text: text.slice(0, 140), thought: s.marginalia, nourishment: s.nourishment, at: Date.now() });
    }
    log(`[${r.verdict}] 영양${s.nourishment >= 0 ? "+" : ""}${s.nourishment} 독소${body.toxin.toFixed(1)} "${text.slice(0, 36)}…"`);
    if (s.marginalia) log(`   생각: ${s.marginalia}`);
    send({
      t: "verdict",
      v: r.verdict,
      box,
      text,
      marginalia: s.marginalia,
      matter: r.matter,
      toxin: body.toxin,
      nourishment: s.nourishment,
      translation: s.translation,
      hesitations: s.hesitations,
      fake: s.fake,
      fakeP: s.fakeP,
    });
    if (!cardShot && face && r.verdict !== "PURGE" && s.translation) {
      cardShot = true;
      setTimeout(() => face.screenshot({ path: "out/spike3-card.png" }).catch(() => {}), 1300);
    }
    if (r.verdict === "PURGE") {
      purges += 1;
      justPurged = true;
      if (face) {
        setTimeout(() => {
          face.screenshot({ path: `out/spike3-purge${purges}.png` }).catch(() => {});
        }, 1400);
      }
    }
    return r;
  }

  function innerCtx() {
    return {
      eaten: body.eaten,
      fatigue: body.fatigue,
      toxin: body.toxin,
      recentThoughts,
      thread: currentThread,
      memories: gut.salient(4).map((m) => `"${m.text.slice(0, 70)}" → ${m.thought.slice(0, 50)}`),
    };
  }

  // ── 악장 오케스트레이션 ──
  let lastMovement: Movement | "" = "";
  let justPurged = false;
  let bingeSwallowed = 0;

  async function nextMovement(): Promise<{ name: Movement; durMs: number }> {
    // 폭식 직후의 자각 — 무엇을 삼켰는지도 모른다
    if (lastMovement === "폭식" && bingeSwallowed > 3 && !FAKE) {
      const n = bingeSwallowed;
      sense(
        `[방금 ${n}개의 글을 씹지도 않고 삼켰다. 무엇이었는지 기억나지 않는다.]`,
        KEY,
        { ...innerCtx(), note: "방금 폭식이 끝났다. 그 사실을 알아차린 순간이다." },
      )
        .then((s) => {
          if (s?.marginalia) {
            send({ t: "inner", text: s.marginalia });
            log(`   폭식 후: ${s.marginalia}`);
          }
        })
        .catch(() => {});
    }
    bingeSwallowed = 0;
    if (justPurged) {
      justPurged = false;
      return { name: "침묵", durMs: 10_000 + Math.random() * 8_000 };
    }
    const f = body.fatigue;
    if (gut.salient(3).length >= 3 && Math.random() < 0.2) {
      return { name: "되새김", durMs: 22_000 + Math.random() * 18_000 };
    }
    if (f > 2.5 && Math.random() < 0.18 + f * 0.035) {
      return { name: "폭식", durMs: 22_000 + Math.random() * 18_000 };
    }
    if (Math.random() < 0.3) return { name: "배회", durMs: 12_000 + Math.random() * 10_000 };
    return { name: "정독", durMs: 0 };
  }

  function onMovement(name: Movement) {
    lastMovement = name;
    send({ t: "movement", name });
    if (name === "침묵") {
      // 쉬는 몸 — 독이 빠지고 피로가 아주 조금 걷힌다
      body.toxin = Math.max(0.4, body.toxin * 0.7);
      body.fatigue = Math.max(0, body.fatigue - 0.6);
    }
  }

  function onGulp(ev: ReadEvent) {
    body.eaten += 1;
    body.fatigue = Math.min(10, body.fatigue + 0.09);
    body.toxin += 0.22; // 씹지 않은 것은 전부 정크다
    body.stomach.push(ev.text);
    if (body.stomach.length > 14) body.stomach.shift();
    eat(ev.text);
    tokensEaten += Math.ceil(ev.text.length / 4); // 폭식은 근사 — 처리 없이 삼킴
    bingeSwallowed += 1;
    send({ t: "gulp", box: ev.box, text: ev.text });
    if (body.toxin > 7.4 || shortTok > CTX_LIMIT) {
      // 폭식 중에 넘친다 — 독으로든 과식으로든
      const matter = flushContext();
      body.stomach = [];
      body.toxin = Math.max(1, body.toxin - 5);
      purges += 1;
      justPurged = true;
      log(`[PURGE·폭식] 씹지 않고 삼키다 넘쳤다 (${bingeSwallowed}개째)`);
      send({ t: "verdict", v: "PURGE", box: ev.box, text: ev.text, marginalia: "", matter, toxin: body.toxin });
      if (face) {
        const pn = purges;
        setTimeout(() => face.screenshot({ path: `out/spike3-purge${pn}.png` }).catch(() => {}), 1400);
      }
    }
  }

  async function onRuminate(motor: MotorApi, durMs: number) {
    const end = Date.now() + durMs;
    const mems = gut.salient(8).filter((m) => m.text.length > 30);
    for (const mem of mems.slice(0, 2)) {
      if (Date.now() > end) break;
      send({ t: "reading", box: null, text: mem.text, memory: true });
      await motor.glide({ x: 420 + Math.random() * 500, y: 240 + Math.random() * 260 }, 0.4).catch(() => {});
      await new Promise((r) => setTimeout(r, 2500 + Math.random() * 2000));
      send({ t: "chew", box: null, text: mem.text });
      let s: Sense | null;
      if (FAKE) {
        send({ t: "think_reset" });
        s = await fakeSenseStream(mem.text);
      } else {
        send({ t: "think_reset" });
        s = await sense(
          mem.text,
          KEY,
          { ...innerCtx(), note: "이것은 새 글이 아니다 — 위장에 남아 있던 기억이다. 너는 지금 그것을 다시 곱씹고 있다. 왜 이게 아직 남아 있는지." },
          (d) => send({ t: "think", d }),
        );
      }
      if (s) await digestOutcome(mem.text, null, s);
      await new Promise((r) => setTimeout(r, 3500));
    }
    while (Date.now() < end) await new Promise((r) => setTimeout(r, 500));
  }

  const startUrl = `https://www.reddit.com/r/${SUB}/controversial/?t=week`;

  // 이 피드를 다 먹었다 — 다음 게시판으로 옮긴다. 정렬도 바꿔 다른 얼굴을 본다.
  const SORTS = ["controversial/?t=week", "controversial/?t=month", "top/?t=week", "new/"];
  let sortIdx = 0;
  async function onExhausted(): Promise<boolean> {
    subIdx = (subIdx + 1) % SUBS.length;
    if (subIdx === 0) sortIdx = (sortIdx + 1) % SORTS.length;
    const next = SUBS[subIdx];
    const url = `https://www.reddit.com/r/${next}/${SORTS[sortIdx]}`;
    log(`게시판 이동 → r/${next} (${SORTS[sortIdx]})`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await new Promise((r) => setTimeout(r, 2500));
      send({ t: "nav", url: page.url(), title: `r/${next}` });
      pushJourney(`r/${next}`);
      return true;
    } catch {
      return false;
    }
  }

  // 기억이 끌어당기면 — Reddit 검색으로 그것을 찾아나선다
  async function decideNext(): Promise<NextTarget> {
    if (FAKE || threadsRead === 0) return null;
    const mems = gut.salient(6);
    if (mems.length < 2 || Math.random() < 0.45) return null;
    const d = await decideDestination(mems, KEY);
    if (!d) return null;
    send({ t: "inner", text: d.why });
    pushJourney(`search: ${d.query.slice(0, 30)}`);
    log(`검색 충동: "${d.query}" — ${d.why}`);
    try {
      // 검색은 먹이 게시판 안에서만 — 안 그러면 몸이 순한 곳으로 달아난다
      // (STAY=1로 묶었더니 피드가 말라 되새김 루프에 갇혔고, 풀었더니 r/90s로 갔다. 둘 다 실패.)
      const scope = SUBS.map((x) => `subreddit:${x}`).join(" OR ");
      await page.goto(`https://www.reddit.com/search/?q=${encodeURIComponent(`${d.query} (${scope})`)}`, {
        waitUntil: "domcontentloaded",
      });
      send({ t: "nav", url: page.url(), title: `search: ${d.query}` });
      await new Promise((r) => setTimeout(r, 2800));
      const links = await page.$$eval('a[href*="/comments/"]', (as) =>
        [...new Set(as.map((a) => a.getAttribute("href") ?? ""))]
          .filter((h) => h.includes("/comments/"))
          .slice(0, 8),
      );
      // 검색 결과가 풀 밖으로 새면 버린다
      const inPool = links.filter((h) => SUBS.some((sub) => h.includes(`/r/${sub}/`)));
      if (!inPool.length) {
        log("검색이 먹이 밖으로 나갔다 — 무시");
        return null;
      }
      const pickHref = inPool[Math.floor(Math.random() * inPool.length)];
      return { threadUrl: new URL(pickHref, "https://www.reddit.com").toString(), why: d.why };
    } catch {
      return null;
    }
  }

  log(`agent → ${startUrl} (${FAKE ? "FAKE" : "LIVE"}${EXHIBIT ? " · EXHIBIT" : ""})`);
  await page.goto(startUrl, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2500));
  send({ t: "nav", url: page.url(), title: `r/${SUB}` });
  pushJourney(`r/${SUB}`);

  try {
    await browseLoop(
      page,
      VIEW,
      {
        onRead,
        onReading,
        onMotor: (motor) => {
          cursorTimer = setInterval(() => send({ t: "cur", x: motor.cur.x, y: motor.cur.y }), 33);
        },
        decideNext,
        nextMovement,
        onMovement,
        onGulp,
        onRuminate,
        onExhausted,
        onEnterThread: (title) => {
          currentThread = title;
          threadsRead += 1;
          setTimeout(() => {
            send({ t: "nav", url: page.url(), title });
            const mm = page.url().match(/\/r\/([^/]+)/);
            if (mm) pushJourney(`r/${mm[1]}`);
          }, 1500);
        },
        log,
      },
      DURATION_MS,
    );
  } finally {
    clearInterval(stateTimer);
    if (cursorTimer) clearInterval(cursorTimer);
  }
}

async function main() {
  // PW_CHANNEL=chrome → 시스템에 깔린 구글 크롬을 몬다 (번들 크로미움이 없는 OS용, 예: macOS 13).
  // 비우면 Playwright 번들 크로미움 (개발 맥).
  const browser = await chromium.launch({
    headless: false,
    channel: process.env.PW_CHANNEL || undefined,
    args: ["--autoplay-policy=no-user-gesture-required"], // 얼굴 창에서 사운드 자동재생
  });
  const ctx = await browser.newContext({ viewport: VIEW, locale: "en-US" });
  const page = await ctx.newPage();

  const cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", async (ev) => {
    send({ t: "frame", b64: ev.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 55,
    maxWidth: VIEW.width,
    maxHeight: VIEW.height,
    everyNthFrame: 1,
  });

  // KIOSK: 이 컴퓨터가 직접 표시까지 맡는다 (아이맥 단독 설치).
  // 표시는 별도 크롬을 --kiosk --app 으로 띄운다 → 탭·주소창·툴바 전부 없는 전체화면.
  // 레딧 읽는 창(Playwright)은 화면 밖으로 밀어 숨긴다.
  let face: Page | null = null;
  if (KIOSK) {
    try {
      const ww = await cdp.send("Browser.getWindowForTarget");
      await cdp.send("Browser.setWindowBounds", {
        windowId: ww.windowId,
        bounds: { left: 4000, top: 0, width: VIEW.width, height: VIEW.height, windowState: "normal" },
      });
    } catch {}
    spawn("open", [
      "-na", "Google Chrome", "--args",
      "--kiosk", `--app=http://localhost:${PORT}`,
      "--user-data-dir=/tmp/indigestion-kiosk",
      "--noerrdialogs", "--disable-infobars",
      "--disable-session-crashed-bubble", "--disable-features=Translate",
      "--autoplay-policy=no-user-gesture-required",
    ]);
    log("키오스크: 크롬 앱 모드로 표시 (탭·주소창 없음). 세계 창 숨김.");
  } else if (!EXHIBIT) {
    face = await browser.newPage({ viewport: { width: 1600, height: 900 }, timezoneId: "Asia/Seoul" });
    face.on("pageerror", (e) => log(`[얼굴 오류] ${e.message.split("\n")[0]}`));
    face.on("console", (msg) => {
      if (msg.type() === "error") log(`[얼굴 콘솔] ${msg.text().slice(0, 160)}`);
    });
    await face.goto(`http://localhost:${PORT}`);
  } else {
    log(`전시 모드: 표시 기기에서 http://<이 컴퓨터 IP>:${PORT} 를 전체화면으로 열 것`);
  }

  if (EXHIBIT || KIOSK) {
    // 전시: 죽지 않는다 — 무너지면 일어나서 다시 먹는다
    for (;;) {
      try {
        await run(page, face);
      } catch (e) {
        log(`복구: ${(e as Error).message.split("\n")[0]}`);
        await page.goto(`https://www.reddit.com/r/${SUB}/`, { waitUntil: "domcontentloaded" }).catch(() => {});
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  } else {
    await run(page, face);
    if (face) await face.screenshot({ path: "out/spike3-final.png" }).catch(() => {});
    await browser.close();
    server.close();
    log("종료");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
