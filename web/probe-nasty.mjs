import { chromium } from "playwright";
const b=await chromium.launch({channel:'chrome',headless:false});
const pg=await b.newPage({viewport:{width:1400,height:900}});
await pg.goto("https://www.reddit.com/r/AmItheAsshole/",{waitUntil:"domcontentloaded"});
await pg.waitForTimeout(6000);
const out=await pg.evaluate(async()=>{
  const g=async u=>{const r=await fetch(u,{credentials:"include",headers:{accept:"application/json"}});
    if(!r.ok)throw new Error(r.status);return r.json();};
  const res={};
  for(const sub of ["AmItheAsshole","insaneparents"]){
    try{
      const l=await g(`https://www.reddit.com/r/${sub}/controversial.json?t=week&limit=8`);
      const posts=(l.data?.children||[]).map(c=>c.data);
      res[sub]={selftextPosts:posts.filter(p=>(p.selftext||"").trim().length>200).length,total:posts.length,threads:[]};
      for(const sort of ["confidence","controversial"]){
        const p=posts[0];
        const t=await g(`https://www.reddit.com${p.permalink}.json?sort=${sort}&limit=40`);
        const cs=(t[1]?.data?.children||[]).map(c=>c.data).filter(c=>c.body)
          .map(c=>({s:c.score,b:c.body.replace(/\s+/g," ").slice(0,150)}));
        cs.sort((a,b2)=>a.s-b2.s);
        res[sub].threads.push({sort,title:p.title.slice(0,70),
          n:cs.length,minScore:cs[0]?.s,worst:cs.slice(0,4)});
      }
    }catch(e){res[sub]={err:String(e).slice(0,50)};}
    await new Promise(r=>setTimeout(r,2500));
  }
  return res;
});
console.log(JSON.stringify(out,null,1).slice(0,4200));
await b.close(); process.exit(0);
