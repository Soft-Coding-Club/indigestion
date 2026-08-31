import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  const m={".html":"text/html;charset=utf-8",".jsonl":"text/plain;charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
  r.writeHead(200,{"content-type":m[p.slice(p.lastIndexOf("."))]||"application/octet-stream"}); r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4782,r));
const b=await chromium.launch({channel:'chrome',headless:false});
const pg=await b.newPage({viewport:{width:1600,height:900}});
await pg.goto("http://localhost:4782/");
await pg.evaluate(()=>{window.__f=0;const l=window.requestAnimationFrame;
  (function tick(){window.__f++;requestAnimationFrame(tick);})();});
for(let i=0;i<8;i++){ await pg.waitForTimeout(7000);
  const st=await pg.evaluate(()=>({n:letters.length,dir:canalDir,f:window.__f}));
  console.log(i,JSON.stringify(st)); await pg.screenshot({path:`out/live-${i}.png`}); }
const fps=await pg.evaluate(()=>window.__f); console.log("총 프레임",fps,"→ 약",(fps/56).toFixed(0),"fps");
await b.close(); await new Promise(r=>srv.close(r)); process.exit(0);
