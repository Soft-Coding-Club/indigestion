import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  const m={".html":"text/html;charset=utf-8",".json":"application/json",".jsonl":"text/plain",".woff2":"font/woff2",".png":"image/png"};
  r.writeHead(200,{"content-type":m[p.slice(p.lastIndexOf("."))]||"application/octet-stream"});r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4786,r));
const b=await chromium.launch({channel:'chrome',headless:false,args:['--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:1600,height:900}});
const errs=[]; pg.on("pageerror",e=>errs.push(String(e).slice(0,90)));
await pg.goto("http://localhost:4786/");
await pg.waitForTimeout(2500);
await pg.mouse.click(1500,860);            // 제스처 → initAudio (전체화면도 뜨지만 무방)
await pg.waitForTimeout(1200);
const rms=await pg.evaluate(async()=>{
  if(!audioOn) return {err:"audioOn=false"};
  const an=AC.createAnalyser(); an.fftSize=2048; master.connect(an);
  const buf=new Float32Array(an.fftSize);
  const meas=async ms=>{const out=[];const t1=performance.now()+ms;
    while(performance.now()<t1){an.getFloatTimeDomainData(buf);
      let s=0;for(let i=0;i<buf.length;i++)s+=buf[i]*buf[i];
      out.push(Math.sqrt(s/buf.length));
      await new Promise(r=>setTimeout(r,50));}
    const avg=out.reduce((a,b)=>a+b,0)/out.length;
    return {a:+avg.toFixed(4),p:+Math.max(...out).toFixed(4)};};
  const idle=await meas(2500);
  handleMsg({t:'reading',text:'you are the reason this family is broken'});
  const swallow=await meas(900);
  handleMsg({t:'verdict',v:'GAG',toxin:5,nourishment:-1,text:'x'});
  const gag=await meas(700);
  handleMsg({t:'verdict',v:'PURGE',toxin:7,nourishment:-2,text:'get out of her house right now'});
  const purge=await meas(2600);
  const hush=await meas(1500);
  return {state:AC.state,idle,swallow,gag,purge,hush};
});
console.log("RMS:",JSON.stringify(rms));
console.log("에러:",errs.length?errs:"없음");
await pg.evaluate(()=>{if(document.fullscreenElement)document.exitFullscreen();});
await pg.waitForTimeout(800);
await pg.screenshot({path:"out/poem-title.png"});
await b.close(); await new Promise(r=>srv.close(r)); process.exit(0);
