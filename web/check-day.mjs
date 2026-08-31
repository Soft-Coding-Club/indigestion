import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  const m={".html":"text/html;charset=utf-8",".json":"application/json",".jsonl":"text/plain",".woff2":"font/woff2",".png":"image/png"};
  r.writeHead(200,{"content-type":m[p.slice(p.lastIndexOf("."))]||"application/octet-stream"});r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4783,r));
const b=await chromium.launch({channel:'chrome',headless:false});
for(const day of [0,0.5,1.0]){
  const pg=await b.newPage({viewport:{width:1600,height:900}});
  const errs=[]; pg.on("pageerror",e=>errs.push(String(e).slice(0,90)));
  await pg.goto(`http://localhost:4783/?day=${day}`);
  await pg.waitForTimeout(75000);
  const st=await pg.evaluate(()=>({n:letters.length,sed:+sedMass.toFixed(3),gls:glsN,fat:+fatigue.toFixed(2)}));
  console.log(`day=${day} → ${JSON.stringify(st)} 에러 ${errs.length?errs[0]:"없음"}`);
  await pg.screenshot({path:`out/day-${day}.png`}); await pg.close();
}
await b.close(); await new Promise(r=>srv.close(r)); process.exit(0);
