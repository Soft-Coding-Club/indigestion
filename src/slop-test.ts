// 목소리 실측 하네스 — 같은 댓글 묶음을 실제 sense()에 통과시키고 슬롭을 잰다.
// 사용: npx tsx src/slop-test.ts <라벨>   (결과: out/slop-<라벨>.json)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { sense } from "./digestion.js";
import { scoreKo } from "./slop-score.js";

const KEY =
  process.env.DEEPINFRA_API_KEY ??
  readFileSync(".env", "utf8").match(/DEEPINFRA_API_KEY=(.+)/)?.[1]?.trim() ??
  "";
if (!KEY) throw new Error("no key");

// 실제 레딧 어조의 표본 — 독한 것, 따뜻한 것, 비꼬는 것, 긴 것, 짧은 것
const COMMENTS = [
  "YTA. You read her diary and you're asking if YOU'RE the asshole? The fact you had to ask says everything.",
  "NTA but honestly this whole thread makes me sick. Y'all are celebrating a man losing custody like it's a sport.",
  "This is fake. Nobody's grandma leaves a $2M estate to 'whichever grandchild cries the least at the funeral.' Come on.",
  "I was a wedding photographer for 12 years. The couples who fought about the playlist were always divorced within 5. Every single time.",
  "lol imagine gatekeeping grief. people mourn differently, some people laugh at funerals, doesn't mean they loved them less",
  "My mom did the same thing before she passed. She drank her coffee, threw it up, drank another. I never understood until I got older. It wasn't about the coffee.",
  "ESH your sister is a nightmare but you knew EXACTLY what posting that video would do to her marriage and you did it anyway",
  "Delete this and talk to a lawyer. Not because you're wrong but because reddit is going to eat you alive and none of us are qualified.",
  "ok this is going to sound harsh but: your feelings are not your wife's job to manage while she's in chemo. get a therapist. today.",
  "Everyone sucks here including the dog somehow",
];

const label = process.argv[2] ?? "run";
const results: any[] = [];
for (const c of COMMENTS) {
  const s = await sense(c, KEY).catch(() => null);
  if (!s) { results.push({ c, error: true }); continue; }
  results.push({
    comment: c.slice(0, 60),
    translation: s.translation,
    marginalia: s.marginalia,
    trScore: scoreKo(s.translation ?? ""),
    mgScore: scoreKo(s.marginalia ?? ""),
    mgLen: (s.marginalia ?? "").length,
  });
  process.stdout.write(".");
}

const ok = results.filter((r) => !r.error);
const lens = ok.map((r) => r.mgLen);
const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
const sd = Math.sqrt(lens.map((l) => (l - mean) ** 2).reduce((a, b) => a + b, 0) / lens.length);
const summary = {
  n: ok.length,
  mgLen: { mean: +mean.toFixed(1), sd: +sd.toFixed(1), inBand40_90: lens.filter((l) => l >= 40 && l <= 90).length },
  s1Hits: ok.reduce((a, r) => a + r.trScore.s1.length + r.mgScore.s1.length, 0),
  s2Hits: ok.reduce((a, r) => a + r.trScore.s2.length + r.mgScore.s2.length, 0),
  structural: ok.reduce((a, r) => a + r.trScore.structural.length + r.mgScore.structural.length, 0),
  meanScore: +(ok.reduce((a, r) => a + r.trScore.score + r.mgScore.score, 0) / ok.length).toFixed(2),
};
mkdirSync("out", { recursive: true });
writeFileSync(`out/slop-${label}.json`, JSON.stringify({ summary, results }, null, 2));
console.log("\n" + JSON.stringify(summary));
