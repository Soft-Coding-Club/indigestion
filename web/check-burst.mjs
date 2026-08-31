import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { chromium } from "playwright";
const html = readFileSync(new URL("../public/renderer.html", import.meta.url), "utf8");
const server=http.createServer((req,res)=>{
  const p=(req.url||"/").split("?")[0];
  if(p.startsWith("/vendor/")){const fp=fileURLToPath(new URL("../public"+p,import.meta.url));
    if(existsSync(fp)){res.writeHead(200);res.end(readFileSync(fp));return;}}
  res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);});
const wss=new WebSocketServer({server,path:"/ws"});const cl=new Set();
wss.on("connection",w=>{cl.add(w);w.on("close",()=>cl.delete(w));});
const send=o=>{const s=JSON.stringify(o);for(const c of cl)if(c.readyState===1)c.send(s);};
await new Promise(r=>server.listen(4779,r));
const b=await chromium.launch({channel:'chrome',headless:false});
const pg=await b.newPage({viewport:{width:1600,height:900}});
await pg.goto("http://localhost:4779/"); await pg.waitForTimeout(1200);
send({t:"reading",text:"nobody wants you here you pathetic waste of oxygen honestly"});
for(const [i,ms] of [[1,1500],[2,1200],[3,1500],[4,2500],[5,3500]]){
  await pg.waitForTimeout(ms);
  await pg.screenshot({path:`out/burst-${i}.png`});
}
await b.close(); await new Promise(r=>server.close(r)); process.exit(0);
