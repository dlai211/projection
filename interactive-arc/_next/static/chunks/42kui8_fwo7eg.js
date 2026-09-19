(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,34569,e=>{"use strict";var t=e.i(43476),r=e.i(71645);let n=`
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`,a=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uHover;

const float PI  = 3.14159265;
const float TAU = 6.28318531;

float sat(float x){ return clamp(x, 0.0, 1.0); }
float pw(float x, float e){ return pow(max(x, 1e-5), e); }
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 34.56); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm3(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.07 + vec2(4.1, 2.3); a *= 0.5; } return s; }

uniform vec3 uBg, uBase, uAccent, uHigh;
uniform float uStrands, uCurve, uSpread, uThin, uComb, uReach, uDir;

void main(){
  float ar = uRes.x / max(uRes.y, 1.0);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(ar, 1.0);
  float t = uTime;
  vec2 apex = vec2(0.34, 0.20);

  float cs = cos(uDir), sn = sin(uDir);
  mat2 rot = mat2(cs, sn, -sn, cs);
  vec2 q  = rot * p;
  vec2 pm = q - rot * ((uMouse - 0.5) * vec2(ar, 1.0));
  vec2 ps = q - normalize(pm + vec2(1e-5)) * uComb * 0.10 * sat(uHover)
            * exp(-dot(pm, pm) / max(uReach * uReach, 1e-4));
  float core = 0.0, halo = 0.0;
  for(int i = 0; i < 26; i++){
    float fi = float(i);
    float f = fi / 25.0;
    float on = sat(uStrands - fi);
    float jit = hash21(vec2(fi, 1.7));
    float k = uCurve * (0.55 + 1.30 * f + 0.10 * jit);
    float ax = apex.x + (f - 0.5) * uSpread * 0.18;
    float ay = apex.y + (f - 0.5) * uSpread * 0.14 + 0.012 * sin(t * 0.5 + fi);
    float dx = ps.x - ax;
    float yc = ay - k * dx * dx;
    float sl = -2.0 * k * dx;
    float dd = abs(ps.y - yc) / sqrt(1.0 + sl * sl);
    float w = uThin * (0.0016 + 0.0032 * jit);
    core += on * pw(w / (w + dd), 3.2);
    halo += on * pw(w * 11.0 / (w * 11.0 + dd), 1.9) * 0.085;
  }
  float env = mix(0.20, 1.0, sat((ps.x + 0.52) / 0.95));
  core *= env; halo *= env;
  vec3 col = uBg;
  col += uBase * halo * 1.5;
  col += mix(uAccent, uHigh, sat(core * 0.75)) * core * 1.4;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;function i(e,t,r){let n=e.createShader(t);return n?(e.shaderSource(n,r),e.compileShader(n),e.getShaderParameter(n,e.COMPILE_STATUS))?n:(console.error("FibreArc shader:",e.getShaderInfoLog(n)),e.deleteShader(n),null):null}function o(e,t){if(!e)return t;let r=String(e).trim();if("#"===r.charAt(0)){let e=r.slice(1);if((3===e.length||4===e.length)&&(e=e[0]+e[0]+e[1]+e[1]+e[2]+e[2]),e.length>=6){let t=parseInt(e.slice(0,2),16),r=parseInt(e.slice(2,4),16),n=parseInt(e.slice(4,6),16);if(!isNaN(t)&&!isNaN(r)&&!isNaN(n))return[t/255,r/255,n/255]}return t}let n=r.match(/[\d.]+/g);return n&&n.length>=3?[Math.min(255,parseFloat(n[0]))/255,Math.min(255,parseFloat(n[1]))/255,Math.min(255,parseFloat(n[2]))/255]:t}function l(e,t){return"number"==typeof e&&isFinite(e)?e:t}function u(e,t,r){return e<t?t:e>r?r:e}let f={curve:150,spread:100,thickness:100,comb:170};function c(e){let{style:c,background:s="#01030A",baseColor:h="#1B4FD8",accentColor:m="#6FC8FF",highlight:d="#FFFFFF",density:p=26,speed:v=100,direction:g=0,hover:x=200,reach:b=23,bundle:w,width:A,height:y}=e,F={...f,...w||{}},R=(0,r.useRef)(null),M=(0,r.useRef)({w:0,h:0});M.current={w:l(A,0),h:l(y,0)};let T=(0,r.useRef)({});T.current={background:s,baseColor:h,accentColor:m,highlight:d,density:u(l(p,26),4,26),speed:u(l(v,50),0,100)/50,direction:u(l(g,0),0,360)*Math.PI/180,hover:u(l(x,100),0,200)/100,reach:u(l(b,30),5,100)/100,curve:u(l(F.curve,150),20,400)/100,spread:u(l(F.spread,100),0,300)/100,thickness:u(l(F.thickness,100),20,400)/100,comb:u(l(F.comb,170),0,400)/100};let S=(0,r.useRef)({x:.5,y:.5,tx:.5,ty:.5,on:0,onTarget:0});return(0,r.useEffect)(()=>{let e=R.current;if(!e)return;let t=e.getContext("webgl",{antialias:!1,alpha:!1,depth:!1});if(!t)return void console.error("FibreArc: WebGL unavailable");let r=i(t,t.VERTEX_SHADER,n),l=i(t,t.FRAGMENT_SHADER,a);if(!r||!l)return;let f=t.createProgram();if(!f)return;if(t.attachShader(f,r),t.attachShader(f,l),t.linkProgram(f),!t.getProgramParameter(f,t.LINK_STATUS))return void console.error("FibreArc link:",t.getProgramInfoLog(f));t.useProgram(f);let c=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,c),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),t.STATIC_DRAW);let s=t.getAttribLocation(f,"a_pos");t.enableVertexAttribArray(s),t.vertexAttribPointer(s,2,t.FLOAT,!1,0,0);let h={},m=e=>(e in h||(h[e]=t.getUniformLocation(f,e)),h[e]),d=0,p=performance.now(),v=0,g=r=>{let n=Math.min(.05,(r-p)/1e3);p=r;let a=T.current;v=(v+n*a.speed)%3600;let i=S.current,l=1-Math.exp(-6*n);i.on+=(i.onTarget-i.on)*l,i.x+=((i.onTarget>0?i.tx:.5)-i.x)*l,i.y+=((i.onTarget>0?i.ty:.5)-i.y)*l;let u=Math.min(window.devicePixelRatio||1,2),f=M.current.w||e.clientWidth||1200,c=M.current.h||e.clientHeight||800,s=Math.max(1,Math.round(f*u)),h=Math.max(1,Math.round(c*u));(e.width!==s||e.height!==h)&&(e.width=s,e.height=h),t.viewport(0,0,s,h),t.uniform2f(m("uRes"),s,h),t.uniform1f(m("uTime"),v),t.uniform2f(m("uMouse"),i.x,1-i.y),t.uniform1f(m("uHover"),Math.min(1,i.on)*a.hover);let x=o(a.background,[.004,.012,.039]);t.uniform3f(m("uBg"),x[0],x[1],x[2]);let b=o(a.baseColor,[.106,.31,.847]);t.uniform3f(m("uBase"),b[0],b[1],b[2]);let w=o(a.accentColor,[.435,.784,1]);t.uniform3f(m("uAccent"),w[0],w[1],w[2]);let A=o(a.highlight,[1,1,1]);t.uniform3f(m("uHigh"),A[0],A[1],A[2]),t.uniform1f(m("uStrands"),a.density),t.uniform1f(m("uReach"),a.reach),t.uniform1f(m("uDir"),a.direction),t.uniform1f(m("uCurve"),a.curve),t.uniform1f(m("uSpread"),a.spread),t.uniform1f(m("uThin"),a.thickness),t.uniform1f(m("uComb"),a.comb),t.drawArrays(t.TRIANGLES,0,3),d=requestAnimationFrame(g)},x=t=>{let r=e.getBoundingClientRect();r.width<=0||r.height<=0||(S.current.tx=u((t.clientX-r.left)/r.width,0,1),S.current.ty=u((t.clientY-r.top)/r.height,0,1),S.current.onTarget=1)},b=()=>{S.current.onTarget=0};return e.addEventListener("pointermove",x),e.addEventListener("pointerenter",x),e.addEventListener("pointerleave",b),d=requestAnimationFrame(g),()=>{cancelAnimationFrame(d),e.removeEventListener("pointermove",x),e.removeEventListener("pointerenter",x),e.removeEventListener("pointerleave",b)}},[]),(0,t.jsx)("div",{style:{position:"relative",overflow:"hidden",background:s,minWidth:1200,minHeight:800,width:"number"==typeof A&&A>0?A:"100%",height:"number"==typeof y&&y>0?y:"100%",...c},children:(0,t.jsx)("canvas",{ref:R,style:{position:"absolute",inset:0,width:"100%",height:"100%",display:"block"}})})}let s={bundle:{comb:170,curve:20,spread:100,thickness:100}};e.s(["default",0,function(e){return(0,t.jsx)(c,{...s,...e})}])},71080,e=>{"use strict";var t=e.i(43476),r=e.i(71645);e.s(["default",0,function(){let e=(0,r.useRef)(null);return(0,r.useEffect)(()=>{let t,r=e.current;if(!r)return;let n=r.getContext("2d");if(!n)return;let a=()=>{r.width=window.innerWidth,r.height=window.innerHeight};window.addEventListener("resize",a),a();let i=Array.from({length:3e3},()=>({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:1.5*Math.random()+.3,color:Math.random()>.8?"#ffcc99":Math.random()>.6?"#99ccff":"#ffffff",a:.8*Math.random()+.2,twinkle:Math.random()*Math.PI*2})),o=e=>{for(let t of(n.clearRect(0,0,r.width,r.height),i)){let r=.6+.4*Math.sin(.0016*e+t.twinkle);n.beginPath(),n.arc(t.x,t.y,t.r,0,2*Math.PI),n.globalAlpha=t.a*r,n.fillStyle=t.color,n.fill()}n.globalAlpha=1,t=requestAnimationFrame(o)};return t=requestAnimationFrame(o),()=>{window.removeEventListener("resize",a),cancelAnimationFrame(t)}},[]),(0,t.jsx)("canvas",{ref:e,className:"absolute inset-0 w-full h-full bg-[#02050a]"})}])}]);