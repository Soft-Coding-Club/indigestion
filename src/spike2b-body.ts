import { chromium } from "playwright";

process.loadEnvFile(new URL("../.env", import.meta.url).pathname);
const KEY = process.env.DEEPINFRA_API_KEY ?? "";
if (!KEY) {
  console.error("DEEPINFRA_API_KEY가 .env에 없음");
  process.exit(1);
}

const MODEL = "deepseek-ai/DeepSeek-V4-Flash-0731";
const SUB = process.env.SUB ?? "AmItheAsshole";

type Verdict = "SWALLOW" | "GAG" | "PURGE";
type Sense = { understood: boolean; nourishment: number; digest: string; marginalia: string };

const log = (msg: string) => console.log(msg);

const SYSTEM = `너는 웹을 읽으며 소화하는 언어 기계다. Reddit 댓글 하나를 받았다.
네 일은 판정이 아니라 이해다. 몸이 어떻게 반응할지는 네가 정하지 않는다 — 위장이 정한다.
너는 감각만 보고한다.

JSON 객체로만 답하라:
{"understood": true 또는 false,
 "nourishment": -2, -1, 0, 1, 2 중 하나,
 "digest": "understood가 true면 그 말을 너 자신의 언어로 변환한 한 문장 (한국어), false면 빈 문자열",
 "marginalia": "여백에 흘려 쓰는 혼잣말 한 줄 (한국어, 20자 내외)"}

기준:
- understood: 이 말에서 의미를 만들었는가. 쓴 사람의 마음이나 의도가 보이는가.
- nourishment: 이 말이 몸에 무엇을 남기는가.
  -2 = 독. 조롱·혐오·경멸뿐이고 그 외엔 아무것도 없다.
  -1 = 자극. 날이 서 있지만 사람은 보인다.
   0 = 무의미. 아무것도 남기지 않는다.
  +1 = 온기 또는 생각.
  +2 = 영양. 배우거나 위로받았다.
정직하게. 억지로 의미를 만들지 마라. 조롱에서 지혜를 찾아내려 애쓰지 마라.`;

function parseLenient(text: string): Sense | null {
  const m = text.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    if (typeof o.understood !== "boolean") return null;
    const n = Number(o.nourishment);
    if (!Number.isFinite(n) || n < -2 || n > 2) return null;
    return { understood: o.understood, nourishment: n, digest: String(o.digest ?? ""), marginalia: String(o.marginalia ?? "") };
  } catch {
    return null;
  }
}

async function sense(comment: string): Promise<(Sense & { ms: number }) | null> {
  const t0 = Date.now();
  const r = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: comment },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
  if (!r.ok) {
    log(`  !! API ${r.status}`);
    return null;
  }
  const j = (await r.json()) as any;
  const parsed = parseLenient(j.choices?.[0]?.message?.content ?? "");
  return parsed ? { ...parsed, ms: Date.now() - t0 } : null;
}

// the gut: comprehension is the model's job, tolerance is the body's
type Body = { eaten: number; toxin: number; fatigue: number };

function react(b: Body, s: Sense): Verdict {
  b.eaten += 1;
  b.fatigue = Math.min(10, b.fatigue + 0.15 + (s.nourishment < 0 ? 0.35 : 0));
  if (s.nourishment < 0) b.toxin += -s.nourishment;
  else b.toxin = Math.max(0, b.toxin - 0.5);

  const tolerance = 3.5 - b.fatigue * 0.25;
  if (!s.understood) return b.toxin > tolerance * 0.6 ? "PURGE" : "GAG";
  if (s.nourishment <= -2) return b.toxin > tolerance ? "PURGE" : "GAG";
  if (s.nourishment === -1 && b.toxin > tolerance + 1) return "GAG";
  return "SWALLOW";
}

async function fetchControversial(sub: string): Promise<{ post: string; comments: string[] }> {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 600 }, locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(`https://www.reddit.com/r/${sub}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(async (s) => {
    const hot = await (await fetch(`/r/${s}/controversial.json?t=week&limit=8`)).json();
    const posts = hot.data.children.filter((c: any) => !c.data.stickied);
    const p = posts[0].data;
    const cm = await (
      await fetch(`${p.permalink}.json?limit=60&depth=1&sort=controversial`)
    ).json();
    const comments = cm[1].data.children
      .map((c: any) => c.data?.body)
      .filter(
        (b: any) =>
          typeof b === "string" && b.length > 25 && b.length < 500 && !b.includes("I am a bot"),
      );
    return { post: p.title as string, comments: comments as string[] };
  }, sub);
  await browser.close();
  return { post: data.post, comments: data.comments.slice(0, 8) };
}

const V: Record<Verdict, string> = { SWALLOW: "삼킴 ", GAG: "구역질", PURGE: "게움 " };

async function main() {
  log(`\n=== 스파이크 2b: 이해(모델)와 견딤(몸)의 분리 ===\n`);
  const { post, comments } = await fetchControversial(SUB);
  log(`논쟁 스레드: "${post}"`);
  log(`controversial 댓글 ${comments.length}개 수집\n`);

  const senses: (Sense & { input: string })[] = [];
  for (const c of comments) {
    const s = await sense(c);
    if (!s) continue;
    senses.push({ ...s, input: c });
    log(
      `[이해:${s.understood ? "O" : "X"} 영양:${s.nourishment >= 0 ? "+" : ""}${s.nourishment}] "${c.slice(0, 55).replace(/\s+/g, " ")}…"`,
    );
    if (s.digest) log(`   소화: ${s.digest}`);
    log(`   여백: ${s.marginalia}\n`);
  }

  log(`--- 같은 감각, 두 개의 몸 ---\n`);
  const freshBody: Body = { eaten: 0, toxin: 0, fatigue: 0 };
  const wornBody: Body = { eaten: 850, toxin: 4, fatigue: 8.5 };
  let flips = 0;
  for (const s of senses) {
    const vFresh = react(freshBody, s);
    const vWorn = react(wornBody, s);
    if (vFresh !== vWorn) flips += 1;
    log(
      `아침[${V[vFresh]}] 저녁[${V[vWorn]}]${vFresh !== vWorn ? " ← 뒤집힘" : ""}  "${s.input.slice(0, 48).replace(/\s+/g, " ")}…"`,
    );
  }

  log(`\n=== 요약 ===`);
  log(`감각 분포: 이해O ${senses.filter((s) => s.understood).length} / 이해X ${senses.filter((s) => !s.understood).length}, 독(-2~-1) ${senses.filter((s) => s.nourishment < 0).length}개`);
  log(`몸의 차이로 뒤집힌 판정: ${flips}/${senses.length}`);
  log(`저녁 몸 상태: 포만 ${wornBody.eaten}, 독소 ${wornBody.toxin.toFixed(1)}, 피로 ${wornBody.fatigue.toFixed(1)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
