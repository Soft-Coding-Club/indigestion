import http from "node:http"; import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const root=fileURLToPath(new URL("../dist-web/",import.meta.url));
const mime={".html":"text/html;charset=utf-8",".jsonl":"text/plain;charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
const srv=http.createServer((q,r)=>{let p=(q.url||"/").split("?")[0]; if(p==="/")p="/index.html";
  const fp=root+p.slice(1); if(!existsSync(fp)){r.writeHead(404);r.end();return;}
  r.writeHead(200,{"content-type":mime[p.slice(p.lastIndexOf("."))]||"application/octet-stream"});
  r.end(readFileSync(fp));});
await new Promise(r=>srv.listen(4781,r));
const b=await chromium.launch({channel:'chrome',headless:false});
const pg=await b.newPage({viewport:{width:1600,height:900}});
await pg.goto("http://localhost:4781/");
await pg.evaluate(()=>{
  window.__why={life:0,size:0,bottom:0,top:0,spawned:0,pop:[],digs:[],refl:0,heap:[],vis:[]};
  let wasR=false; setInterval(()=>{const r=canalDir<0; if(r&&!wasR)__why.refl++; wasR=r;},50);
  const os=window.splice; const oa=Array.prototype.splice;
  // letters.splice 를 가로채 사라진 이유를 분류한다
  letters.splice=function(i,n){
    if(n===1){const L=this[i];const h=innerHeight;
      if(L.life<=0)__why.life++; else if(L.size<h*0.010)__why.size++;
      else if(L.y>h*1.2)__why.bottom++; else if(L.y<-h*0.25){__why.top++;__why.digs.push(+(L.dig||0).toFixed(1));}}
    return oa.apply(this,arguments);};
  const o=window.swallowText;
  window.swallowText=(t,m)=>{const b=letters.length;const r=o(t,m);__why.spawned+=letters.length-b;return r;};
  setInterval(()=>{__why.pop.push(letters.length);
    __why.vis.push(letters.filter(L=>L.size>innerHeight*0.018).length);
    const sub=letters.filter(L=>(L.dig||0)>0).map(L=>L.y);
    if(sub.length>6)__why.heap.push(Math.round(Math.max(...sub)-Math.min(...sub)));},1000);
});
await pg.waitForTimeout(60000);
const w=await pg.evaluate(()=>window.__why);
console.log("생성",w.spawned,"· 수명끝",w.life,"· 다삭음",w.size,"· 바닥밖",w.bottom,"· 게워짐",w.top);
const p=w.pop; const d=w.digs.sort((a,b)=>a-b);
console.log("게움 횟수",w.refl,"· 게워질 때 삭은 시간 중앙",d[d.length>>1],"초 · 최대",d[d.length-1],"초 · 11초 이상",d.filter(x=>x>=11).length,"개");
const hp=w.heap.sort((a,b)=>a-b);
const v=w.vis;
console.log("보이는 크기 글자: 평균",Math.round(v.reduce((a,b)=>a+b,0)/v.length),"· 6개 미만인 초",v.filter(x=>x<6).length,"/",v.length);
console.log("위산 더미 높이(px) 중앙",hp[hp.length>>1],"· 최대",hp[hp.length-1]);
console.log("평균",Math.round(p.reduce((a,b)=>a+b,0)/p.length),"· 최대",Math.max(...p),"· 빈",p.filter(x=>!x).length,"/",p.length,"초");
await b.close(); await new Promise(r=>srv.close(r)); process.exit(0);
