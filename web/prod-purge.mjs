import { chromium } from "playwright";
const b=await chromium.launch({channel:'chrome',headless:false});
for(const [tag,qs] of [["아침",""]]){
  const pg=await b.newPage({viewport:{width:1600,height:900}});
  const errs=[];pg.on("pageerror",e=>errs.push(String(e).slice(0,80)));
  await pg.goto("https://indigestion.vercel.app/"+qs,{waitUntil:"load"});
  await pg.evaluate(()=>{window.__p=[];window.__n=[];window.__f=0;let w=false;
    (function t(){window.__f++;requestAnimationFrame(t);})();
    setInterval(()=>{const r=canalDir<0;if(r&&!w)window.__p.push(performance.now());w=r;
      window.__n.push(letters.length);},60);});
  await pg.waitForTimeout(270000);
  const r=await pg.evaluate(()=>({p:window.__p,n:window.__n,f:window.__f}));
  const g=[];for(let i=1;i<r.p.length;i++)g.push(Math.round((r.p[i]-r.p[i-1])/1000));
  const avg=g.length?Math.round(g.reduce((a,b)=>a+b,0)/g.length):0;
  console.log(`${tag} 게움 ${r.p.length}회 · 간격 ${g.join(" ")} (평균 ${avg}초) · 글자 평균 ${Math.round(r.n.reduce((a,b)=>a+b,0)/r.n.length)} 최대 ${Math.max(...r.n)} · ${(r.f/270).toFixed(0)}fps ${errs.length?"에러 "+errs[0]:"· 에러 없음"}`);
  await pg.close();
}
await b.close(); process.exit(0);
