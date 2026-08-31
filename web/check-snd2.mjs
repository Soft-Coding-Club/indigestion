import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  const m={".html":"text/html;charset=utf-8",".json":"application/json",".jsonl":"text/plain",".woff2":"font/woff2",".png":"image/png"};
  r.writeHead(200,{"content-type":m[p.slice(p.lastIndexOf("."))]||"application/octet-stream"});r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4788,r));
const b=await chromium.launch({channel:'chrome',headless:false,args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:1600,height:900}});
const errs=[];pg.on("pageerror",e=>errs.push(String(e).slice(0,80)));
await pg.goto("http://localhost:4788/?snd=2");
await pg.waitForTimeout(2500);
await pg.mouse.click(1500,860); await pg.waitForTimeout(800);
const r=await pg.evaluate(async()=>{
  window.__clicks=0; const orig=sndClick;
  window.sndClick=(a,b)=>{window.__clicks++;return orig(a,b);};
  const an=AC.createAnalyser(); an.fftSize=4096; master.connect(an);
  const fd=new Float32Array(an.frequencyBinCount);
  const hz=i=>i*AC.sampleRate/an.fftSize;
  const band=(lo,hi)=>{an.getFloatFrequencyData(fd);
    let s=0,n=0;for(let i=0;i<fd.length;i++){const f=hz(i);
      if(f>=lo&&f<=hi){s+=Math.pow(10,fd[i]/10);n++;}}
    return 10*Math.log10(s/Math.max(1,n));};
  handleMsg({t:'reading',text:'why did you do this to me are you fucking stupid'});
  const his=[];const t1=performance.now()+4200;
  while(performance.now()<t1){his.push(band(900,5200));await new Promise(rr=>setTimeout(rr,70));}
  return {clicks:window.__clicks,hiPeak:+Math.max(...his).toFixed(1),state:AC.state};
});
console.log("v2:",JSON.stringify(r),"에러:",errs.length?errs:"없음");
await b.close(); await new Promise(rr=>srv.close(rr)); process.exit(0);
