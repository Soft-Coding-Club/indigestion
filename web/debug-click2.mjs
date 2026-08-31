import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  r.writeHead(200,{"content-type":p.endsWith(".html")?"text/html;charset=utf-8":"application/octet-stream"});
  r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4790,r));
const b=await chromium.launch({channel:'chrome',headless:false,args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:1600,height:900}});
await pg.goto("http://localhost:4790/?snd=2&vol=1");
await pg.waitForTimeout(2000);
await pg.mouse.click(1500,860); await pg.waitForTimeout(500);
const r=await pg.evaluate(async()=>{
  const an=AC.createAnalyser(); an.fftSize=2048; an.smoothingTimeConstant=0.2;
  master.connect(an);
  const td=new Float32Array(an.fftSize);
  const rmsPeak=async ms=>{const out=[];const t1=performance.now()+ms;
    while(performance.now()<t1){an.getFloatTimeDomainData(td);
      let s=0;for(let i=0;i<td.length;i++)s+=td[i]*td[i];
      out.push(Math.sqrt(s/td.length));await new Promise(rr=>setTimeout(rr,15));}
    return +Math.max(...out).toFixed(5);};
  const res={};
  // A: 원시 노이즈 직결 (필터 없음)
  {const n=AC.createBufferSource();n.buffer=noiseBuf(0.08,false);
   const g=AC.createGain();g.gain.value=0.3;n.connect(g);g.connect(master);
   n.start();res.raw=await rmsPeak(200);}
  // B: 밴드패스 Q9 통과
  {const n=AC.createBufferSource();n.buffer=noiseBuf(0.08,false);
   const bp=AC.createBiquadFilter();bp.type='bandpass';bp.Q.value=9;bp.frequency.value=1600;
   const g=AC.createGain();g.gain.value=0.3;n.connect(bp);bp.connect(g);g.connect(master);
   n.start();res.bp=await rmsPeak(200);}
  // C: sndClick 그대로
  {lastClick=0;sndClick(1.0,H()*0.04);res.click=await rmsPeak(200);}
  // D: sndClick의 감쇠 없이 (setValueAtTime만)
  {const t0=AC.currentTime;const n=AC.createBufferSource();n.buffer=clickBuf||noiseBuf(0.08,false);
   n.playbackRate.value=2.0;
   const bp=AC.createBiquadFilter();bp.type='bandpass';bp.Q.value=9;bp.frequency.value=1600;
   const g=AC.createGain();g.gain.setValueAtTime(0.3,t0);
   g.gain.exponentialRampToValueAtTime(0.0001,t0+0.06);
   n.connect(bp);bp.connect(g);g.connect(master);n.start(t0);n.stop(t0+0.09);
   res.clickD=await rmsPeak(200);}
  return res;
});
console.log(JSON.stringify(r));
await b.close(); await new Promise(rr=>srv.close(rr)); process.exit(0);
