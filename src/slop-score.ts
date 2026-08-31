// 한국어 슬롭 채점기 — im-not-ai 분류학(A~J)과 Antislop의 빈도 관점을 우리 목소리에 맞게 증류.
// 목적: 기계의 한국어(translation·marginalia)가 "제 언어가 된 말"인지 런타임에 재는 것.

export type SlopReport = {
  s1: string[]; // 한 번만 나와도 AI 시그널 — 즉시 실격
  s2: string[]; // 누적되면 시그널
  structural: string[];
  score: number; // 0 = 깨끗, 1+ = 재롤 권장
};

const S1: Array<[RegExp, string]> = [
  [/되어진다|되어지는|되어질|되어졌/, "이중피동 '되어진다'"],
  [/본질적으로|결론적으로|궁극적으로|종합적으로/, "AI 결론 부사"],
  [/시사하는 바|주목할 만하|할 필요가 있다/, "보고서 상투구"],
  [/에 있어서?[ ,]/, "'~에 있어' 번역투"],
  [/그녀[는가의를도]?/, "대명사 '그녀'"],
  [/혁신적|압도적|폭발적|파격적|괄목할/, "과장 형용사"],
  [/것으로 보인다|것으로 판단된다|것으로 사료된다/, "헤지 스택"],
  [/것이다[.!?]?\s*$/m, "'~것이다' 결말"],
  [/~|、/, "비한국어 문장부호"],
];

const S2: Array<[RegExp, string]> = [
  [/[를을] 통해/, "'~를 통해'"],
  [/에 대해|에 대한/, "'~에 대해'"],
  [/가지고 있/, "'가지고 있다'"],
  [/에 의해/, "'~에 의해'"],
  [/^(또한|따라서|즉|나아가|한편)[ ,]/m, "문두 접속부사"],
  [/어쩌면|결국|무언가/, "슬롭 부사·대명사"],
  [/[가이] 아니라/, "'A가 아니라 B' 대조 틀"],
  [/마치 .{1,24}처럼/, "즉석 직유"],
  [/는 것 같다|인 것 같다/, "'~것 같다' 헤지"],
];

export function scoreKo(text: string): SlopReport {
  const t = text.trim();
  const r: SlopReport = { s1: [], s2: [], structural: [], score: 0 };
  if (!t) return r;

  for (const [re, name] of S1) if (re.test(t)) r.s1.push(name);
  for (const [re, name] of S2) if (re.test(t)) r.s2.push(name);

  // C-11: 연결어미 뒤 쉼표 — 한국어 AI 시그니처 (KatFish 4.84×)
  const c11 = (t.match(/(며|고|서|만|데|니),\s/g) ?? []).length;
  if (c11 >= 2) r.structural.push(`연결어미+쉼표 ${c11}회`);

  // 종결어미 반복 — 같은 꼬리 3연속
  const sents = t.split(/[.!?…]+/).map((s) => s.trim()).filter(Boolean);
  if (sents.length >= 3) {
    const tails = sents.map((s) => s.slice(-1));
    for (let i = 2; i < tails.length; i++)
      if (tails[i] === tails[i - 1] && tails[i] === tails[i - 2]) {
        r.structural.push(`종결어미 '${tails[i]}' 3연속`);
        break;
      }
  }

  // 것·들·적 밀도
  const fn = (t.match(/것|들|[가-힣]적[인이 ]/g) ?? []).length;
  if (t.length > 30 && fn / t.length > 0.06) r.structural.push(`것·들·-적 밀도 ${(fn / t.length * 100).toFixed(1)}%`);

  r.score = r.s1.length * 2 + Math.max(0, r.s2.length - 1) + r.structural.length * 0.5;
  return r;
}
