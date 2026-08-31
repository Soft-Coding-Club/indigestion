// 배포 빌드 — dist-web/ 에 정적 재생 앱을 만든다.
// index.html(렌더러) + vendor(폰트) + session.jsonl(필터링된 진짜 녹화) + hero.png(카탈로그 이미지)
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = root + "dist-web";
// .vercel(프로젝트 링크)은 살려둔다 — 지우면 배포가 엉뚱한 프로젝트로 튄다
const link = dist + "/.vercel";
const linkBak = root + ".vercel-link-backup";
if (existsSync(link)) { rmSync(linkBak, { recursive: true, force: true }); cpSync(link, linkBak, { recursive: true }); }
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
if (existsSync(linkBak)) cpSync(linkBak, link, { recursive: true });

// 렌더러 = index.html
cpSync(root + "public/renderer.html", dist + "/index.html");
// 폰트 번들
cpSync(root + "public/vendor", dist + "/vendor", { recursive: true });
// 카탈로그 이미지
if (existsSync(root + "press/hero-final.png")) cpSync(root + "press/hero-final.png", dist + "/hero.png");

// 세션 필터 — 렌더러가 쓰는 이벤트만 남긴다 (cur/frame/chew 등 브라우저-표시 잔재 제거)
// think(토큰 스트림)은 더 이상 화면에 그리지 않는다 — 재생만 무겁게 한다. 버린다.
const KEEP = new Set(["reading", "verdict", "gulp", "movement", "nav", "state"]);
// state는 부드럽게 보간되는 값이라 촘촘할 필요가 없다 — 솎아낸다.
let stateN = 0;
// 안전장치: 극단적 혐오발언(슬러)이 담긴 이벤트는 공개 배포에서 제외. 잔혹함은 남기고 최악만 뺀다.
const SLUR = /\b(n[i1]gg|f[a4]gg?|f[a4]g\b|k[i1]ke|sp[i1]c\b|ch[i1]nk|tr[a4]nn|ret[a4]rd|c[o0]on\b|w[e3]tb[a4]ck|g[o0]{2}k\b|beaner|towelhead|dyke\b)/i;
const dirty = (m) => SLUR.test([m?.text, m?.translation, (m?.matter || []).join(" "), m?.marginalia].filter(Boolean).join(" "));
const src = readFileSync(root + "out/session.jsonl", "utf8").trim().split("\n").filter(Boolean);
let kept = [], base = null, verdicts = { SWALLOW: 0, GAG: 0, PURGE: 0 }, dropped = 0;
for (const line of src) {
  let e; try { e = JSON.parse(line); } catch { continue; }
  if (!KEEP.has(e.m?.t)) continue;
  if (dirty(e.m)) { dropped++; continue; }
  if (e.m.t === "state" && (stateN++ % 6)) continue;
  if (base === null) base = e.dt;          // 워밍업 앞부분 잘라 0부터 시작
  e.dt -= base;
  kept.push(JSON.stringify(e));
  if (e.m.t === "verdict") verdicts[e.m.v] = (verdicts[e.m.v] || 0) + 1;
}
if (dropped) console.log(`안전 필터: 슬러 포함 이벤트 ${dropped}개 제외`);
writeFileSync(dist + "/session.jsonl", kept.join("\n") + "\n");

// 정적 배포 설정 (jsonl을 텍스트로 서빙)
writeFileSync(dist + "/vercel.json", JSON.stringify({
  headers: [{ source: "/session.jsonl", headers: [{ key: "content-type", value: "text/plain; charset=utf-8" }] }],
}, null, 2));

const durMs = kept.length ? JSON.parse(kept[kept.length - 1]).dt : 0;
console.log(`dist-web 준비 완료 — 이벤트 ${kept.length}개, 길이 ${(durMs/60000).toFixed(1)}분`);
console.log(`판정: 삼킴 ${verdicts.SWALLOW} · 구역 ${verdicts.GAG} · 게움 ${verdicts.PURGE}`);
