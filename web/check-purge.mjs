import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  const m={".html":"text/html;charset=utf-8",".json":"application/json",".jsonl":"text/plain",".woff2":"font/woff2",".png":"image/png"};
  r.writeHead(200,{"content-type":m[p.slice(p.lastIndexOf("."))]||"application/octet-stream"});r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4785,r));
const b=await chromium.launch({channel:'chrome',headless:false});
for(const [tag,qs] of [["아침","?day=0"],["저녁","?day=1&aged=1"]]){
  const pg=await b.newPage({viewport:{width:1600,height:900}});
  const errs=[];pg.on("pageerror",e=>errs.push(String(e).slice(0,80)));
  await pg.goto("http://localhost:4785/"+qs);
  await pg.evaluate(()=>{window.__p=[];window.__n=[];window.__f=0;let w=false;
    (function t(){window.__f++;requestAnimationFrame(t);})();
    setInterval(()=>{const r=canalDir<0; if(r&&!w)window.__p.push(performance.now()); w=r;
      window.__n.push(letters.length);},60);});
  await pg.waitForTimeout(240000);
  const r=await pg.evaluate(()=>({p:window.__p,n:window.__n,f:window.__f,sed:+sedMass.toFixed(4)}));
  const g=[];for(let i=1;i<r.p.length;i++)g.push(Math.round((r.p[i]-r.p[i-1])/1000));
  console.log(`${tag} 게움 ${r.p.length}회 · 간격(초) ${g.join(" ")} · 글자 평균 ${Math.round(r.n.reduce((a,b)=>a+b,0)/r.n.length)} 최대 ${Math.max(...r.n)} · ${(r.f/240).toFixed(0)}fps · 앙금 ${r.sed} ${errs.length?"에러 "+errs[0]:""}`);
  await pg.screenshot({path:`out/purge-${tag}.png`}); await pg.close();
}
await b.close(); await new Promise(r=>srv.close(r)); process.exit(0);
