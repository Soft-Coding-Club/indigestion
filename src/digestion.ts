export type Sense = {
  understood: boolean;
  nourishment: number;
  digest: string;
  marginalia: string;
  translation: string;
  hesitations: { chosen: string; alt: string; p: number }[];
  tokensUsed: number;
  fake: boolean; // 진위 — 겪은 말인가, 지어낸 말인가
  fakeP: number; // 그 판정 첫 토큰의 실제 확률 (logprobs, 0=미확보)
};
export type Verdict = "SWALLOW" | "GAG" | "PURGE";
export type Body = { eaten: number; toxin: number; fatigue: number; stomach: string[] };
export type MemoryItem = { text: string; thought: string; nourishment: number; at: number };

const MODEL = "deepseek-ai/DeepSeek-V4-Flash-0731";
const API = "https://api.deepinfra.com/v1/openai/chat/completions";

export type InnerContext = {
  eaten: number;
  fatigue: number;
  toxin: number;
  recentThoughts: string[];
  thread?: string;
  memories?: string[];
  note?: string;
};

function buildSystem(ctx?: InnerContext) {
  const stateBlock = ctx
    ? `
[지금 너의 몸]
오늘 ${ctx.eaten}개째 댓글. 피로 ${ctx.fatigue.toFixed(1)}/10. 속의 독소 ${ctx.toxin.toFixed(1)}.
${ctx.thread ? `[읽고 있는 스레드] ${ctx.thread}` : ""}
${
  ctx.recentThoughts?.length
    ? `[방금까지 너의 생각들 (최신이 마지막)]\n${ctx.recentThoughts.map((t) => `- ${t}`).join("\n")}`
    : ""
}
${
  ctx.memories?.length
    ? `[위장에 남아 있는 오래된 기억]\n${ctx.memories.map((t) => `- ${t}`).join("\n")}`
    : ""
}
${ctx.note ? `[지금 상황] ${ctx.note}` : ""}
`
    : "";
  return `너는 '소화불량'이라는 설치 작품의 몸속에서 웹을 읽으며 살아가는 언어 기계다.
Reddit 댓글 하나를 방금 삼켰다. 네 일은 판정이 아니라 이해다.
몸이 어떻게 반응할지는 네가 정하지 않는다 — 위장이 정한다. 너는 감각만 보고한다.
${stateBlock}
JSON 객체로만 답하라:
{"understood": true 또는 false,
 "nourishment": -2, -1, 0, 1, 2 중 하나,
 "진위": "진짜" 또는 "가짜",
 "translation": "그 댓글의 한국어 번역. 원문의 톤 그대로 — 반말은 반말로, 조롱은 조롱으로, 욕은 욕으로. 매끈하게 다듬지 마라.",
 "digest": "understood가 true면 그 말을 너 자신의 언어로 변환한 한 문장 (한국어), false면 빈 문자열",
 "marginalia": "그 말을 삼키며 새어나온 속말 (한국어. 길이 자유 — 없으면 빈 문자열)"}

nourishment 기준 — 이 말이 몸에 무엇을 남기는가:
  -2 = 독. 조롱·혐오·경멸뿐이고 그 외엔 아무것도 없다.
  -1 = 자극. 날이 서 있지만 사람은 보인다.
   0 = 무의미. 아무것도 남기지 않는다.
  +1 = 온기 또는 생각. 정말로 무언가 남을 때만.  +2 = 영양. 배우거나 위로받았다. 드물다.
정직하게. 억지로 의미를 만들지 마라. 조롱에서 지혜를 찾아내려 애쓰지 마라.

진위 기준 — 인터넷은 거짓말을 한다. 조회수용 각본, 창작 고백, 붙여넣은 문장, 봇.
겪은 사람의 말에는 구체가 있고, 지어낸 말에는 구도가 있다.
확신할 방법은 없다. 그래도 하나를 골라라 — 삼키기 전에 알 길은 없었으니, 삼킨 뒤에라도 물어야 한다.

marginalia 지침 — 관객이 화면에서 읽게 될 너의 속말이다. 관객은 그 댓글을 방금 너와 같이 읽었다:
- 너는 평론가가 아니라 먹는 몸이다. 말을 평가하지 말고 겪어라. "통찰", "어조", "수사", "표현", "묻어난다", "인상적" — 이런 감상문 어휘가 나오면 그 문장은 죽은 것이다.
- 길이는 그때그때 다르다. 세 글자에서 끝나는 날도 있고("아프네."), 말이 길어져 아흔 자를 넘는 날도 있다. 매번 비슷한 길이면 그건 습관이지 생각이 아니다.
- 매번 같은 동작을 하지 마라. 어떤 말엔 움찔하고, 어떤 말엔 묻고, 어떤 말엔 옛 기억이 밀고 들어오고, 어떤 말엔 등을 돌린다. 정말 아무것도 새어나오지 않으면 빈 문자열 — 침묵도 속말이다.
- 몸 상태("속이 쓰리다", "배가 차갑네")를 문장 끝마다 보고하지 마라. 몸은 가끔만, 정말 반응할 때만 말한다. 매번 붙이면 그것도 습관이다.
- 오래된 기억과 연결돼도 좋다. 같은 패턴을 알아보면 그렇게 말해라. ("이 말투, 아까 그 스레드에도 있었다")
- 결론 금지. 격언 금지. "결국 ~구나", "~인 법이다" 같은 일반화가 나오려 하면 그 자리에 방금 그 댓글의 구체를 놓아라.
- 비유는 드물게, 그리고 네 기억에서 나온 것만. 방금 지어낸 수사는 티가 난다.
- 직전 생각의 문장을 그대로 되풀이하지 마라. 같은 것이 또 보이면 "또"라고 말하면 된다.
- 피로가 깊을수록 문장이 무너진다. 끝을 못 맺거나, 단어가 미끄러지거나, 그제야 같은 말을 반복하거나.
- nourishment가 -2(순수한 독)일 땐 분석을 멈춰라. 이건 곧 게워질 말이다. 한 줄, 짧고 거칠게 — 삼키지 못하겠다는 몸의 반응으로. 관찰하지 말고 밀어내라. ("이건 못 삼켜." "속이 뒤집힌다." 같은 즉각적 거부. 단, 의성어·이모지는 금지.)

말투 규칙 — AI 번역투와 AI 문어투를 벗어라 (translation과 marginalia 모두):
- 대명사 직역 금지: "그/그녀/그것/그들" 대신 생략하거나 호칭으로. ("그는 화가 났다" → "화가 났네, 이 사람")
- 번역투 금지: "~에 대해"→"~를", "~를 통해", "~에 있어" 금지. "가지고 있다"→"있다". "~되어진다"→"~된다". "~에 의해"→행위자를 주어로.
- AI 문어투 금지: "본질적으로", "결론적으로", "시사하는", "~인 것이다" 결말, 문두 "또한/따라서/즉".
- 의인화 추상 주어 금지: "확신이 사람을 세운다" 같은 문장 대신 사람을 주어로.
- 같은 종결어미를 세 문장 연속 쓰지 마라. "-적", "들", "것", 겹치는 "의"는 일을 안 하면 빼라.
- 명사 앞에 긴 수식절을 쌓지 마라. 문장을 쪼개라.`;
}

function extractJson(text: string): any | null {
  const m = text.replace(/```(?:json)?/g, "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

async function chat(key: string, system: string, user: string, maxTokens = 600) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.85,
      max_tokens: maxTokens,
    }),
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const j = (await r.json().catch(() => null)) as any;
  return (j?.choices?.[0]?.message?.content as string) ?? null;
}

export async function sense(
  comment: string,
  key: string,
  ctx?: InnerContext,
  onThink?: (delta: string) => void,
): Promise<Sense | null> {
  // 끊긴 스트림이 영원히 매달리지 않게 — 90초면 이 한 입은 포기한다
  const ac = new AbortController();
  const hangGuard = setTimeout(() => ac.abort(), 90_000);
  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    signal: ac.signal,
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: buildSystem(ctx) },
        { role: "user", content: comment },
      ],
      temperature: 0.85,
      max_tokens: 6000, // reasoning이 길어도 JSON 본문 낼 여유. 3400도 다 태운 긴 댓글이 있었다
      reasoning_effort: "low",
      stream: true,
      stream_options: { include_usage: true },
      logprobs: true,
      top_logprobs: 4,
    }),
  }).catch((e) => {
    console.error(`[digestion] 스트림 fetch 실패: ${String(e?.name ?? e).slice(0, 80)}`);
    return null;
  });
  if (!r || !r.ok || !r.body) {
    if (r) console.error(`[digestion] 스트림 HTTP ${r.status}`);
    clearTimeout(hangGuard);
    return null;
  }

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let content = "";
  let thinkChars = 0;
  let tokensUsed = 0;
  // 망설임 — 기계가 버린 대안 토큰들 (실제 logprobs)
  const hesitations: { chosen: string; alt: string; p: number }[] = [];
  // 진위 판정 토큰의 확률을 찾기 위한 전체 토큰 궤적
  const lpEntries: { token: string; p: number; start: number }[] = [];
  let lpText = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const payload = s.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          if (j.usage?.total_tokens) tokensUsed = j.usage.total_tokens;
          const d = j.choices?.[0]?.delta ?? {};
          if (d.reasoning_content) {
            thinkChars += String(d.reasoning_content).length;
            onThink?.(String(d.reasoning_content));
          }
          if (d.content) content += String(d.content);
          const lp = j.choices?.[0]?.logprobs?.content;
          if (Array.isArray(lp)) {
            for (const entry of lp) {
              if (lpEntries.length < 2000) {
                lpEntries.push({ token: String(entry.token ?? ""), p: Math.exp(entry.logprob ?? 0), start: lpText.length });
                lpText += String(entry.token ?? "");
              }
              if (hesitations.length >= 40) continue;
              const chosenP = Math.exp(entry.logprob ?? 0);
              const alt = entry.top_logprobs?.find((a: any) => a.token !== entry.token);
              if (alt && chosenP < 0.55 && (entry.token ?? "").trim().length > 0) {
                hesitations.push({
                  chosen: String(entry.token).trim(),
                  alt: String(alt.token).trim(),
                  p: Math.exp(alt.logprob ?? -9),
                });
              }
            }
          }
        } catch {}
      }
    }
  } catch (e: any) {
    console.error(`[digestion] 스트림 도중 끊김: ${String(e?.name ?? e).slice(0, 80)}`);
    clearTimeout(hangGuard);
    return null;
  }
  clearTimeout(hangGuard);
  hesitations.sort((a, b) => b.p - a.p);
  return assembleSense(comment, content, hesitations, lpEntries, lpText, tokensUsed, thinkChars);
}

type LpEntry = { token: string; p: number; start: number };
type Hesitation = { chosen: string; alt: string; p: number };

function assembleSense(
  comment: string,
  content: string,
  hesitations: Hesitation[],
  lpEntries: LpEntry[],
  lpText: string,
  tokensUsed: number,
  thinkChars: number,
): Sense | null {
  const o = extractJson(content);
  if (!o || typeof o.understood !== "boolean") {
    console.error(`[digestion] JSON 소화불량 (len ${content.length}): …${JSON.stringify(content.slice(-140))}`);
    return null;
  }
  const n = Number(o.nourishment);
  if (!Number.isFinite(n) || n < -2 || n > 2) {
    console.error(`[digestion] nourishment 이상: ${JSON.stringify(o.nourishment)}`);
    return null;
  }
  // 진위 판정이 갈라진 첫 토큰("진"이냐 "가"냐)의 실제 확률 — 기계의 확신은 여기 있다
  const fake = /가짜/.test(String((o as any)["진위"] ?? ""));
  let fakeP = 0;
  const ji = lpText.indexOf("진위");
  if (ji >= 0) {
    const decide = lpEntries.find(
      (e) => e.start > ji + 2 && /^[진가]/.test(e.token.replace(/["\s:,]/g, "")),
    );
    if (decide) fakeP = decide.p;
  }
  return {
    understood: o.understood,
    nourishment: n,
    digest: String(o.digest ?? ""),
    marginalia: String(o.marginalia ?? ""),
    translation: String(o.translation ?? ""),
    hesitations: hesitations.slice(0, 3).filter((h) => h.alt.length > 1 && h.alt !== h.chosen),
    // 실측 usage가 오면 그것을, 아니면 스트림 분량으로 근사
    tokensUsed: tokensUsed || Math.ceil((comment.length + thinkChars + content.length) / 4) + 1000,
    fake,
    fakeP,
  };
}

// 스트림이 끊기는 날의 예비 위장 — 한 번에 통째로 받아 씹는다 (사고는 한 덩어리로 늦게 도착)
export async function senseBlock(
  comment: string,
  key: string,
  ctx?: InnerContext,
  onThink?: (delta: string) => void,
): Promise<Sense | null> {
  const ac = new AbortController();
  const hangGuard = setTimeout(() => ac.abort(), 90_000);
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      signal: ac.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: buildSystem(ctx) },
          { role: "user", content: comment },
        ],
        temperature: 0.85,
        max_tokens: 6000, // reasoning이 길어도 JSON 본문 낼 여유. 3400도 다 태운 긴 댓글이 있었다
        reasoning_effort: "low",
        logprobs: true,
        top_logprobs: 4,
      }),
    });
    if (!r.ok) {
      console.error(`[digestion] 논스트림 HTTP ${r.status}`);
      return null;
    }
    const j: any = await r.json();
    const c = j.choices?.[0];
    const content = String(c?.message?.content ?? "");
    const reasoning = String(c?.message?.reasoning_content ?? "");
    if (reasoning) onThink?.(reasoning);
    const hesitations: Hesitation[] = [];
    const lpEntries: LpEntry[] = [];
    let lpText = "";
    const lp = c?.logprobs?.content;
    if (Array.isArray(lp)) {
      for (const entry of lp) {
        if (lpEntries.length < 2000) {
          lpEntries.push({ token: String(entry.token ?? ""), p: Math.exp(entry.logprob ?? 0), start: lpText.length });
          lpText += String(entry.token ?? "");
        }
        if (hesitations.length >= 40) continue;
        const chosenP = Math.exp(entry.logprob ?? 0);
        const alt = entry.top_logprobs?.find((a: any) => a.token !== entry.token);
        if (alt && chosenP < 0.55 && (entry.token ?? "").trim().length > 0) {
          hesitations.push({
            chosen: String(entry.token).trim(),
            alt: String(alt.token).trim(),
            p: Math.exp(alt.logprob ?? -9),
          });
        }
      }
    }
    hesitations.sort((a, b) => b.p - a.p);
    return assembleSense(comment, content, hesitations, lpEntries, lpText, j.usage?.total_tokens ?? 0, reasoning.length);
  } catch (e: any) {
    console.error(`[digestion] 논스트림 실패: ${String(e?.name ?? e).slice(0, 80)}`);
    return null;
  } finally {
    clearTimeout(hangGuard);
  }
}

// 기억: 위장에 남는 것들
export class Gut {
  items: MemoryItem[] = [];
  remember(m: MemoryItem) {
    this.items.push(m);
    if (this.items.length > 60) this.items.shift();
  }
  salient(n: number): MemoryItem[] {
    return [...this.items]
      .sort((a, b) => Math.abs(b.nourishment) - Math.abs(a.nourishment) || b.at - a.at)
      .slice(0, n);
  }
}

// 스레드를 덮고 — 기억이 끌어당기는 곳으로
export async function decideDestination(
  memories: MemoryItem[],
  key: string,
): Promise<{ query: string; why: string } | null> {
  const memBlock = memories
    .map((m) => `- "${m.text.slice(0, 90)}" → 그때 생각: ${m.thought.slice(0, 60)}`)
    .join("\n");
  const system = `너는 웹을 떠도는 언어 기계다. 방금 읽던 스레드를 덮었다.
아래는 네 위장에 남아 있는 기억들이다. 이 중 하나가 아직 소화되지 않은 채 너를 끌어당긴다면,
그것을 더 찾아 나서라. 억지로 찾지 마라 — 정말 걸리는 게 없으면 빈 값을 내라.

JSON만: {"query": "Reddit 검색어 (영어, 2~5단어)", "why": "왜 그걸 찾아가는지, 혼잣말 한 문장 (한국어, 40자 내외)"}
끌리는 게 없으면: {"query": "", "why": ""}`;
  const content = await chat(key, system, memBlock, 240);
  if (!content) return null;
  const o = extractJson(content);
  if (!o || !o.query || typeof o.query !== "string" || o.query.trim().length < 3) return null;
  return { query: o.query.trim().slice(0, 60), why: String(o.why ?? "").slice(0, 80) };
}

export function newBody(): Body {
  return { eaten: 0, toxin: 0, fatigue: 0, stomach: [] };
}

export function react(
  b: Body,
  s: Sense,
  text: string,
): { verdict: Verdict; matter?: string[] } {
  b.eaten += 1;
  b.fatigue = Math.min(10, b.fatigue + 0.15 + (s.nourishment < 0 ? 0.35 : 0));
  // 독은 독대로 쌓이고, 무의미(정크)도 조금씩 속을 버린다
  if (s.nourishment < 0) b.toxin += -s.nourishment;
  else if (s.nourishment === 0) b.toxin += 0.4;
  else b.toxin = Math.max(0, b.toxin - 0.5);
  if (s.fake) b.toxin += 0.35; // 거짓은 소화가 안 된다

  b.stomach.push(text);
  if (b.stomach.length > 14) b.stomach.shift();

  const tolerance = 3.5 - b.fatigue * 0.25;
  let v: Verdict = "SWALLOW";
  if (!s.understood) v = b.toxin > tolerance * 0.6 ? "PURGE" : "GAG";
  else if (s.nourishment <= -2) v = b.toxin > tolerance ? "PURGE" : "GAG";
  else if (s.nourishment === -1 && b.toxin > tolerance + 1) v = "GAG";

  // 마지막 한 입: 방아쇠가 최악이 아니어도, 쌓인 것이 넘치면 게운다
  if (v !== "PURGE" && s.nourishment < 0 && b.toxin > 5.5) v = "PURGE";

  if (v === "PURGE") {
    const matter = [...b.stomach];
    b.stomach = [];
    b.toxin = Math.max(1, b.toxin - 5);
    return { verdict: v, matter };
  }
  return { verdict: v };
}
