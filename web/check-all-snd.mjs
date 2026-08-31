import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  r.writeHead(200,{"content-type":p.endsWith(".html")?"text/html;charset=utf-8":"application/octet-stream"});
  r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4792,r));
const b=await chromium.launch({channel:'chrome',headless:false,args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:1600,height:900}});
const errs=[];pg.on("pageerror",e=>errs.push(String(e).slice(0,90)));
await pg.goto("http://localhost:4792/");
await pg.waitForTimeout(2200);
await pg.mouse.click(1500,860); await pg.waitForTimeout(500);
const r=await pg.evaluate(async()=>{
  const an=AC.createAnalyser(); an.fftSize=2048; an.smoothingTimeConstant=0.2;
  master.connect(an);
  const td=new Float32Array(an.fftSize);
  const peak=async ms=>{const out=[];const t1=performance.now()+ms;
    while(performance.now()<t1){an.getFloatTimeDomainData(td);
      let s2=0;for(let i=0;i<td.length;i++)s2+=td[i]*td[i];
      out.push(Math.sqrt(s2/td.length));await new Promise(rr=>setTimeout(rr,18));}
    return +Math.max(...out).toFixed(4);};
  const res={};
  for(let v=3;v<=9;v++){
    SND=v; lastSw=0; whispers=0;
    sndSwallow('why did you do this to me are you stupid');
    res['v'+v]=await peak(1400);
    await new Promise(rr=>setTimeout(rr,350));
  }
  return res;
});
console.log("각 버전 피크 RMS:",JSON.stringify(r));
console.log("에러:",errs.length?errs:"없음");
await b.close(); await new Promise(rr=>srv.close(rr)); process.exit(0);
