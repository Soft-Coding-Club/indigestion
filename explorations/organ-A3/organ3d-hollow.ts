// 3D 반투명 장기 — 속이 비치는 몸. 살을 통과해 관 내부가 보이고, 그 안을 말이 내려간다.
// 기법: 껍질 SDF(속 빈 관) + 살 통과 볼류메트릭 적분 + 내부 콘텐츠(단어 평면) 투과.
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { createCanvas } from "canvas";
import { init, effect, target, sampler, frame } from "vgpu/node";

const W = 1600, H = 900;

// 관 속을 내려가는 말 (텍스처: 세로로 흐르는 영어)
const cv = createCanvas(512, 2048), c = cv.getContext("2d");
c.fillStyle = "#000"; c.fillRect(0, 0, 512, 2048);
c.textAlign = "center"; c.fillStyle = "#fff";
const EN = ["NOBODY", "WANTS", "YOU", "HERE", "YOU", "PATHETIC", "WASTE", "OF", "OXYGEN"];
EN.forEach((w, i) => {
  c.font = `700 ${Math.round(84 - i * 3)}px Helvetica`;
  c.fillText(w, 256, 150 + i * 210);
});
const wordsData = c.getImageData(0, 0, 512, 2048).data;

const SH = `
struct P { t: f32, tox: f32, heave: f32 }
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var words: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
fn hash(n: vec3f)->f32{return fract(sin(dot(n,vec3f(127.1,311.7,74.7)))*43758.5453);}
fn noise(x: vec3f)->f32{
  let i=floor(x); let f=fract(x); let u=f*f*(3.-2.*f);
  let a=mix(hash(i+vec3f(0.,0.,0.)),hash(i+vec3f(1.,0.,0.)),u.x);
  let b=mix(hash(i+vec3f(0.,1.,0.)),hash(i+vec3f(1.,1.,0.)),u.x);
  let cc=mix(hash(i+vec3f(0.,0.,1.)),hash(i+vec3f(1.,0.,1.)),u.x);
  let d=mix(hash(i+vec3f(0.,1.,1.)),hash(i+vec3f(1.,1.,1.)),u.x);
  return mix(mix(a,b,u.y),mix(cc,d,u.y),u.z);}
fn fbm(x: vec3f)->f32{var v=0.;var a=.5;var q=x;
  for(var k=0;k<4;k++){v+=a*noise(q);q*=2.03;a*=.5;}return v;}

// 내강(속 빈 공간) — 이 안을 말이 내려간다
fn sdLumen(pos: vec3f)->f32{
  let t=p.t;
  let peri=0.026*sin(pos.y*5.0-t*1.1);
  let breathe=0.022*sin(t*1.46);
  let bendX=0.15*sin(pos.y*1.6+t*0.25);
  let bendZ=0.09*cos(pos.y*1.3+t*0.2);
  // 식도 내강
  let eso=length(vec2f(pos.x-bendX,pos.z-bendZ))-(0.105+breathe+peri+p.heave*0.05);
  let esoCapped=max(eso,-pos.y-0.25);
  // 위 내강 (비대칭)
  var sp=pos-vec3f(-0.10,-0.72,0.0);
  sp.x*=mix(0.72,1.15,smoothstep(-0.4,0.4,-sp.x));
  sp.y*=1.22;
  let wob=0.045*fbm(sp*3.0+vec3f(0.,t*0.06,0.));
  let stom=length(sp)-(0.50+breathe*1.3+wob+p.heave*0.05);
  let k=0.24;
  let h=clamp(0.5+0.5*(stom-esoCapped)/k,0.,1.);
  return mix(stom,esoCapped,h)-k*h*(1.-h);
}
// 바깥 살 표면 — 내강을 두께만큼 부풀린 것 + 표면 기하 디테일
fn sdOuter(pos: vec3f)->f32{
  var d=sdLumen(pos)-0.115;                       // 살 두께
  let ang=atan2(pos.z,pos.x+0.10);
  d-=0.014*sin(ang*11.0+pos.y*3.0+fbm(pos*2.2)*3.0);  // 주름
  d-=0.010*smoothstep(0.55,0.95,fbm(pos*3.4+vec3f(5.,0.,0.)));  // 혈관 융기
  d-=0.004*fbm(pos*13.0);
  return d;
}
fn nrmOuter(pos: vec3f)->vec3f{
  let e=vec2f(0.0015,0.);
  return normalize(vec3f(
    sdOuter(pos+e.xyy)-sdOuter(pos-e.xyy),
    sdOuter(pos+e.yxy)-sdOuter(pos-e.yxy),
    sdOuter(pos+e.yyx)-sdOuter(pos-e.yyx)));
}
// 위산 웅덩이 (아래 고임) — 발광하며 말을 삭인다
fn acidAt(pos: vec3f)->f32{
  let surf=-0.95+0.03*sin(p.t*0.43);
  let below=smoothstep(surf+0.10,surf-0.25,pos.y);
  let boil=0.55+0.45*fbm(pos*5.0+vec3f(0.,-p.t*0.3,0.));
  return below*boil;
}
// 내강 속 말 — 원통 좌표로 감아 붙인다. 아래로 흐르고, 산에 닿으면 삭는다.
fn wordAt(pos: vec3f)->f32{
  // 말은 화면과 나란한 평면에 선다 — 원통에 감으면 글자가 뭉개진다
  let u=clamp(pos.x*0.85+0.5, 0.0, 1.0);
  let v=fract(pos.y*-0.30 + p.t*0.030);
  let tex=textureSampleLevel(words,samp,vec2f(u,v),0.0).r;
  let melt=1.0-smoothstep(-0.72,-1.0,pos.y);       // 위산에서 삭는다
  let center=exp(-pos.z*pos.z*3.0);                // 관 중앙에 있는 것만 또렷
  return tex*melt*center;
}
@fragment fn fs_main(@location(0) uv: vec2f)->@location(0) vec4f{
  let asp=1.7778;
  let sc=(uv-0.5)*vec2f(asp,-1.0);
  let ro=vec3f(0.,-0.30,4.6);
  let rd=normalize(vec3f(sc*1.0,-2.5));
  var col=vec3f(0.007,0.003,0.003);

  // 1) 바깥 살 표면까지 행진
  var tt=0.0; var hit=false;
  for(var i=0;i<100;i++){
    let d=sdOuter(ro+rd*tt);
    if(d<0.0015){hit=true;break;}
    tt+=d*0.85; if(tt>7.0){break;}
  }
  if(hit){
    let pos=ro+rd*tt;
    let n=nrmOuter(pos);
    let V=-rd;
    let L=normalize(vec3f(-0.55,0.7,0.45));
    let ndl=max(dot(n,L),0.0);
    // 살 두께 측정 (광원 방향) — 얇은 데만 빛 머금음
    var thick=0.0;
    for(var s=1;s<=8;s++){
      if(sdOuter(pos-n*0.02+L*f32(s)*0.075)<0.0){thick+=0.075;}
    }
    let sss=exp(-thick*7.0);
    let rim=pow(1.0-max(dot(n,V),0.0),2.0);
    let organic=0.55+0.45*fbm(pos*6.0+vec3f(0.,p.t*0.05,0.));
    var flesh=vec3f(0.014,0.004,0.004)*organic;
    flesh+=vec3f(0.60,0.082,0.048)*sss*rim*(0.9+p.tox*0.6);
    flesh+=vec3f(0.070,0.017,0.015)*pow(ndl,2.2)*organic;
    let hv=normalize(L+V);
    let rough=0.34+0.25*fbm(pos*22.0);
    flesh+=vec3f(0.28,0.21,0.19)*pow(max(dot(n,hv),0.0),mix(90.,14.,rough))*0.30;

    // 2) ── 살을 통과해 안으로 — 반투명 볼류메트릭 적분 ──
    // 내강에 들어가면 말과 위산 빛을 모아, 살의 흡수를 곱해 내보낸다.
    var inner=vec3f(0.0);
    var trans=1.0;                    // 투과율
    var q=tt+0.02;
    var entered=false;
    for(var i=0;i<90;i++){
      let pp=ro+rd*q;
      let lum=sdLumen(pp);
      if(lum<0.0){                     // 내강 안 — 여기서만 콘텐츠가 보인다
        entered=true;
        let w=wordAt(pp);
        let a=acidAt(pp);
        inner+=vec3f(0.92,0.93,0.88)*w*0.115*trans;          // 삼켜진 말
        inner+=vec3f(0.75,0.20,0.07)*a*0.030*trans*(1.0+p.heave); // 위산 발광
        trans*=0.985;                                         // 내부 감쇠
      } else {
        trans*=exp(-0.20);                                    // 살을 지나며 흡수
      }
      q+=0.026;
      if(q>tt+3.4 || trans<0.02){break;}
    }
    // 살의 붉은 필터를 통과한 속빛
    let absorb=vec3f(0.55,0.13,0.09);
    flesh+=inner*absorb*2.6;
    col=flesh;
  } else {
    var acc=0.0;
    for(var i=0;i<20;i++){acc+=acidAt(ro+rd*(1.2+f32(i)*0.16))*0.02;}
    col+=vec3f(0.26,0.06,0.025)*acc*(1.0+p.heave*1.4);
  }
  col=(col*(2.51*col+0.03))/(col*(2.43*col+0.59)+0.14);
  col=pow(max(col,vec3f(0.)),vec3f(1.0/2.2));
  col+=(hash(vec3f(uv*1600.,p.t))-0.5)*0.020;
  let vg=1.0-0.5*pow(length((uv-0.5)*vec2f(1.15,1.0))*1.28,2.4);
  col*=max(vg,0.0);
  return vec4f(col,1.0);
}`;

const gpu = await init();
const dev: any = (gpu as any).device;
const tex = dev.createTexture({ size: [512, 2048], format: "rgba8unorm", usage: ["copy_dst", "texture_binding"] });
dev.gpu.queue.writeTexture({ texture: tex.gpu }, wordsData, { bytesPerRow: 512 * 4 }, [512, 2048]);
const out = target(gpu, { size: [W, H] });
const eff = effect(gpu, SH, {
  set: { p: { t: 2.4, tox: 0.35, heave: 0.0 }, words: tex, samp: sampler(gpu, { minFilter: "linear", magFilter: "linear" }) },
});
frame(gpu, (f) => f.pass(out, eff));
const px = await out.read();
const png = new PNG({ width: W, height: H }); png.data.set(px);
writeFileSync("organ3d-hollow2.png", PNG.sync.write(png));
console.log("hollow done");
gpu.dispose();
