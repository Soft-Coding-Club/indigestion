import { chromium } from "playwright";
const b=await chromium.launch({channel:'chrome',headless:false});
const pg=await b.newPage({viewport:{width:1400,height:900}});
await pg.goto("https://www.reddit.com/r/relationship_advice/",{waitUntil:"domcontentloaded"});
await pg.waitForTimeout(6000);
const out=await pg.evaluate(async()=>{
  const g=async u=>{const r=await fetch(u,{credentials:"include",headers:{accept:"application/json"}});
    if(!r.ok)throw new Error(r.status);return r.json();};
  const l=await g("https://www.reddit.com/r/relationship_advice/controversial.json?t=week&limit=5");
  const p=(l.data?.children||[])[0].data;
  const res={title:p.title.slice(0,80),body:(p.selftext||"").replace(/\s+/g," ").slice(0,200),sorts:{}};
  for(const sort of ["confidence","controversial"]){
    const t=await g(`https://www.reddit.com${p.permalink}.json?sort=${sort}&limit=50`);
    const cs=(t[1]?.data?.children||[]).map(c=>c.data).filter(c=>c.body&&c.body.length>40)
      .map(c=>({s:c.score,b:c.body.replace(/\s+/g," ").slice(0,130)}));
    res.sorts[sort]={n:cs.length,scores:cs.slice(0,10).map(c=>c.s),
      first5:cs.slice(0,5).map(c=>`(${c.s}) ${c.b}`)};
    await new Promise(r=>setTimeout(r,2000));
  }
  return res;
});
console.log("글:",out.title);
for(const [k,v] of Object.entries(out.sorts)){
  console.log(`\n===== sort=${k} · 상위 10개 점수 [${v.scores.join(", ")}] =====`);
  v.first5.forEach(x=>console.log("  ",x));
}
await b.close(); process.exit(0);
