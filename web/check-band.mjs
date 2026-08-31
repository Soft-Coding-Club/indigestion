import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  const m={".html":"text/html;charset=utf-8",".json":"application/json",".jsonl":"text/plain",".woff2":"font/woff2",".png":"image/png"};
  r.writeHead(200,{"content-type":m[p.slice(p.lastIndexOf("."))]||"application/octet-stream"});r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4787,r));
const b=await chromium.launch({channel:'chrome',headless:false,args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:1600,height:900}});
await pg.goto("http://localhost:4787/");
await pg.waitForTimeout(2500);
await pg.mouse.click(1500,860); await pg.waitForTimeout(1000);
const r=await pg.evaluate(async()=>{
  const an=AC.createAnalyser(); an.fftSize=4096; master.connect(an);
  const fd=new Float32Array(an.frequencyBinCount);
  const hz=i=>i*AC.sampleRate/an.fftSize;
  const band=(lo,hi)=>{an.getFloatFrequencyData(fd);
    let s=0,n=0;for(let i=0;i<fd.length;i++){const f=hz(i);
      if(f>=lo&&f<=hi){s+=Math.pow(10,fd[i]/10);n++;}}
    return 10*Math.log10(s/Math.max(1,n));};
  const meas=async ms=>{const lows=[],mids=[];const t1=performance.now()+ms;
    while(performance.now()<t1){lows.push(band(25,120));mids.push(band(350,3200));
      await new Promise(rr=>setTimeout(rr,60));}
    return {low:+Math.max(...lows).toFixed(1),mid:+Math.max(...mids).toFixed(1)};};
  lastSw=AC.currentTime+99999;              // 재생의 삼킴을 잠근다 (가드가 막음)
  await new Promise(rr=>setTimeout(rr,600));
  const idle=await meas(2500);
  lastSw=0; whispers=0;
  sndSwallow('why did you do this to me are you stupid');
  const sw=await meas(1400);
  return {idle,swallow:sw};
});
console.log("dB(피크):",JSON.stringify(r));
await b.close(); await new Promise(rr=>srv.close(rr)); process.exit(0);
