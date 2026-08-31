// A3 — 모어(母語)가 몸의 살이다. 삼킴이 그 살을 뚫고 어두운 관을 낸다.
// 벽=한국어(소화되어 조직이 된 말), 관 속=영어(삼켜져 내려가는 세상의 말).
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { createCanvas } from "canvas";
import { init, effect, target, sampler, frame } from "vgpu/node";

const W = 1600, H = 900;
const cv = createCanvas(W, H), ctx = cv.getContext("2d");
ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
// 한국어 기념비 — 화면을 채우는 살. 관이 이걸 뚫고 지나간다.
ctx.fillStyle = "#fff"; ctx.textAlign = "center";
ctx.font = `700 200px "AppleMyungjo"`;
ctx.fillText("솔직히 이", W * 0.5, H * 0.34);
ctx.fillText("모든 게 역겹다", W * 0.5, H * 0.74);
const koImg = ctx.getImageData(0, 0, W, H);
// 내려가는 영어 — 별도 채널로
ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
ctx.textAlign = "center";
const en = ["HONESTLY", "THIS WHOLE", "THING", "MAKES ME", "SICK"];
en.forEach((w, i) => {
  const t = i / (en.length - 1);
  ctx.font = `700 ${Math.round(42 - t * 12)}px Helvetica`;
  ctx.fillStyle = `rgba(255,255,255,${(0.8 - t * 0.55).toFixed(2)})`;
  ctx.fillText(w, W * 0.5 + Math.sin(i * 2.1) * 20, 150 + i * 150);
});
const enImg = ctx.getImageData(0, 0, W, H);
// 두 텍스처를 한 RGBA에 합침: R=한국어 마스크, G=영어 마스크
const merged = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) {
  merged[i*4] = koImg.data[i*4];       // R: 한국어
  merged[i*4+1] = enImg.data[i*4];     // G: 영어
  merged[i*4+2] = 0; merged[i*4+3] = 255;
}

const SH = `
struct P { t: f32, tox: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var words: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
fn hash(n: vec2f)->f32{return fract(sin(dot(n,vec2f(127.1,311.7)))*43758.5453);}
fn noise(x: vec2f)->f32{let i=floor(x);let f=fract(x);let u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2f(1.,0.)),u.x),mix(hash(i+vec2f(0.,1.)),hash(i+vec2f(1.,1.)),u.x),u.y);}
fn fbm(x: vec2f)->f32{var v=0.;var a=0.5;var q=x;for(var i=0;i<4;i++){v+=a*noise(q);q*=2.02;a*=0.5;}return v;}
@fragment fn fs_main(@location(0) uv: vec2f)->@location(0) vec4f{
  let asp=vec2f(1.7778,1.0);
  let q=(uv-0.5)*asp;
  let breathe=0.5+0.03*sin(p.t*1.46);
  let peri=0.055*sin(q.y*5.0 - p.t*1.1);
  let bend=0.05*sin(q.y*1.8 + p.t*0.3);
  let wob=0.02*fbm(vec2f(q.y*4.0, p.t*0.2));
  let rad=0.20*breathe + peri + wob;
  let d=abs(q.x - bend) - rad;                       // 관 벽까지
  // 살짝 굴절된 좌표 (젖은 유리질 조직)
  let refr=vec2f(fbm(uv*5.0+p.t*0.04)-0.5, fbm(uv*5.0+vec2f(9.,0.))-0.5)*0.012;
  let ko=textureSampleLevel(words,samp,uv+refr,0.0).r;   // 한국어 = 살
  var col=vec3f(0.0);
  if(d<0.0){
    // 관 속 — 영어가 어둠으로 내려간다
    let depth=-d/max(rad,0.05);
    let en=textureSampleLevel(words,samp,uv,0.0).g;
    col=vec3f(en)*0.55*(0.4+0.6*depth)*(1.0-p.tox*0.5);
    col*=smoothstep(0.0,0.5,1.0-depth*0.5);            // 중심은 삼키는 어둠
    // 관 벽 안쪽 점막
    let wall=smoothstep(0.6,0.0,depth);
    col+=vec3f(0.30,0.09,0.07)*wall*(0.5+p.tox*1.3);
    col+=vec3f(0.13,0.12,0.12)*pow(wall,3.0)*0.5;
  } else {
    // 벽 너머 — 모어의 살. 한국어가 조직 속에서 빛난다.
    let flesh=fbm(uv*6.0+vec2f(0.,p.t*0.05));
    col=vec3f(0.038,0.013,0.011)*(0.5+flesh);          // 검붉은 살 바탕
    // 소화된 한국어 = 발광하는 조직 (병들수록 탁해져 흐려짐)
    let glow=ko*(1.0-p.tox*0.55);
    col+=vec3f(0.62,0.56,0.48)*glow*0.9;               // 뼈빛 발광
    col+=vec3f(0.20,0.06,0.05)*glow*0.3;               // 살에 스민 온기
    col+=vec3f(0.12,0.05,0.04)*smoothstep(0.05,0.0,d)*(0.6+p.tox); // 관 가장자리 젖은 림
  }
  col*=0.92+0.14*fbm(uv*vec2f(20.,20.)+p.t*0.3);
  col+=(hash(uv*1600.+p.t)-0.5)*0.022;
  let v=1.0-0.5*pow(length(q)*0.82,2.6);
  col*=max(v,0.0);
  return vec4f(col,1.0);
}`;

const gpu = await init();
const dev: any = (gpu as any).device;
const tex = dev.createTexture({ size: [W, H], format: "rgba8unorm", usage: ["copy_dst", "texture_binding"] });
dev.gpu.queue.writeTexture({ texture: tex.gpu }, merged, { bytesPerRow: W * 4 }, [W, H]);
const out = target(gpu, { size: [W, H] });
const eff = effect(gpu, SH, { set: { p: { t: 2.4, tox: 0.4 }, words: tex, samp: sampler(gpu, { minFilter: "linear", magFilter: "linear" }) } });
frame(gpu, (f) => f.pass(out, eff));
const px = await out.read();
const png = new PNG({ width: W, height: H }); png.data.set(px);
writeFileSync("draftA3.png", PNG.sync.write(png));
console.log("A3 done");
gpu.dispose();
