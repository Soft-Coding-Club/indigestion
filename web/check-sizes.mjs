import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const dist = fileURLToPath(new URL("../dist-web", import.meta.url));
const MIME={".html":"text/html",".css":"text/css",".js":"text/javascript",".woff2":"font/woff2",".jsonl":"text/plain",".png":"image/png"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent((req.url||"/").split("?")[0]);if(p==="/")p="/index.html";
  const fp=dist+p; if(!existsSync(fp)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":MIME[p.slice(p.lastIndexOf("."))]||"application/octet-stream"});res.end(readFileSync(fp));});
await new Promise(r=>server.listen(8091,r));
const b=await chromium.launch({channel:'chrome',headless:false});
for(const [name,w,h] of [["laptop",1440,900],["wide",2560,1080],["portrait",1080,1920]]){
  const pg=await b.newPage({viewport:{width:w,height:h}});
  await pg.goto("http://localhost:8091/"); await pg.waitForTimeout(7000);
  await pg.screenshot({path:`out/size-${name}.png`}); await pg.close();
  console.log(name,"ok");
}
await b.close(); await new Promise(r=>server.close(r)); process.exit(0);
