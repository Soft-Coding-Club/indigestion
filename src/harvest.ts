// 수확 — 읽기 안무 없이 후보 텍스트만 빠르게 긁는다.
// 전시/웹은 이제 "녹화된 실시간 재생"이 아니라 "미리 선별한 말뭉치 재생"이라
// 우선 재료를 많이 모아야 한다. 판정과 리듬은 뒤 단계(curate)에서 붙인다.
import { chromium } from "playwright";
import { appendFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";

const SUBS = (process.env.SUBS ?? "raisedbynarcissists,JUSTNOMIL,AmItheAsshole,TrueOffMyChest,insaneparents")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SORTS = ["controversial/?t=month", "controversial/?t=week", "top/?t=month", "new/"];
const OUT = process.env.OUT ?? "out/corpus-raw.jsonl";
const THREAD_BUDGET = Number(process.env.THREADS ?? 60);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 이미 긁은 스레드는 건너뛴다 (여러 번 돌려 누적할 수 있게)
const done = new Set<string>();
if (existsSync(OUT)) {
  for (const l of readFileSync(OUT, "utf8").split("\n")) {
    if (!l.trim()) continue;
    try { done.add(JSON.parse(l).permalink); } catch { /* 깨진 줄 무시 */ }
  }
}

async function main() {
  mkdirSync("out", { recursive: true });
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome", headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  // 첫 진입에서 Reddit의 JS 챌린지를 통과시켜 쿠키를 얻는다
  await page.goto(`https://www.reddit.com/r/${SUBS[0]}/`, { waitUntil: "domcontentloaded" });
  await sleep(6000);

  let threads = 0, kept = 0;
  outer: for (const sort of SORTS) {
    for (const sub of SUBS) {
      if (threads >= THREAD_BUDGET) break outer;
      const feed = `https://www.reddit.com/r/${sub}/${sort}`;
      console.log(`\n▸ ${feed}`);
      await page.goto(feed, { waitUntil: "domcontentloaded" }).catch(() => {});
      await sleep(2500);

      // 피드를 내리며 스레드 주소를 모은다
      const links = new Set<string>();
      for (let i = 0; i < 6 && links.size < 14; i++) {
        const ls = await page.$$eval("shreddit-post", (ps) =>
          ps.map((p) => p.getAttribute("permalink") ?? "").filter(Boolean),
        ).catch(() => [] as string[]);
        ls.forEach((l) => links.add(l));
        await page.mouse.wheel(0, 1600);
        await sleep(900);
      }
      console.log(`  스레드 ${links.size}개 발견`);

      for (const permalink of links) {
        if (threads >= THREAD_BUDGET) break outer;
        if (done.has(permalink)) continue;
        done.add(permalink);
        threads += 1;
        try {
          // 경멸은 다운보트되어 밑에 깔린다 — controversial이라야 먼저 온다
          await page.goto(`https://www.reddit.com${permalink}?sort=controversial`, {
            waitUntil: "domcontentloaded",
          });
          await page.waitForSelector("shreddit-comment", { timeout: 12_000 }).catch(() => {});
          await sleep(700);
          for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, 2200); await sleep(600); }

          // page.evaluate 안에 이름 붙은 함수를 두면 tsx가 __name 헬퍼를 주입해 페이지에서 터진다.
          // 전부 인라인으로 쓴다.
          const got = await page.evaluate(() => {
            const out: { kind: string; text: string }[] = [];
            const title = (document.querySelector('h1[slot="title"]')?.textContent ?? "")
              .replace(/\s+/g, " ").trim();
            if (title) out.push({ kind: "title", text: title });
            for (const p of document.querySelectorAll('div[slot="text-body"] p')) {
              const t = (p.textContent ?? "").replace(/\s+/g, " ").trim();
              if (t) out.push({ kind: "body", text: t });
            }
            for (const c of document.querySelectorAll("shreddit-comment")) {
              const parts: string[] = [];
              for (const p of c.querySelectorAll('div[slot="comment"] p')) {
                const t = (p.textContent ?? "").replace(/\s+/g, " ").trim();
                if (t) parts.push(t);
              }
              const t = parts.join(" ");
              if (t) out.push({ kind: "comment", text: t });
            }
            return { title, items: out };
          });

          const sub2 = permalink.match(/\/r\/([^/]+)/)?.[1] ?? sub;
          let n = 0;
          for (const it of got.items) {
            if (it.text.length < 40) continue;
            appendFileSync(OUT, JSON.stringify({
              sub: sub2, permalink, title: got.title, kind: it.kind, text: it.text,
            }) + "\n");
            n += 1; kept += 1;
          }
          console.log(`  [${threads}] ${n.toString().padStart(3)}개 ← "${got.title.slice(0, 58)}"`);
          await sleep(1400);
        } catch (e) {
          console.log(`  [${threads}] 실패: ${(e as Error).message.split("\n")[0].slice(0, 70)}`);
          await sleep(2500);
        }
      }
    }
  }
  console.log(`\n수확 완료 — 스레드 ${threads}개, 후보 ${kept}개 → ${OUT}`);
  await browser.close();
}
main();
