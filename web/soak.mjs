import { chromium } from "playwright";
const b=await chromium.launch({channel:'chrome',headless:false});
const pg=await b.newPage({viewport:{width:1600,height:900}});
const errs=[]; pg.on("pageerror",e=>errs.push(String(e).slice(0,90)));
await pg.goto("https://indigestion.vercel.app",{waitUntil:"load"});
await pg.evaluate(()=>{window.__f=0;(function t(){window.__f++;requestAnimationFrame(t);})();});
for(let i=0;i<4;i++){
  await pg.waitForTimeout(45000);
  const st=await pg.evaluate(()=>({n:letters.length,sed:+sedMass.toFixed(4),gls:glsN,
    day:+dayT.toFixed(3),f:window.__f,
    mem:performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):null}));
  console.log(`${(i+1)*45}초`, JSON.stringify(st));
}
console.log("에러:", errs.length?errs.slice(0,2):"없음");
await pg.screenshot({path:"out/soak.png"}); await b.close(); process.exit(0);
