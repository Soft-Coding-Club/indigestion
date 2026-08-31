import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  const m={".html":"text/html;charset=utf-8",".json":"application/json",".jsonl":"text/plain",".woff2":"font/woff2",".png":"image/png"};
  r.writeHead(200,{"content-type":m[p.slice(p.lastIndexOf("."))]||"application/octet-stream"});r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4784,r));
const b=await chromium.launch({channel:'chrome',headless:false});
for(const [tag,qs] of [["아침","?aged=0&day=0"],["점심","?aged=0.45&day=0.5"],["저녁","?aged=1&day=1"]]){
  const pg=await b.newPage({viewport:{width:1600,height:900}});
  const errs=[];pg.on("pageerror",e=>errs.push(String(e).slice(0,80)));
  await pg.goto("http://localhost:4784/"+qs);
  await pg.waitForTimeout(30000);
  const st=await pg.evaluate(()=>({n:letters.length,sed:+sedMass.toFixed(3),gls:glsN,floor:+(0.405-sedMass*0.052).toFixed(3)}));
  console.log(tag, JSON.stringify(st), errs.length?"에러 "+errs[0]:"");
  await pg.screenshot({path:`out/aged-${tag}.png`}); await pg.close();
}
await b.close(); await new Promise(r=>srv.close(r)); process.exit(0);
