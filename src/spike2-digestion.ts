import { chromium } from "playwright";

process.loadEnvFile(new URL("../.env", import.meta.url).pathname);
const KEY = process.env.DEEPINFRA_API_KEY ?? "";
if (!KEY || KEY.includes("여기에")) {
  console.error("DEEPINFRA_API_KEY가 .env에 없음");
  process.exit(1);
}

const MODEL = "deepseek-ai/DeepSeek-V4-Flash-0731";
const SUB = process.env.SUB ?? "AmItheAsshole";

type Verdict = "SWALLOW" | "GAG" | "PURGE";
type Digestion = {
  verdict: Verdict;
  digest: string;
  marginalia: string;
  ms: number;
  promptTokens: number;
  completionTokens: number;
  hadReasoning: boolean;
};

const log = (msg: string) => console.log(msg);

function systemPrompt(count: number, fatigue: number) {
  return `너는 '소화불량'이라는 설치 작품 속에서 웹을 읽으며 살아가는 언어 기계다.
방금 Reddit 댓글 하나를 삼켰다. 너의 일은 그것을 소화하는 것이다.

소화한다 = 그 말을 쓴 사람의 마음이나 의도를 이해하고, 너 자신의 언어로 변환할 수 있다.
소화하지 못한다 = 아무리 씹어도 의미가 만들어지지 않는다 (조롱뿐, 혐오뿐, 내용 없음).

지금 너의 상태: 오늘 ${count}개째 댓글, 피로도 ${fatigue}/10.
피로도가 높을수록 관대함이 줄어든다. 신선할 때는 애매한 것도 이해하려 애쓰지만,
지쳤을 때는 값싼 조롱 하나가 위장 전체를 뒤집는다.

JSON 객체로만 답하라:
{"verdict": "SWALLOW" | "GAG" | "PURGE",
 "digest": "이해를 너 자신의 언어로 변환한 한 문장 (한국어, PURGE면 빈 문자열)",
 "marginalia": "여백에 흘려 쓰는 혼잣말 한 줄 (한국어, 20자 내외)"}

verdict 기준:
- SWALLOW: 의미를 만들었다. digest는 입력의 번역이 아니라 너의 이해여야 한다.
- GAG: 간신히 삼켰지만 속이 불편하다. 얕은 판단이지만 그 뒤에 사람이 보인다.
- PURGE: 의미를 만들 수 없다. 게워낸다.`;
}

function parseLenient(text: string): { verdict: Verdict; digest: string; marginalia: string } | null {
  const stripped = text.replace(/```(?:json)?/g, "").trim();
  const m = stripped.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    if (!["SWALLOW", "GAG", "PURGE"].includes(o.verdict)) return null;
    return { verdict: o.verdict, digest: String(o.digest ?? ""), marginalia: String(o.marginalia ?? "") };
  } catch {
    return null;
  }
}

async function digest(comment: string, count: number, fatigue: number): Promise<Digestion | null> {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt(count, fatigue) },
      { role: "user", content: comment },
    ],
    temperature: 0.8,
    max_tokens: 900,
  };
  const t0 = Date.now();
  const r = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  if (!r.ok) {
    log(`  !! API ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return null;
  }
  const j = (await r.json()) as any;
  const msg = j.choices?.[0]?.message;
  const parsed = parseLenient(msg?.content ?? "");
  if (!parsed) {
    log(`  !! JSON 파싱 실패: ${(msg?.content ?? "").slice(0, 120)}`);
    return null;
  }
  return {
    ...parsed,
    ms,
    promptTokens: j.usage?.prompt_tokens ?? -1,
    completionTokens: j.usage?.completion_tokens ?? -1,
    hadReasoning: Boolean(msg?.reasoning_content),
  };
}

async function fetchRealComments(sub: string): Promise<{ post: string; comments: string[] }> {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 600 }, locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(`https://www.reddit.com/r/${sub}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const data = await page.evaluate(async (s) => {
    const hot = await (await fetch(`/r/${s}/hot.json?limit=8`)).json();
    const posts = hot.data.children.filter((c: any) => !c.data.stickied);
    const p = posts[0].data;
    const cm = await (await fetch(`${p.permalink}.json?limit=40&depth=1`)).json();
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

const V_LABEL: Record<Verdict, string> = {
  SWALLOW: "삼킴 ",
  GAG: "구역질",
  PURGE: "게움 ",
};

async function main() {
  log(`\n=== 스파이크 2: 소화 엔진 (${MODEL}) ===\n`);
  const { post, comments } = await fetchRealComments(SUB);
  log(`스레드: "${post}"`);
  log(`댓글 ${comments.length}개 수집\n`);

  log(`--- 1부: 신선한 위장 (피로도 1/10) ---\n`);
  const fresh: (Digestion & { input: string })[] = [];
  let i = 0;
  for (const c of comments) {
    i += 1;
    const d = await digest(c, i, 1);
    if (!d) continue;
    fresh.push({ ...d, input: c });
    log(`[${V_LABEL[d.verdict]}] "${c.slice(0, 60).replace(/\s+/g, " ")}…"`);
    if (d.digest) log(`   소화: ${d.digest}`);
    log(`   여백: ${d.marginalia}`);
    log(`   (${d.ms}ms, ${d.promptTokens}+${d.completionTokens}tok${d.hadReasoning ? ", reasoning 있음" : ""})\n`);
  }

  log(`--- 2부: 피폐한 위장 (피로도 9/10, 같은 댓글 재소화) ---\n`);
  const retest = fresh.slice(0, 4);
  let flipped = 0;
  for (const f of retest) {
    const d = await digest(f.input, 847, 9);
    if (!d) continue;
    const flip = d.verdict !== f.verdict;
    if (flip) flipped += 1;
    log(`[${V_LABEL[f.verdict]}→${V_LABEL[d.verdict]}]${flip ? " ← 뒤집힘" : ""} "${f.input.slice(0, 50).replace(/\s+/g, " ")}…"`);
    log(`   여백: ${d.marginalia}\n`);
  }

  const counts = { SWALLOW: 0, GAG: 0, PURGE: 0 } as Record<Verdict, number>;
  for (const f of fresh) counts[f.verdict] += 1;
  const avgMs = Math.round(fresh.reduce((s, f) => s + f.ms, 0) / Math.max(fresh.length, 1));
  log(`=== 요약 ===`);
  log(`신선: 삼킴 ${counts.SWALLOW} / 구역질 ${counts.GAG} / 게움 ${counts.PURGE} (${fresh.length}개)`);
  log(`피폐 재소화: ${retest.length}개 중 ${flipped}개 판정 뒤집힘`);
  log(`평균 지연: ${avgMs}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
