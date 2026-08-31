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
pg.on("pageerror",e=>console.log("PAGEERR:",String(e).slice(0,150)));
await pg.goto("http://localhost:4779/"); await pg.waitForTimeout(1200);
console.log("before:",JSON.stringify(await pg.evaluate(()=>({n:letters.length}))));
send({t:"reading",text:"nobody wants you here you pathetic waste of oxygen honestly"});
for(const ms of [300,900,1800,3000]){
  await pg.waitForTimeout(ms);
  console.log(JSON.stringify(await pg.evaluate(()=>({
    n:letters.length, H:H(), W:W(),
    s:letters.slice(0,6).map(L=>({c:L.ch,x:Math.round(L.x),ox:Math.round(L.ox),sz:Math.round(L.size)}))
  }))));
}
await b.close(); await new Promise(r=>server.close(r)); process.exit(0);
