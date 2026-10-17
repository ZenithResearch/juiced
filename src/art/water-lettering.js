import {waterMath,flowMath} from './luminous-particles.js';

// Only generated letter-mask pixels are read here; never camera pixels.
export function sampleLettering(pixels,width,height,limit=4096){
 const points=[];
 for(let y=1;y<height;y+=2)for(let x=1;x<width;x+=2){
  if(pixels[(y*width+x)*4+3]<110)continue;
  const jitter=Math.sin(x*127.1+y*311.7)*43758.5453,offset=(jitter-Math.floor(jitter)-.5)*.6;
  points.push([(x+offset)/width-.5,(.5-(y-offset)/height)*height/width]);
 }
 if(points.length<=limit)return points;
 return Array.from({length:limit},(_,i)=>points[Math.floor(i*points.length/limit)]);
}
const quadVertex=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const updateFragment=`
precision highp float;
varying vec2 vUV;
uniform sampler2D uHomes;
uniform sampler2D uOffsets;
uniform sampler2D uWater;
uniform sampler2D uFlow;
uniform sampler2D uWake;
uniform vec4 uContacts[2];
uniform float uWidth;
uniform float uDelta;
uniform float uReset;
${waterMath}
${flowMath}
void main(){
 if(uReset>.5){gl_FragColor=vec4(pack16(0.),pack16(0.));return;}
 vec4 home=texture2D(uHomes,vUV),old=texture2D(uOffsets,vUV);
 vec2 anchor=vec2(unpack16(home.rg),unpack16(home.ba))*uWidth+vec2(0.,.035);
 vec2 offset=vec2(unpack16(old.rg),unpack16(old.ba))*.26;
 vec2 q=anchor+offset,flow=velocityAt(q);vec4 shape=topology(q);
 vec4 wake=texture2D(uWake,clamp(q*.5+.5,.005,.995));
 vec2 retained=(wake.rg*255.-128.)/127.*.18;
 float agitation=clamp(length(flow)*15.+abs(shape.w)*3600.+wake.b*.6,0.,1.);
 vec2 force=flow*1.8+retained*1.5-shape.xy*.10;
 for(int i=0;i<2;i++){
  vec2 d=q-uContacts[i].xy;float distance=length(d);
  float pressure=exp(-dot(d,d)/.012)*uContacts[i].z;
  vec2 direction=d/max(distance,.012);
  force+=(direction*.13+vec2(-direction.y,direction.x)*.08)*pressure;
 }
 // Water can separate the grains freely. Once its energy fades, a soft
 // spring gathers the individual organisms back into their letterforms.
 offset=(offset+force*uDelta)*exp(-uDelta*mix(1.8,.35,agitation));
 float distance=length(offset);if(distance>.26)offset*=.26/distance;
 gl_FragColor=vec4(pack16(offset.x/.26),pack16(offset.y/.26));
}`;
const pointVertex=`
precision highp float;
attribute vec2 aParticle;
uniform sampler2D uHomes;
uniform sampler2D uOffsets;
uniform sampler2D uWater;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uWidth;
uniform float uAmount;
uniform float uTime;
varying vec3 vColor;
varying float vLight;
varying float vDepth;
${waterMath}
void main(){
 vec4 home=texture2D(uHomes,aParticle),position=texture2D(uOffsets,aParticle);
 vec2 q=vec2(unpack16(home.rg),unpack16(home.ba))*uWidth+vec2(0.,.035);
 q+=vec2(unpack16(position.rg),unpack16(position.ba))*.26;
 float identity=hash(aParticle),depth=.035+hash(aParticle+17.)*.15;
 vec2 state=stateAt(q);vec4 shape=topology(q);
 // A volume of organisms below the surface: deeper grains soften, absorb
 // more light, and refract farther as the water's actual normals change.
 vec2 refracted=q+shape.xy*(.055+depth*.30);
 refracted.y+=state.x*.25-depth*.10;
 float angle=.20+uPointer.x*.10,c=cos(angle),s=sin(angle);
 vec2 pool=refracted-vec2(.02,.075);pool.y/=1.48;
 vec2 plane=vec2(c*pool.x-s*pool.y,s*pool.x+c*pool.y);
 gl_Position=vec4(plane/2.45*2.,0.,1.);
 if(length(refracted)>.824)gl_Position=vec4(3.,3.,0.,1.);
 float near=1.-(depth-.035)/.15;
 float glimmer=.80+.20*sin(uTime*1.6+identity*6.283185);
 float focus=clamp(.85-shape.z*130.,.45,1.35);
 vLight=uAmount*glimmer*focus*mix(.65,1.85,near);
 vColor=mix(vec3(.30,.53,.91),vec3(.46,.91,.97),near);
 vDepth=1.-near;
 float scale=clamp(uResolution.x/500.,.75,1.5);
 gl_PointSize=(2.3+vDepth*2.2+step(.96,identity)*.8)*scale;
}`;
const pointFragment=`
precision mediump float;
varying vec3 vColor;
varying float vLight;
varying float vDepth;
void main(){
 vec2 d=gl_PointCoord-.5;float radius=dot(d,d);
 float core=exp(-radius*mix(24.,18.,vDepth))*mix(.95,.34,vDepth);
 float halo=exp(-radius*12.)*.17;
 gl_FragColor=vec4(mix(vColor,vec3(.83,1.,1.),core*.35),(core+halo)*vLight);
}`;

export class WaterLettering {
 constructor(gl){
  this.gl=gl;this.size=64;this.count=0;this.clock=0;this.initialized=false;
  const link=(vertex,fragment)=>{
   const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);return shader;};
   const v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();
   gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
   const ok=gl.getProgramParameter(program,gl.LINK_STATUS),error=ok?'':gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(v)+' '+gl.getShaderInfoLog(f);
   gl.deleteShader(v);gl.deleteShader(f);if(!ok){gl.deleteProgram(program);throw new Error(error);}return program;
  };
  this.updateProgram=link(quadVertex,updateFragment);this.pointProgram=link(pointVertex,pointFragment);
  const locations=(program,names)=>Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
  this.updateLocations=locations(this.updateProgram,['uHomes','uOffsets','uWater','uFlow','uWake','uContacts[0]','uWidth','uDelta','uReset']);
  this.pointLocations=locations(this.pointProgram,['uHomes','uOffsets','uWater','uResolution','uPointer','uWidth','uAmount','uTime']);
  this.quadPosition=gl.getAttribLocation(this.updateProgram,'aPosition');this.pointPosition=gl.getAttribLocation(this.pointProgram,'aParticle');
  this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const indices=new Float32Array(this.size*this.size*2);
  for(let i=0;i<this.size*this.size;i++){indices[i*2]=(i%this.size+.5)/this.size;indices[i*2+1]=(Math.floor(i/this.size)+.5)/this.size;}
  this.points=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.points);gl.bufferData(gl.ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  const texture=()=>{const t=gl.createTexture();gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.size,this.size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);return t;};
  this.homes=texture();this.targets=[0,1].map(()=>{const t=texture(),buffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Lettering target unavailable');return {texture:t,buffer};});gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 setGlyph({data,width,height}){
  const gl=this.gl,points=sampleLettering(data,width,height,this.size*this.size),pixels=new Uint8Array(this.size*this.size*4);
  const pack=(value,index)=>{const n=Math.round(Math.max(-1,Math.min(1,value))*32767+32768);pixels[index]=Math.floor(n/256);pixels[index+1]=n%256;};
  points.forEach((point,i)=>{pack(point[0],i*4);pack(point[1],i*4+2);});
  gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.homes);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.size,this.size,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  this.count=points.length;this.initialized=false;
 }
 pause(){this.clock=0;}
 update(now,water,flow,wake,contacts,quiet,amount,width){
  if(amount<.001){this.clock=0;this.initialized=false;return;}
  if(quiet&&this.initialized){this.pause();return;}
  const delta=this.clock?Math.min((now-this.clock)/1000,.05):1/60;this.clock=now;
  const gl=this.gl,l=this.updateLocations;gl.disable(gl.BLEND);gl.useProgram(this.updateProgram);gl.viewport(0,0,this.size,this.size);gl.bindFramebuffer(gl.FRAMEBUFFER,this.targets[1].buffer);
  for(const [unit,texture,location] of [[2,water,l.uWater],[3,this.targets[0].texture,l.uOffsets],[4,flow,l.uFlow],[5,this.homes,l.uHomes],[7,wake,l.uWake]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(location,unit);}
  gl.uniform1f(l.uWidth,width);gl.uniform1f(l.uDelta,delta);gl.uniform1f(l.uReset,this.initialized?0:1);gl.uniform4fv(l['uContacts[0]'],new Float32Array(contacts.flat()));
  gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(this.quadPosition);gl.vertexAttribPointer(this.quadPosition,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,6);
  this.targets.reverse();this.initialized=true;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 draw(width,height,water,tilt,time,amount,letterWidth){
  if(amount<.001||!this.count)return;
  const gl=this.gl,l=this.pointLocations;gl.useProgram(this.pointProgram);gl.viewport(0,0,width,height);
  for(const [unit,texture,location] of [[2,water,l.uWater],[3,this.targets[0].texture,l.uOffsets],[5,this.homes,l.uHomes]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(location,unit);}
  gl.uniform2f(l.uResolution,width,height);gl.uniform2f(l.uPointer,...tilt);gl.uniform1f(l.uWidth,letterWidth);gl.uniform1f(l.uTime,time);gl.uniform1f(l.uAmount,amount);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.points);gl.enableVertexAttribArray(this.pointPosition);gl.vertexAttribPointer(this.pointPosition,2,gl.FLOAT,false,0,0);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.drawArrays(gl.POINTS,0,this.count);gl.disable(gl.BLEND);
 }
 measure(){
  const gl=this.gl,pixels=new Uint8Array(this.size*this.size*4);gl.bindFramebuffer(gl.FRAMEBUFFER,this.targets[0].buffer);gl.readPixels(0,0,this.size,this.size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let maximum=0,mean=0,displaced=0;
  for(let i=0;i<this.count;i++){const x=(pixels[i*4]*256+pixels[i*4+1]-32768)/32767*.26,y=(pixels[i*4+2]*256+pixels[i*4+3]-32768)/32767*.26,distance=Math.hypot(x,y);maximum=Math.max(maximum,distance);mean+=distance/this.count;if(distance>.01)displaced++;}
  return {maximum,mean,displaced};
 }
 destroy(){const gl=this.gl;for(const target of this.targets||[]){gl.deleteTexture(target.texture);gl.deleteFramebuffer(target.buffer);}if(this.homes)gl.deleteTexture(this.homes);if(this.quad)gl.deleteBuffer(this.quad);if(this.points)gl.deleteBuffer(this.points);if(this.updateProgram)gl.deleteProgram(this.updateProgram);if(this.pointProgram)gl.deleteProgram(this.pointProgram);this.targets=[];this.homes=null;}
}
