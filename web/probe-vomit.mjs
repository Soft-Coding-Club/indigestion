import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { chromium } from "playwright";
const html=readFileSync(new URL("../public/renderer.html",import.meta.url),"utf8");
const server=http.createServer((q,r)=>{const p=(q.url||"/").split("?")[0];
 if(p.startsWith("/vendor/")){const fp=fileURLToPath(new URL("../public"+p,import.meta.url));
  if(existsSync(fp)){r.writeHead(200);r.end(readFileSync(fp));return;}}
 r.writeHead(200,{"content-type":"text/html; charset=utf-8"});r.end(html);});
const wss=new WebSocketServer({server,path:"/ws"});const cl=new Set();
wss.on("connection",w=>{cl.add(w);w.on("close",()=>cl.delete(w));});
const send=o=>{const s=JSON.stringify(o);for(const c of cl)if(c.readyState===1)c.send(s);};
await new Promise(r=>server.listen(4779,r));
const b=await chromium.launch({channel:'chrome',headless:false});
const pg=await b.newPage({viewport:{width:1600,height:900}});
await pg.goto("http://localhost:4779/"); await pg.waitForTimeout(1000);
const feed=["nobody wants you here you pathetic waste of oxygen",
            "you are the reason your family stopped calling you",
            "everyone talks about how insufferable you really are"];
for(const f of feed){ send({t:"reading",text:f}); await pg.waitForTimeout(1800); }
// 엔진 게움을 직접 걸어 역류 과정을 관찰
send({t:"verdict",v:"PURGE",nourishment:-2,text:"kys nobody wants you here waste of oxygen"});
for(let i=0;i<6;i++){
  await pg.waitForTimeout(420);
  const st=await pg.evaluate(()=>({n:letters.length,dir:canalDir,
    hi:letters.length?Math.round(Math.min(...letters.map(L=>L.y))):null,
    lo:letters.length?Math.round(Math.max(...letters.map(L=>L.y))):null}));
  console.log(i,JSON.stringify(st));
  await pg.screenshot({path:`out/vomit-${i}.png`});
}
await b.close(); await new Promise(r=>server.close(r)); process.exit(0);
