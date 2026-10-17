import {contours} from './glyph-data.js';

const vertexSource=`
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat3 uRotation;
uniform vec2 uScale;
uniform vec2 uOffset;
uniform float uLayer;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorld;
void main(){
 vPosition=aPosition;
 vec3 world=uRotation*(aPosition+vec3(0.0,0.0,uLayer));
 vWorld=world; vNormal=uRotation*aNormal;
 gl_Position=vec4(world.xy*uScale+uOffset,-world.z*0.1,1.0);
}`;
const fragmentSource=`
precision mediump float;
uniform float uMaterial;
uniform float uReveal;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorld;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
void main(){
 vec3 n=normalize(vNormal);
 vec3 eye=vec3(0.0,0.0,1.0);
 vec3 light=normalize(vec3(-0.65,0.9,1.1));
 float key=max(dot(n,light),0.0);
 float rim=pow(1.0-max(dot(n,eye),0.0),3.0);
 float spec=pow(max(dot(n,normalize(light+eye)),0.0),48.0);
 float grain=(hash(floor(vPosition*740.0))-.5)*.026;
 float bands=sin(vPosition.y*104.0+vPosition.z*150.0+sin(vPosition.y*5.0+vPosition.x*8.0)*4.4);
 float filaments=pow(.5+.5*bands,18.0);
 vec3 pearl=vec3(.72,.67,.77);
 vec3 plum=vec3(.15,.10,.20);
 vec3 violet=vec3(.35,.30,.66);
 vec3 color;
 if(uMaterial<.5){
  // A matte mineral face and a cool interference edge, not an environment map.
  float sheen=.5+.5*sin(vPosition.y*1.9+dot(n,eye)*7.0);
  color=mix(plum,pearl,.30+.65*key);
  color+=vec3(.23,.20,.34)*rim + mix(vec3(.30,.22,.46),vec3(.54,.46,.57),sheen)*spec;
  color+=vec3(.30,.25,.55)*uReveal*rim*.3;
 }else if(uMaterial<1.5){
  // Fine procedural strata live inside the extruded glyph itself.
  color=mix(vec3(.13,.09,.29),violet,.45+.5*key);
  color+=vec3(.45,.36,.74)*filaments*(.10+.38*uReveal);
  color+=vec3(.56,.46,.81)*rim*.48;
  color+=vec3(.64,.49,.76)*spec*.5;
 }else{
  color=vec3(.12,.085,.17)*(.5+.8*key);
  color+=vec3(.32,.25,.43)*rim*.55 + vec3(.65,.52,.66)*spec*.22;
 }
 // A trace of warm reflected light belongs only to the lower turning edge.
 float ember=pow(max(dot(n,normalize(vec3(-1.0,-.65,.2))),0.0),8.0);
 color+=vec3(.28,.095,.035)*ember*.45;
 color+=grain;
 gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
}`;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function signedArea(r){return r.reduce((s,p,i)=>s+p[0]*r[(i+1)%r.length][1]-r[(i+1)%r.length][0]*p[1],0)/2;}
function triangulate(points){
 const ids=points.map((_,i)=>i),tri=[];
 let guard=0;
 while(ids.length>3&&guard++<points.length*points.length){
  let clipped=false;
  for(let j=0;j<ids.length;j++){
   const a=ids[(j+ids.length-1)%ids.length],b=ids[j],c=ids[(j+1)%ids.length];
   if(cross(points[a],points[b],points[c])<=1e-10)continue;
   const inside=ids.some(k=>k!==a&&k!==b&&k!==c&&cross(points[a],points[b],points[k])>=-1e-9&&cross(points[b],points[c],points[k])>=-1e-9&&cross(points[c],points[a],points[k])>=-1e-9);
   if(!inside){tri.push([a,b,c]);ids.splice(j,1);clipped=true;break;}
  }
  if(!clipped)throw new Error('Glyph contour could not be triangulated');
 }
 if(ids.length===3)tri.push(ids);
 return tri;
}
function inset(r,d){
 return r.map((p,i)=>{
  const prev=r[(i+r.length-1)%r.length],next=r[(i+1)%r.length];
  let ax=p[0]-prev[0],ay=p[1]-prev[1],bx=next[0]-p[0],by=next[1]-p[1];
  const al=Math.hypot(ax,ay),bl=Math.hypot(bx,by);ax/=al;ay/=al;bx/=bl;by/=bl;
  const nx=-ay-by,ny=ax+bx,div=Math.max(.3,1+ax*bx+ay*by);
  return [p[0]+d*nx/div,p[1]+d*ny/div];
 });
}
export function buildGeometry(depth){
 const positions=[],normals=[];
 function triangle(a,b,c,normal){
  if(!normal){const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];const l=Math.hypot(...normal)||1;normal=normal.map(v=>v/l);}
  positions.push(...a,...b,...c);normals.push(...normal,...normal,...normal);
 }
 for(const original of contours){
  const r=signedArea(original)<0?[...original].reverse():original;
  const bevel=Math.min(.022,depth*.22),inner=inset(r,bevel),tris=triangulate(inner);
  for(const [a,b,c] of tris){
   triangle([...inner[a],depth/2],[...inner[b],depth/2],[...inner[c],depth/2],[0,0,1]);
   triangle([...inner[c],-depth/2],[...inner[b],-depth/2],[...inner[a],-depth/2],[0,0,-1]);
  }
  const rings=[{xy:inner,z:-depth/2},{xy:r,z:-depth/2+bevel},{xy:r,z:depth/2-bevel},{xy:inner,z:depth/2}];
  for(let k=0;k<rings.length-1;k++)for(let i=0;i<r.length;i++){
   const j=(i+1)%r.length,a=[...rings[k].xy[i],rings[k].z],b=[...rings[k].xy[j],rings[k].z],c=[...rings[k+1].xy[j],rings[k+1].z],d=[...rings[k+1].xy[i],rings[k+1].z];
   triangle(a,b,c);triangle(a,c,d);
  }
 }
 return {positions:new Float32Array(positions),normals:new Float32Array(normals),count:positions.length/3};
}
function rotation(x,y,z){
 const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
 return new Float32Array([cz*cy,sz*cy,-sy,cz*sy*sx-sz*cx,sz*sy*sx+cz*cx,cy*sx,cz*sy*cx+sz*sx,sz*sy*cx-cz*sx,cy*cx]);
}
const geometryCache=[buildGeometry(.14),buildGeometry(.34),buildGeometry(.22)];

export class GlyphRenderer {
 constructor(host,{small=false,onFailure=()=>{}}={}){
  this.host=host;this.canvas=host.querySelector('canvas');this.small=small;this.onFailure=onFailure;
  this.reveal=small?.25:0;this.target=this.reveal;this.tilt=[0,0];this.pointer=[0,0];this.quiet=false;this.forcedFallback=false;this.visible=false;this.frame=0;this.last=0;this.resources=[];
  this.onContextLost=e=>{e.preventDefault();this.cancel();this.host.dataset.renderer='fallback';this.lost=true;this.onFailure();};this.canvas.addEventListener('webglcontextlost',this.onContextLost);
  this.onContextRestored=()=>{this.lost=false;try{this.init();this.request();}catch{this.fail();}};this.canvas.addEventListener('webglcontextrestored',this.onContextRestored);
  try{this.init();}catch(error){this.fail();console.warn('Juiced glyph uses its vector fallback:',error.message);}
  this.resizeObserver=new ResizeObserver(()=>this.request());this.resizeObserver.observe(host);
  this.intersectionObserver=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;if(this.visible)this.request();else this.cancel();},{threshold:0});this.intersectionObserver.observe(host);
  this.onVisibility=()=>{if(document.hidden)this.cancel();else this.request();};document.addEventListener('visibilitychange',this.onVisibility);
  // A small change of viewpoint follows deliberate mouse movement; touch keeps scrolling.
  this.onPointer=e=>{if(e.pointerType!=='mouse'||this.quiet)return;const r=host.getBoundingClientRect();this.pointer=[((e.clientX-r.left)/r.width-.5)*.30,((e.clientY-r.top)/r.height-.5)*.20];this.request();};
  this.onLeave=()=>{this.pointer=[0,0];this.request();};host.addEventListener('pointermove',this.onPointer);host.addEventListener('pointerleave',this.onLeave);
 }
 init(){
  const gl=this.canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,powerPreference:'low-power'});if(!gl)throw new Error('WebGL unavailable');this.gl=gl;
  this.release();
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s;};
  const v=compile(gl.VERTEX_SHADER,vertexSource),f=compile(gl.FRAGMENT_SHADER,fragmentSource),program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
  const linked=gl.getProgramParameter(program,gl.LINK_STATUS),message=linked?'':gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(f);gl.deleteShader(v);gl.deleteShader(f);
  if(!linked){gl.deleteProgram(program);throw new Error(message);}
  this.program=program;this.locations={};
  for(const name of ['uRotation','uScale','uOffset','uLayer','uMaterial','uReveal'])this.locations[name]=gl.getUniformLocation(program,name);
  this.attributes={position:gl.getAttribLocation(program,'aPosition'),normal:gl.getAttribLocation(program,'aNormal')};
  this.meshes=geometryCache.map(g=>{const buffers=[g.positions,g.normals].map(data=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);this.resources.push(b);return b;});return {buffers,count:g.count};});
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
  this.ready=true;this.host.dataset.renderer=this.forcedFallback?'fallback':'webgl';this.host.dataset.vertices=String(geometryCache.reduce((n,g)=>n+g.count,0));
 }
 fail(){this.ready=false;this.cancel();this.host.dataset.renderer='fallback';this.onFailure();}
 release(){if(!this.gl)return;for(const b of this.resources)this.gl.deleteBuffer(b);this.resources=[];if(this.program)this.gl.deleteProgram(this.program);this.program=null;}
 cancel(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.last=0;this.host.dataset.animating='false';}
 request(){if(this.frame||!this.ready||this.lost||this.forcedFallback||!this.visible||document.hidden)return;this.host.dataset.animating='true';this.frame=requestAnimationFrame(t=>this.draw(t));}
 setReveal(value){this.target=value;this.host.dataset.revealed=String(value>.5);if(this.quiet)this.reveal=value;this.request();}
 setQuiet(value){this.quiet=value;this.host.dataset.quiet=String(value);if(value){this.reveal=this.target;this.tilt=[0,0];this.pointer=[0,0];}this.request();}
 setFallback(value){this.forcedFallback=value;this.host.dataset.renderer=value||!this.ready||this.lost?'fallback':'webgl';if(value)this.cancel();else this.request();}
 draw(now){
  this.frame=0;if(!this.visible||document.hidden||this.forcedFallback||this.lost)return;
  const dt=this.last?Math.min(now-this.last,50):16;this.last=now;const blend=this.quiet?1:1-Math.exp(-dt/145);
  this.reveal+=(this.target-this.reveal)*blend;
  this.tilt=this.tilt.map((v,i)=>v+(this.pointer[i]-v)*blend);
  const settled=Math.abs(this.target-this.reveal)<.001&&this.tilt.every((v,i)=>Math.abs(v-this.pointer[i])<.001);
  if(settled){this.reveal=this.target;this.tilt=[...this.pointer];}
  const rect=this.host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.75),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  const gl=this.gl;gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const aspect=w/h,small=this.small,reveal=this.reveal;
  const rot=rotation(-.09+this.tilt[1],-.57-reveal*.13+this.tilt[0],small?-.10:-.19);
  gl.uniformMatrix3fv(this.locations.uRotation,false,rot);
  const scale=small?.45:.46;
  gl.uniform2f(this.locations.uScale,scale/aspect,scale);
  gl.uniform2f(this.locations.uOffset,small?0:.02,small?.03:.08);
  gl.uniform1f(this.locations.uReveal,reveal);
  // An actual volume, divided into three material layers. Reveal opens the seams.
  const layers=[.30+reveal*.45,0,-.31-reveal*.25];
  for(let i=2;i>=0;i--){const mesh=this.meshes[i];
   gl.uniform1f(this.locations.uLayer,layers[i]);gl.uniform1f(this.locations.uMaterial,i);
   for(const [j,name] of ['position','normal'].entries()){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffers[j]);gl.enableVertexAttribArray(this.attributes[name]);gl.vertexAttribPointer(this.attributes[name],3,gl.FLOAT,false,0,0);}
   gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }
  this.host.dataset.progress=reveal.toFixed(3);
  if(!settled)this.request();else{this.last=0;this.host.dataset.animating='false';}
 }
 destroy(){this.canvas.removeEventListener('webglcontextlost',this.onContextLost);this.canvas.removeEventListener('webglcontextrestored',this.onContextRestored);this.cancel();this.resizeObserver.disconnect();this.intersectionObserver.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);this.host.removeEventListener('pointermove',this.onPointer);this.host.removeEventListener('pointerleave',this.onLeave);this.release();}
}
