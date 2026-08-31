import { chromium } from "playwright";
const b=await chromium.launch({channel:'chrome',headless:false,args:['--disable-frame-rate-limit','--disable-gpu-vsync']});
for(const [q,dpr] of [['1','1.4'],['0.35','1']]){
  const pg=await b.newPage({viewport:{width:1600,height:900}});
  await pg.goto(`https://indigestion.vercel.app/?q=${q}&dpr=${dpr}`);
  await pg.waitForTimeout(4500);
  // 드로우콜을 강제로 여러 번 돌려 CPU 아닌 GPU 소요를 잰다
  const ms=await pg.evaluate(()=>{
    const c=document.getElementById('gl'), gl=c.getContext('webgl');
    const t0=performance.now();
    for(let i=0;i<30;i++){ gl.drawArrays(gl.TRIANGLES,0,3); }
    gl.finish&&gl.finish();
    const px=new Uint8Array(4); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); // 동기화
    return (performance.now()-t0)/30;
  });
  console.log(`q=${q} dpr=${dpr}  →  ${ms.toFixed(1)} ms/frame  (≈${Math.round(1000/ms)} fps 상한)`);
  await pg.close();
}
await b.close(); process.exit(0);
