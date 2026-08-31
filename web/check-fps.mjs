import { chromium } from "playwright";
const b=await chromium.launch({channel:'chrome',headless:false});
for(const [q,dpr] of [['1','1.4'],['0.5','1'],['0','1']]){
  const pg=await b.newPage({viewport:{width:1600,height:900}});
  await pg.goto(`https://indigestion.vercel.app/?q=${q}&dpr=${dpr}`);
  await pg.waitForTimeout(4000);
  const fps=await pg.evaluate(()=>new Promise(res=>{let n=0;const t0=performance.now();
    const tick=()=>{n++; if(performance.now()-t0<3000) requestAnimationFrame(tick); else res(Math.round(n/((performance.now()-t0)/1000)));};
    requestAnimationFrame(tick);}));
  console.log(`q=${q} dpr=${dpr}  →  ${fps} fps`);
  await pg.close();
}
await b.close(); process.exit(0);
