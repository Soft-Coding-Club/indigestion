import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  const m={".html":"text/html;charset=utf-8",".json":"application/json",".jsonl":"text/plain",".woff2":"font/woff2",".png":"image/png"};
  r.writeHead(200,{"content-type":m[p.slice(p.lastIndexOf("."))]||"application/octet-stream"});r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4789,r));
const b=await chromium.launch({channel:'chrome',headless:false,args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:1600,height:900}});
await pg.goto("http://localhost:4789/?snd=2");
await pg.waitForTimeout(2000);
await pg.mouse.click(1500,860); await pg.waitForTimeout(600);
const r=await pg.evaluate(async()=>{
  const an=AC.createAnalyser(); an.fftSize=4096; master.connect(an);
  const fd=new Float32Array(an.frequencyBinCount);
  const hz=i=>i*AC.sampleRate/an.fftSize;
  const band=(lo,hi)=>{an.getFloatFrequencyData(fd);
    let s=0,n=0;for(let i=0;i<fd.length;i++){const f=hz(i);
      if(f>=lo&&f<=hi){s+=Math.pow(10,fd[i]/10);n++;}}
    return 10*Math.log10(s/Math.max(1,n));};
  // 수동 클릭 5발 — 최대 세기
  const out={audioOn, SND, lastClickBefore:lastClick, t:AC.currentTime};
  const his=[];
  for(let k=0;k<5;k++){
    lastClick=0; sndClick(1.0, H()*0.04);
    for(let j=0;j<4;j++){ his.push(band(900,5200)); await new Promise(rr=>setTimeout(rr,30)); }
  }
  out.hiPeak=+Math.max(...his).toFixed(1);
  out.sampleImp=[];
  // 실제 충돌 세기 분포도 잰다
  const P=[];const oo=window.sndClick;window.sndClick=(imp,sz)=>{P.push(+imp.toFixed(3));return oo(imp,sz);};
  await new Promise(rr=>setTimeout(rr,1500));
  window.sndClick=oo;
  P.sort((a,b)=>a-b);
  out.impMed=P[P.length>>1]; out.impP90=P[Math.floor(P.length*0.9)]; out.impMax=P[P.length-1]; out.nCalls=P.length;
  return out;
});
console.log(JSON.stringify(r));
await b.close(); await new Promise(rr=>srv.close(rr)); process.exit(0);
