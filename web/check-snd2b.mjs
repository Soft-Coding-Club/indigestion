import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  r.writeHead(200,{"content-type":p.endsWith(".html")?"text/html;charset=utf-8":"application/octet-stream"});
  r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4791,r));
const b=await chromium.launch({channel:'chrome',headless:false,args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:1600,height:900}});
const errs=[];pg.on("pageerror",e=>errs.push(String(e).slice(0,80)));
await pg.goto("http://localhost:4791/?snd=2");
await pg.waitForTimeout(2500);
await pg.mouse.click(1500,860); await pg.waitForTimeout(600);
const r=await pg.evaluate(async()=>{
  // 실제 재생된 클릭만 센다 (문턱+레이트 게이트 통과분)
  window.__played=[];const orig=sndClick;let lastT=0;
  window.sndClick=(imp,sz)=>{ if(imp>=0.07&&AC.currentTime-lastT>=0.030){window.__played.push(+imp.toFixed(2));lastT=AC.currentTime;} return orig(imp,sz); };
  await new Promise(rr=>setTimeout(rr,6000));
  handleMsg({t:'verdict',v:'PURGE',toxin:7,nourishment:-2,text:'get out'});
  await new Promise(rr=>setTimeout(rr,3200));
  const p=window.__played;
  return {plays:p.length,perSec:+(p.length/9.2).toFixed(1),impMax:Math.max(...p,0),n:letters.length};
});
console.log("v2 재생:",JSON.stringify(r),"에러:",errs.length?errs:"없음");
await b.close(); await new Promise(rr=>srv.close(rr)); process.exit(0);
