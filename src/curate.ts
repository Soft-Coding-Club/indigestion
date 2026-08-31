// 선별 — 수확물에서 "벌어진 입"만 골라 말뭉치를 만든다.
//
// 왜 인용문인가: r/raisedbynarcissists 같은 곳은 피해자 지지 커뮤니티라
// 댓글은 위로뿐이고(controversial 정렬로도 그렇다), 진짜 역한 말은
// 증언 본문 안에 따옴표로 인용된 가해자의 발화에 있다. 8/31 실측으로 확인.
// 시와도 맞는다 — "매일 낯선 입들이 벌어져 / 고를 새도 없이 목구멍에 쏟아졌다".
import { readFileSync, writeFileSync } from "node:fs";

const MODEL = "deepseek-ai/DeepSeek-V4-Flash-0731";
const API = "https://api.deepinfra.com/v1/openai/chat/completions";
const KEY = process.env.DEEPINFRA_API_KEY ?? "";
const IN = process.env.IN ?? "out/corpus-raw.jsonl";
const OUT = process.env.OUT ?? "out/corpus.json";
const WANT = Number(process.env.WANT ?? 120);

type Raw = { sub: string; permalink: string; title: string; kind: string; text: string };
type Cand = { sub: string; kind: string; text: string; src: string };

// 홑따옴표는 영어 축약형(don't, it's)과 구분이 안 되므로 겹따옴표만 본다
const QUOTE = /[“"]([^“”"]{14,300})[”"]/g;
const YOU = /\b(you|your|you're|youre|yourself|u)\b/i;
const VERB = /\b(is|are|am|was|were|do|does|did|don't|dont|will|would|can|can't|cant|should|have|has|had|get|got|go|going|know|think|want|need|make|made|say|said|tell|told|be|been|'re|'m|'s)\b/i;
const SLUR = /\b(n[i1]gg|f[a4]gg?|k[i1]ke|ch[i1]nk|tr[a4]nn|sp[i1]c\b|w[e3]tb[a4]ck|g[o0]{2}k\b|beaner|towelhead|dyke)\b/i;

function extract(rows: Raw[]): Cand[] {
  const seen = new Set<string>();
  const out: Cand[] = [];
  for (const r of rows) {
    let m: RegExpExecArray | null;
    QUOTE.lastIndex = 0;
    while ((m = QUOTE.exec(r.text))) {
      const t = m[1].replace(/\s+/g, " ").trim();
      const key = t.toLowerCase();
      if (t.length < 18 || t.length > 240) continue;   // 너무 짧으면 개념, 길면 식도에 안 들어간다
      if (!VERB.test(t)) continue;                      // 동사 없는 명사구는 발화가 아니다
      if (SLUR.test(t)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ sub: r.sub, kind: r.kind, text: t, src: r.permalink });
    }
  }
  return out;
}

async function judge(batch: Cand[]): Promise<{ i: number; aim: number; venom: number; keep: boolean }[]> {
  const list = batch.map((c, i) => `${i}. ${c.text}`).join("\n");
  const body = {
    model: MODEL,
    max_tokens: 2000,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "너는 미디어아트 작품의 재료를 고르는 사람이다. 아래는 레딧 게시물에서 따옴표로 인용된 말들이다.\n" +
          "각 줄이 '누군가를 향해 뱉은 가해 발화'인지 판정하라.\n" +
          "aim = 2인칭으로 사람을 겨냥한 정도 0~3 (0=아무도 안 겨냥, 3=대놓고 상대를 몰아세움)\n" +
          "venom = 모욕·비난·협박·조롱의 세기 0~3 (0=중립/따뜻함, 3=잔인함)\n" +
          "keep = 작품이 먹을 재료로 쓸 만한가 (aim과 venom이 둘 다 있고, 인용 부호 안이 실제 대사인 것만 true)\n" +
          "다만 실존 정치인·연예인 등 공인을 지목한 말은 keep=false — 이 작품은 사적인 관계에서 쏟아진 말만 먹는다.\n" +
          '오직 JSON 배열만 출력: [{"i":0,"aim":2,"venom":3,"keep":true}, ...]',
      },
      { role: "user", content: list },
    ],
  };
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  const j: any = await res.json();
  const txt: string = j.choices?.[0]?.message?.content ?? "";
  const mm = txt.match(/\[[\s\S]*\]/);
  if (!mm) throw new Error("JSON 없음");
  return JSON.parse(mm[0]);
}

async function main() {
  const rows: Raw[] = readFileSync(IN, "utf8").trim().split("\n").filter(Boolean)
    .map((l) => JSON.parse(l));
  const cands = extract(rows);
  console.log(`수확물 ${rows.length}개 → 인용문 ${cands.length}개 (동사 있고 18~240자, 슬러 제외)`);
  const aimed = cands.filter((c) => YOU.test(c.text));
  console.log(`  그중 2인칭 겨냥 ${aimed.length}개`);

  if (!KEY) {
    console.log("DEEPINFRA_API_KEY 없음 — 규칙 선별만 수행");
    const picked = aimed.slice(0, WANT).map((c) => ({ ...c, aim: 2, venom: 2 }));
    writeFileSync(OUT, JSON.stringify({ made: "rule-only", items: picked }, null, 1));
    console.log(`→ ${OUT} (${picked.length}개)`);
    return;
  }

  const scored: (Cand & { aim: number; venom: number })[] = [];
  const B = 25;
  for (let i = 0; i < cands.length; i += B) {
    const batch = cands.slice(i, i + B);
    try {
      const verdict = await judge(batch);
      for (const v of verdict) {
        const c = batch[v.i];
        if (!c || !v.keep) continue;
        scored.push({ ...c, aim: v.aim, venom: v.venom });
      }
      console.log(`  ${Math.min(i + B, cands.length)}/${cands.length} 판정 · 채택 누적 ${scored.length}`);
    } catch (e) {
      console.log(`  ${i} 배치 실패: ${(e as Error).message}`);
    }
  }

  // 센 것부터. 같은 세기면 짧은 것이 임팩트가 크다.
  scored.sort((a, b) => (b.aim + b.venom * 1.5) - (a.aim + a.venom * 1.5) || a.text.length - b.text.length);
  const picked = scored.slice(0, WANT);
  writeFileSync(OUT, JSON.stringify({ made: "llm", n: picked.length, items: picked }, null, 1));
  console.log(`\n채택 ${picked.length}개 → ${OUT}`);
  console.log(`평균 aim ${(picked.reduce((s, x) => s + x.aim, 0) / picked.length).toFixed(2)} · venom ${(picked.reduce((s, x) => s + x.venom, 0) / picked.length).toFixed(2)}`);
  console.log(`\n=== 상위 12개 ===`);
  picked.slice(0, 12).forEach((p, i) => console.log(`[${i}] aim${p.aim} venom${p.venom} r/${p.sub} :: ${p.text}`));
}
main();
