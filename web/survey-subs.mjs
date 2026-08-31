import { chromium } from "playwright";
const SUBS = ["insaneparents","AmItheAsshole","confession","TrueOffMyChest",
              "raisedbynarcissists","JUSTNOMIL","insanepeoplefacebook","relationship_advice"];
const b=await chromium.launch({channel:'chrome',headless:false});
const pg=await b.newPage({viewport:{width:1400,height:900}});
await pg.goto("https://www.reddit.com/r/insaneparents/",{waitUntil:"domcontentloaded"});
await pg.waitForTimeout(6000);
for(const s of SUBS){
  const r=await pg.evaluate(async(sub)=>{
    try{
      const res=await fetch(`https://www.reddit.com/r/${sub}/controversial.json?t=week&limit=50`,{credentials:"include",headers:{"accept":"application/json"}});
      if(!res.ok) return {err:res.status};
      const j=await res.json(); const ch=(j.data?.children||[]).map(c=>c.data);
      const self=ch.filter(p=>(p.selftext||"").trim().length>200);
      return {n:ch.length, self:self.length,
        medLen:self.length?self.map(p=>p.selftext.length).sort((a,b)=>a-b)[self.length>>1]:0,
        ex:self.slice(0,2).map(p=>(p.selftext||"").replace(/\s+/g," ").slice(0,110))};
    }catch(e){return {err:String(e).slice(0,60)};}
  },s);
  console.log(`r/${s}`.padEnd(24), r.err?`ERR ${r.err}`:`글 ${r.n} · 본문200자↑ ${r.self} · 중앙길이 ${r.medLen}`);
  if(r.ex) r.ex.forEach(x=>console.log("      ·",x));
  await pg.waitForTimeout(1200);
}
await b.close(); process.exit(0);
