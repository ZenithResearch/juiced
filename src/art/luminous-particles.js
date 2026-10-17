import {WATER_MODEL} from './water-model.js';
import {flashGLSL} from './bioluminescence-model.js';
import {WAKE} from './wake-model.js';
const quadVertex=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
export const waterMath=`
float unpack16(vec2 value){return (dot(floor(value*255.+.5),vec2(256.,1.))-32768.)/32767.;}
vec2 pack16(float value){float n=floor(clamp(value,-1.,1.)*32767.+32768.+.5);return vec2(floor(n/256.),mod(n,256.))/255.;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 waterTexel(vec2 uv){vec4 value=texture2D(uWater,uv);return vec2(unpack16(value.rg),unpack16(value.ba))*${WATER_MODEL.heightScale};}
vec2 stateAt(vec2 q){
 vec2 p=clamp(q*.5+.5,.005,.995)*128.-.5,cell=floor(p),f=fract(p),uv=(cell+.5)/128.;
 return mix(mix(waterTexel(uv),waterTexel(uv+vec2(1./128.,0.)),f.x),mix(waterTexel(uv+vec2(0.,1./128.)),waterTexel(uv+vec2(1./128.)),f.x),f.y);
}
vec4 topology(vec2 q){
 float e=2./128.;vec2 state=stateAt(q);
 float left=stateAt(q-vec2(e,0.)).x,right=stateAt(q+vec2(e,0.)).x;
 float down=stateAt(q-vec2(0.,e)).x,up=stateAt(q+vec2(0.,e)).x;
 return vec4((vec2(right,up)-vec2(left,down))/(2.*e),right+left+down+up-4.*state.x,state.y);
}
`;
export const flowMath=`
vec2 flowTexel(vec2 uv){vec4 value=texture2D(uFlow,uv);return vec2(unpack16(value.rg),unpack16(value.ba))*${WATER_MODEL.flowScale};}
vec2 flowAt(vec2 q){
 vec2 p=clamp(q*.5+.5,.005,.995)*128.-.5,cell=floor(p),f=fract(p),uv=(cell+.5)/128.;
 return mix(mix(flowTexel(uv),flowTexel(uv+vec2(1./128.,0.)),f.x),mix(flowTexel(uv+vec2(0.,1./128.)),flowTexel(uv+vec2(1./128.)),f.x),f.y);
}
vec2 velocityAt(vec2 q){float e=1./128.;return vec2(flowAt(q-vec2(e,0.)).x,flowAt(q-vec2(0.,e)).y);}
`;
const updateFragment=`
precision highp float;
varying vec2 vUV;
uniform sampler2D uPositions;
uniform sampler2D uWake;
uniform sampler2D uWater;
uniform sampler2D uFlow;
uniform vec4 uContacts[2];
uniform vec4 uMotion;
uniform float uTime;
uniform float uDelta;
uniform float uReset;
${waterMath}
${flowMath}
void main(){
 vec4 position=texture2D(uPositions,vUV);vec2 q=vec2(unpack16(position.rg),unpack16(position.ba));
 float identity=hash(vUV),depth=hash(vUV+17.);
 if(uReset>.5){
  float angle=identity*6.283185,radius=sqrt(hash(vUV+9.))*.80;
  q=vec2(cos(angle),sin(angle))*radius;
 }else{
  vec4 shape=topology(q);
  // A divergence-free curl field gives the submerged population a slow drift.
  float phase=q.x*3.7+q.y*2.9+uTime*.09;
  vec2 flow=vec2(2.9*cos(phase),-3.7*cos(phase))*.00075;
  flow+=vec2(cos(q.y*5.-uTime*.07),sin(q.x*4.+uTime*.08))*.0012;
  // The actual water gradient transports and folds the grain around a wake.
  flow+=velocityAt(q)*.45;
  flow+=(texture2D(uWake,q*.5+.5).rg*255.-128.)/127.*${WAKE.flowScale};
  flow+=(-shape.xy*.017+vec2(-shape.y,shape.x)*.009)*(1.-depth*.45);
  for(int i=0;i<2;i++){
   vec4 contact=uContacts[i];vec2 d=q-contact.xy;
   float distance=sqrt(dot(d,d)+.0004),weight=exp(-dot(d,d)/.018)*contact.z;
   vec2 direction=d/distance,tangent=vec2(-direction.y,direction.x);
   vec2 motion=i==0?uMotion.xy:uMotion.zw;
   // A moving contact carries its local eddy; a held contact keeps it turning.
   flow+=(tangent*(.015+.006*sin(uTime*.45+identity*6.283))+direction*.005+motion*.055)*weight;
  }
  flow*=.72+depth*.40;q+=flow*uDelta;
  float radius=length(q);
  if(radius>.820)q-=q/radius*(radius-.815)*1.8;
 }
 gl_FragColor=vec4(pack16(q.x),pack16(q.y));
}`;
const wakeFragment=`
precision highp float;
varying vec2 vUV;
uniform sampler2D uWake;
uniform sampler2D uFlow;
uniform vec4 uContacts[2];
uniform vec4 uPrevious[2];
uniform vec4 uMotion;
uniform float uDelta;
uniform float uReset;
uniform float uTime;
${flowMath.replace('vec2 flowTexel', 'float unpack16(vec2 value){return (dot(floor(value*255.+.5),vec2(256.,1.))-32768.)/32767.;}\nvec2 flowTexel')}
vec2 wakeVelocity(vec4 field){return (field.rg*255.-128.)/127.*${WAKE.flowScale};}
void main(){
 if(uReset>.5){gl_FragColor=vec4(vec2(128./255.),0.,0.);return;}
 vec2 q=(vUV-.5)*2.;
 vec4 old=texture2D(uWake,vUV);
 vec2 transport=velocityAt(q)*.45+wakeVelocity(old);
 old=texture2D(uWake,clamp(vUV-transport*uDelta*.5,.005,.995));
 vec2 velocity=wakeVelocity(old)*exp(-uDelta/1.1);
 float energy=old.b*exp(-uDelta/${WAKE.lifetime});
 for(int i=0;i<2;i++){
  vec4 contact=uContacts[i],previous=uPrevious[i];
  vec2 motion=i==0?uMotion.xy:uMotion.zw;
  float speed=length(motion);vec2 path=contact.xy-previous.xy;
  float t=clamp(dot(q-previous.xy,path)/max(dot(path,path),.000001),0.,1.);
  vec2 d=q-mix(previous.xy,contact.xy,t);
  float weight=exp(-dot(d,d)/${WAKE.radius**2})*min(contact.z,previous.z);
  float injection=weight*clamp(speed/${WAKE.speed},0.,1.);
  // A swept capsule deposits only on the path already travelled. Its stored
  // energy then drifts, folds and dies behind the hand, not ahead of it.
  energy=max(energy,injection);
  vec2 side=vec2(-motion.y,motion.x);
  float curl=sin(dot(q,vec2(41.,37.))+uTime*.7);
  velocity=mix(velocity,motion*.075+side*curl*.10,weight*(1.-exp(-uDelta*12.)));
 }
 if(length(q)>.824){energy=0.;velocity=vec2(0.);}
 if(energy<1./255.)velocity=vec2(0.);
 gl_FragColor=vec4(clamp(velocity/${WAKE.flowScale},-1.,1.)*127./255.+128./255.,floor(energy*255.)/255.,1.);
}`;
const lightFragment=`
precision highp float;
varying vec2 vUV;
uniform sampler2D uPositions;
uniform sampler2D uWater;
uniform sampler2D uFlow;
uniform sampler2D uLight;
uniform sampler2D uWake;
uniform float uTime;
uniform float uDelta;
uniform float uReset;
${waterMath}
${flowMath}
${flashGLSL}
void main(){
 if(uReset>.5){gl_FragColor=vec4(0.);return;}
 vec4 position=texture2D(uPositions,vUV);
 vec2 q=vec2(unpack16(position.rg),unpack16(position.ba));
 float e=2./128.;
 vec2 dx=(velocityAt(q+vec2(e,0.))-velocityAt(q-vec2(e,0.)))/(2.*e);
 vec2 dy=(velocityAt(q+vec2(0.,e))-velocityAt(q-vec2(0.,e)))/(2.*e);
 // The fluid and its retained stirring wake excite cells. Ambient drift,
 // camera brightness and a stationary depression cannot switch them on.
 float memory=texture2D(uWake,q*.5+.5).b;
 float folding=.65+.35*sin(dot(q,vec2(36.,-29.))+uTime*6.5+hash(vUV)*6.283185);
 float stimulus=max(strainRate(dx,dy)*.42,memory*(.10+.24*folding));
 vec4 history=texture2D(uLight,vUV);
 float energy=dot(floor(history.rg*255.+.5),vec2(256.,1.))/65535.;
 vec3 light=flashStep(vec3(energy,history.ba),stimulus,uDelta,hash(vUV));
 float encoded=floor(light.r*65535.+.5);
 gl_FragColor=vec4(floor(encoded/256.)/255.,mod(encoded,256.)/255.,light.gb);
}`;
const pointVertex=`
precision highp float;
attribute vec2 aParticle;
uniform sampler2D uPositions;
uniform sampler2D uWater;
uniform sampler2D uLight;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
varying float vEmission;
varying float vDepth;
varying float vRay;
varying vec3 vColor;
${waterMath}
void main(){
 vec4 position=texture2D(uPositions,aParticle);vec2 q=vec2(unpack16(position.rg),unpack16(position.ba));
 float identity=hash(aParticle),depth=hash(aParticle+17.);
 vec2 state=stateAt(q);vec4 shape=topology(q);
 vec2 packedLight=texture2D(uLight,aParticle).rg;
 float activity=dot(floor(packedLight*255.+.5),vec2(256.,1.))/65535.;
 // Refraction separates deeper, softer organisms from crisp surface grains.
 // Surface displacement and signed curvature lift and focus individual points.
 vec2 refracted=q+shape.xy*(.026+depth*.032);
 refracted.y+=state.x*.13-depth*.016;
 float angle=.20+uPointer.x*.10,c=cos(angle),s=sin(angle);
 vec2 pool=refracted-vec2(.02,.075);pool.y/=1.48;
 vec2 plane=vec2(c*pool.x-s*pool.y,s*pool.x+c*pool.y);
 gl_Position=vec4(plane/2.45*2.,0.,1.);
 if(length(refracted)>.830)gl_Position=vec4(3.,3.,0.,1.);
 float near=1.-depth;
 float focus=.72+.28*(1.-exp(-abs(shape.z)*100.));
 vEmission=activity*2.80*(.36+near*.64)*focus;
 vDepth=depth;vRay=step(.97,identity)*activity;
 vColor=mix(vec3(.18,.45,.96),vec3(.24,.78,.96),near*.72);
 float scale=clamp(uResolution.x/500.,.65,1.5);
 gl_PointSize=(1.7+depth*2.6+activity*.55+step(.985,identity)*1.2)*scale;
}`;
const pointFragment=`
precision mediump float;
varying float vEmission;
varying float vDepth;
varying float vRay;
varying vec3 vColor;
void main(){
 vec2 d=gl_PointCoord-.5;
 float halo=exp(-dot(d,d)*14.)*.14;
 float core=exp(-dot(d,d)*mix(80.,30.,vDepth))*mix(1.,.14,vDepth);
 float rays=(exp(-abs(d.x)*13.-abs(d.y)*100.)+exp(-abs(d.x)*100.-abs(d.y)*13.))*vRay*.035;
 float alpha=(halo+core+rays)*vEmission;
 vec3 color=mix(vColor,vec3(.85,.98,1.),core*.40);
 gl_FragColor=vec4(color,alpha);
}`;

export class LuminousParticles {
 constructor(gl){
  this.gl=gl;this.size=128;this.count=this.size*this.size;this.clock=0;this.initialized=false;this.lastContacts=null;
  const link=(vertex,fragment)=>{
   const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);return shader;};
   const v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();
   gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
   const linked=gl.getProgramParameter(program,gl.LINK_STATUS),error=linked?'':gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(v)+' '+gl.getShaderInfoLog(f);
   gl.deleteShader(v);gl.deleteShader(f);if(!linked){gl.deleteProgram(program);throw new Error(error);}return program;
  };
  this.updateProgram=link(quadVertex,updateFragment);this.wakeProgram=link(quadVertex,wakeFragment);this.lightProgram=link(quadVertex,lightFragment);this.pointProgram=link(pointVertex,pointFragment);
  const locations=(program,names)=>Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
  this.updateLocations=locations(this.updateProgram,['uPositions','uWake','uWater','uFlow','uContacts[0]','uMotion','uTime','uDelta','uReset']);
  this.wakeLocations=locations(this.wakeProgram,['uWake','uFlow','uContacts[0]','uPrevious[0]','uMotion','uDelta','uReset','uTime']);
  this.lightLocations=locations(this.lightProgram,['uPositions','uWater','uFlow','uLight','uWake','uTime','uDelta','uReset']);
  this.pointLocations=locations(this.pointProgram,['uPositions','uWater','uLight','uResolution','uPointer','uTime']);
  this.quadPosition=gl.getAttribLocation(this.updateProgram,'aPosition');this.wakePosition=gl.getAttribLocation(this.wakeProgram,'aPosition');this.lightPosition=gl.getAttribLocation(this.lightProgram,'aPosition');this.pointPosition=gl.getAttribLocation(this.pointProgram,'aParticle');
  this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const indices=new Float32Array(this.count*2);
  for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++){const offset=(y*this.size+x)*2;indices[offset]=(x+.5)/this.size;indices[offset+1]=(y+.5)/this.size;}
  this.points=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.points);gl.bufferData(gl.ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  const makeTargets=(filter=gl.NEAREST)=>[0,1].map(()=>{
   const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.size,this.size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
   const buffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Particle target unavailable');
   return {texture,buffer};
  });this.targets=makeTargets();this.lightTargets=makeTargets();this.wakeTargets=makeTargets(gl.LINEAR);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 pause(){this.clock=0;this.lastContacts=null;}
 update(now,water,flow,contacts,quiet){
  const delta=this.clock?Math.min((now-this.clock)/1000,.05):1/60;this.clock=now;
  if(quiet&&this.initialized){this.pause();return;}
  const gl=this.gl,l=this.updateLocations,motion=new Float32Array(4);
  contacts.forEach((contact,i)=>{
   const previous=this.lastContacts?.[i];if(!previous||!previous[2]||!contact[2])return;
   let v=contact.slice(0,2).map((p,j)=>(p-previous[j])/Math.max(delta,.001));const speed=Math.hypot(...v);
   if(speed>.6)v=v.map(p=>p*.6/speed);motion.set(v,i*2);
   if(speed>.05)this.travel={point:contact.slice(0,2),direction:v.map(p=>p/Math.max(Math.hypot(...v),.001)),now};
  });
  gl.disable(gl.BLEND);gl.useProgram(this.updateProgram);gl.viewport(0,0,this.size,this.size);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.targets[1].buffer);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,water);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.targets[0].texture);
  gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,flow);gl.uniform1i(l.uFlow,4);
  gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.wakeTargets[0].texture);gl.uniform1i(l.uWake,7);
  gl.uniform1i(l.uWater,2);gl.uniform1i(l.uPositions,3);gl.uniform1f(l.uTime,quiet?2.5:now/1000);gl.uniform1f(l.uDelta,delta);gl.uniform1f(l.uReset,this.initialized?0:1);
  gl.uniform4fv(l['uContacts[0]'],new Float32Array(contacts.flat()));gl.uniform4fv(l.uMotion,motion);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(this.quadPosition);gl.vertexAttribPointer(this.quadPosition,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,6);
  this.targets.reverse();
  const wake=this.wakeLocations;gl.useProgram(this.wakeProgram);gl.bindFramebuffer(gl.FRAMEBUFFER,this.wakeTargets[1].buffer);
  gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.wakeTargets[0].texture);gl.uniform1i(wake.uWake,7);
  gl.uniform1i(wake.uFlow,4);gl.uniform4fv(wake['uContacts[0]'],new Float32Array(contacts.flat()));
  gl.uniform4fv(wake['uPrevious[0]'],new Float32Array((this.lastContacts||contacts).flat()));gl.uniform4fv(wake.uMotion,motion);
  gl.uniform1f(wake.uDelta,delta);gl.uniform1f(wake.uReset,this.initialized?0:1);gl.uniform1f(wake.uTime,quiet?2.5:now/1000);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(this.wakePosition);gl.vertexAttribPointer(this.wakePosition,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,6);
  this.wakeTargets.reverse();
  const light=this.lightLocations;gl.useProgram(this.lightProgram);gl.bindFramebuffer(gl.FRAMEBUFFER,this.lightTargets[1].buffer);
  gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.targets[0].texture);gl.uniform1i(light.uPositions,3);
  gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,this.lightTargets[0].texture);gl.uniform1i(light.uLight,6);
  gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.wakeTargets[0].texture);gl.uniform1i(light.uWake,7);gl.uniform1f(light.uTime,quiet?2.5:now/1000);
  gl.uniform1i(light.uWater,2);gl.uniform1i(light.uFlow,4);gl.uniform1f(light.uDelta,delta);gl.uniform1f(light.uReset,this.initialized?0:1);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(this.lightPosition);gl.vertexAttribPointer(this.lightPosition,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,6);
  this.lightTargets.reverse();this.initialized=true;this.lastContacts=contacts.map(p=>[...p]);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 draw(width,height,water,contacts,tilt,time){
  const gl=this.gl,l=this.pointLocations;gl.useProgram(this.pointProgram);gl.viewport(0,0,width,height);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,water);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.targets[0].texture);
  gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,this.lightTargets[0].texture);gl.uniform1i(l.uLight,6);
  gl.uniform1i(l.uWater,2);gl.uniform1i(l.uPositions,3);gl.uniform2f(l.uResolution,width,height);gl.uniform2f(l.uPointer,...tilt);gl.uniform1f(l.uTime,time);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.points);gl.enableVertexAttribArray(this.pointPosition);gl.vertexAttribPointer(this.pointPosition,2,gl.FLOAT,false,0,0);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.drawArrays(gl.POINTS,0,this.count);gl.disable(gl.BLEND);
 }
 measure(now,contacts){
  // Review-only diagnostics for generated particle positions; no camera data.
  const gl=this.gl,pixels=new Uint8Array(this.count*4);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.targets[0].buffer);gl.readPixels(0,0,this.size,this.size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const points=Array.from({length:this.count},(_,i)=>[(pixels[i*4]*256+pixels[i*4+1]-32768)/32767,(pixels[i*4+2]*256+pixels[i*4+3]-32768)/32767]);
  let changed=0,near=0,far=0,nearCount=0,farCount=0;
  const previous=this.previousMeasure,dt=previous?Math.max(.001,(now-previous.now)/1000):1;
  if(previous)points.forEach((point,i)=>{
   const distance=Math.hypot(point[0]-previous.points[i][0],point[1]-previous.points[i][1]),speed=distance/dt;
   if(distance>.00004)changed++;
   const local=contacts.some(c=>c[2]>.05&&Math.hypot(point[0]-c[0],point[1]-c[1])<.20);
   if(local){near+=speed;nearCount++;}else{far+=speed;farCount++;}
  });
  const flashes=new Uint8Array(this.count*4);gl.bindFramebuffer(gl.FRAMEBUFFER,this.lightTargets[0].buffer);gl.readPixels(0,0,this.size,this.size,gl.RGBA,gl.UNSIGNED_BYTE,flashes);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let luminous=0,emission=0,peak=0,localLight=0,trailLight=0,rearLight=0,frontLight=0;for(let i=0;i<this.count;i++){const value=(flashes[i*4]*256+flashes[i*4+1])/65535;if(value>.06){luminous++;if(contacts.some(c=>c[2]>.05&&Math.hypot(points[i][0]-c[0],points[i][1]-c[1])<.14))localLight++;else trailLight++;
   if(this.travel&&now-this.travel.now<2500){const d=points[i].map((v,j)=>v-this.travel.point[j]),axis=this.travel.direction,along=d[0]*axis[0]+d[1]*axis[1],across=Math.abs(d[0]*axis[1]-d[1]*axis[0]);if(across<.14){if(along<-.08)rearLight++;if(along>.08)frontLight++;}}
  }emission+=value/this.count;peak=Math.max(peak,value);}
  this.previousMeasure={now,points};return {changed,near:near/Math.max(1,nearCount),far:far/Math.max(1,farCount),luminous,emission,peak,localLight,trailLight,rearLight,frontLight};
 }
 destroy(){
  const gl=this.gl;for(const target of [...(this.targets||[]),...(this.lightTargets||[]),...(this.wakeTargets||[])]){gl.deleteTexture(target.texture);gl.deleteFramebuffer(target.buffer);}
  if(this.quad)gl.deleteBuffer(this.quad);if(this.points)gl.deleteBuffer(this.points);
  if(this.updateProgram)gl.deleteProgram(this.updateProgram);if(this.wakeProgram)gl.deleteProgram(this.wakeProgram);if(this.lightProgram)gl.deleteProgram(this.lightProgram);if(this.pointProgram)gl.deleteProgram(this.pointProgram);this.targets=[];this.lightTargets=[];this.wakeTargets=[];
 }
}
