// A6 — A5를 더 깊게. 비대칭 위(대만곡/소만곡), 분문 골, 산의 수면, lost-and-found 윤곽.
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { createCanvas } from "canvas";
import { init, effect, target, sampler, frame } from "vgpu/node";

const W = 1600, H = 900;
const cv = createCanvas(W, H), c = cv.getContext("2d");
c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
c.textAlign = "center"; c.font = `700 200px "AppleMyungjo"`;
c.shadowColor = "rgba(255,0,0,0.55)"; c.shadowBlur = 46;
c.fillStyle = "rgba(255,0,0,0.35)";
c.fillText("솔직히 이", W * 0.5, H * 0.34);
c.fillText("모든 게 역겹다", W * 0.5, H * 0.74);
c.shadowBlur = 0;
c.fillStyle = "rgba(255,0,0,0.95)";
c.fillText("솔직히 이", W * 0.5, H * 0.34);
c.fillText("모든 게 역겹다", W * 0.5, H * 0.74);
const koD = c.getImageData(0, 0, W, H).data;
c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
const EN = ["HONESTLY", "THIS WHOLE", "THING", "MAKES ME", "SICK"];
EN.forEach((w, i) => {
  const t = i / (EN.length - 1);
  c.font = `700 ${Math.round(40 - t * 14)}px Helvetica`;
  c.fillStyle = `rgba(0,255,0,${(0.85 - t * 0.6).toFixed(2)})`;
  c.fillText(w, W * 0.5 + Math.sin(i * 2.1) * 16, 120 + i * 140);
});
const enD = c.getImageData(0, 0, W, H).data;
const merged = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { merged[i*4]=koD[i*4]; merged[i*4+1]=enD[i*4+1]; merged[i*4+2]=0; merged[i*4+3]=255; }

const SH = `
struct P { t: f32, tox: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var words: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
fn hash(n: vec2f)->f32{return fract(sin(dot(n,vec2f(127.1,311.7)))*43758.5453);}
fn noise(x: vec2f)->f32{let i=floor(x);let f=fract(x);let u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2f(1.,0.)),u.x),mix(hash(i+vec2f(0.,1.)),hash(i+vec2f(1.,1.)),u.x),u.y);}
fn fbm(x: vec2f)->f32{var v=0.;var a=.5;var q=x;for(var k=0;k<4;k++){v+=a*noise(q);q*=2.02;a*=.5;}return v;}
@fragment fn fs_main(@location(0) uv: vec2f)->@location(0) vec4f{
  let asp=vec2f(1.7778,1.0);
  let q0=(uv-0.5)*asp;
  // 미세한 기울기 — 수직의 죽음을 피한다
  let ca=cos(0.06); let sa=sin(0.06);
  let q=vec2f(q0.x*ca-q0.y*sa, q0.x*sa+q0.y*ca);
  let t=p.t;
  let breathe=0.5+0.03*sin(t*1.46);
  let peri=0.030*sin(q.y*6.0 - t*1.1);
  let bend=0.10*sin(q.y*2.1 + t*0.25)-0.02;
  // ── 비대칭 위: 왼쪽=대만곡(불룩·불규칙), 오른쪽=소만곡(완만) ──
  let stomachY=smoothstep(0.02,0.40,q.y);
  let eso=0.105*breathe;
  let radL=eso+0.36*stomachY*(1.0+0.22*fbm(vec2f(q.y*3.0,7.0)))+0.020*fbm(vec2f(q.y*6.0,1.0));
  let radR=eso+0.15*stomachY+0.014*fbm(vec2f(q.y*6.0,4.0));
  let side=q.x-bend;
  let rad=select(radR,radL,side<0.0)+peri;
  let d=abs(side)-rad;
  let refr=vec2f(fbm(uv*5.0+t*0.04)-.5, fbm(uv*5.0+vec2f(9.,0.))-.5)*0.012;
  let ko=textureSampleLevel(words,samp,uv+refr,0.0).r;
  // 분문 골 — 식도가 위로 꺾여 들어가는 자리의 깊은 음영
  let cardia=1.0-0.55*exp(-pow((q.y-0.06)/0.09,2.0))*smoothstep(0.30,0.0,abs(d));
  // 산의 수면 — 위 속 액면. 숨에 따라 아주 느리게 출렁인다.
  let poolY=0.245+0.012*sin(t*0.43)+0.01*fbm(vec2f(q.x*3.0,t*0.2));
  var col=vec3f(0.0);
  if(d<0.0){
    let depth=-d/max(rad,0.05);
    let foldN=9.0;
    let fold=0.5+0.5*sin(side/max(rad,0.05)*foldN + fbm(vec2f(q.y*7.0,t*0.1))*4.5 + q.y*3.0);
    let foldSh=mix(0.25,1.0,pow(fold,2.2));
    let en=textureSampleLevel(words,samp,uv,0.0).g;
    // 말은 수면에 닿으며 녹는다
    let melt=1.0-smoothstep(poolY-0.06,poolY+0.09,q.y);
    col=vec3f(en)*0.6*(0.35+0.65*depth)*melt;
    col*=smoothstep(0.0,0.5,1.0-depth*0.45);
    col*=mix(1.0,0.10,pow(depth,2.0));
    // 수면 아래 — 산성 murk, 녹은 것들의 침전
    let below=smoothstep(poolY,poolY+0.05,q.y);
    let murk=0.4+0.6*fbm(uv*vec2f(6.,9.)+vec2f(0.,-t*0.12));
    col+=vec3f(0.15,0.045,0.028)*below*murk*(1.0+p.tox);
    // 수면선 — 얇은 젖은 광택 한 줄
    let surf=exp(-pow((q.y-poolY)/0.010,2.0))*smoothstep(0.3,0.75,depth);
    let glint=smoothstep(0.45,0.85,fbm(vec2f(q.x*22.0,t*0.5)));
    col+=vec3f(0.30,0.15,0.09)*surf*glint*0.8;
    // 점막 벽
    let wall=smoothstep(0.72,0.0,depth);
    let mottle=0.55+0.45*fbm(vec2f(q.x*14.0,q.y*10.0)+t*0.07);
    col+=vec3f(0.34,0.09,0.06)*wall*foldSh*mottle*(0.6+p.tox*1.2);
    col+=vec3f(0.17,0.14,0.12)*pow(wall*fold,3.0)*mottle*1.1;
    col*=cardia;
  }else{
    let vein=fbm(uv*3.2+vec2f(0.,t*0.03));
    let vein2=fbm(uv*9.0+vec2f(4.,t*0.05));
    var flesh=vec3f(0.075,0.022,0.018)*(0.35+vein*1.1);
    flesh+=vec3f(0.05,0.010,0.008)*smoothstep(0.5,0.78,vein2);
    flesh*=0.75+0.5*fbm(uv*vec2f(2.0,1.4)+vec2f(7.,0.));
    let glow=ko*(1.0-p.tox*0.5);
    flesh*=1.0+glow*2.2;
    flesh+=vec3f(0.60,0.53,0.44)*pow(glow,1.35)*0.95;
    flesh+=vec3f(0.24,0.07,0.05)*glow*0.55;
    // lost-and-found 윤곽 — 립이 살았다 사라졌다 한다
    let lip=smoothstep(0.012,0.0,d)-smoothstep(0.0,-0.006,d);
    let lostfound=smoothstep(0.25,0.75,fbm(vec2f(q.y*5.0,3.3)+t*0.02));
    flesh+=vec3f(0.30,0.15,0.11)*max(lip,0.0)*lostfound;
    // 바깥 살에도 장기 그림자 — 몸이 관을 품고 있다
    flesh*=1.0-0.35*exp(-abs(d)*9.0);
    flesh*=cardia;
    col=flesh;
  }
  col*=0.90+0.16*fbm(uv*vec2f(20.,20.)+t*0.3);
  col*=mix(0.70,1.06,smoothstep(0.0,0.55,uv.y));
  col+=(hash(uv*1600.+t)-.5)*0.022;
  let vg=1.0-0.55*pow(length(q*vec2f(0.82,1.0))*0.85,2.5);
  col*=max(vg,0.0);
  return vec4f(col,1.0);
}`;

const gpu = await init();
const dev: any = (gpu as any).device;
const tex = dev.createTexture({ size:[W,H], format:"rgba8unorm", usage:["copy_dst","texture_binding"] });
dev.gpu.queue.writeTexture({ texture: tex.gpu }, merged, { bytesPerRow: W*4 }, [W,H]);
const out = target(gpu, { size:[W,H] });
const eff = effect(gpu, SH, { set:{ p:{t:2.4,tox:0.35}, words:tex, samp:sampler(gpu,{minFilter:"linear",magFilter:"linear"}) } });
frame(gpu,(f)=>f.pass(out,eff));
const px = await out.read();
const png = new PNG({width:W,height:H}); png.data.set(px);
writeFileSync("draftA7.png", PNG.sync.write(png));
console.log("A6 done");
gpu.dispose();
