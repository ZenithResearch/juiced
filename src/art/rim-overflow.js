import {WATER_MODEL,modelGLSL} from './water-model.js';
const RATE_SCALE=1000,HEAD_MAX=.04,LIFE=8.5;
const quadVertex=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const sampling=`
${modelGLSL}
vec2 waterTexel(vec2 uv){vec4 value=texture2D(uWater,uv);return vec2(unpack16(value.rg),unpack16(value.ba))*HEIGHT_SCALE;}
vec2 waterAt(vec2 q){
 vec2 p=clamp(q*.5+.5,.005,.995)*128.-.5,cell=floor(p),f=fract(p),uv=(cell+.5)/128.;
 return mix(mix(waterTexel(uv),waterTexel(uv+vec2(1./128.,0.)),f.x),mix(waterTexel(uv+vec2(0.,1./128.)),waterTexel(uv+vec2(1./128.)),f.x),f.y);
}
vec2 flowTexel(vec2 uv){vec4 value=texture2D(uFlow,uv);return vec2(unpack16(value.rg),unpack16(value.ba))*FLOW_SCALE;}
vec2 flowAt(vec2 q){
 vec2 p=clamp(q*.5+.5,.005,.995)*128.-.5,cell=floor(p),f=fract(p),uv=(cell+.5)/128.;
 return mix(mix(flowTexel(uv),flowTexel(uv+vec2(1./128.,0.)),f.x),mix(flowTexel(uv+vec2(0.,1./128.)),flowTexel(uv+vec2(1./128.)),f.x),f.y);
}
vec2 velocityAt(vec2 q){float e=1./128.;return vec2(flowAt(q-vec2(e,0.)).x,flowAt(q-vec2(0.,e)).y);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
`;
const rimFragment=`
precision highp float;
varying vec2 vUV;
uniform sampler2D uWater;
uniform sampler2D uFlow;
uniform sampler2D uRim;
uniform float uDelta;
${sampling}
void main(){
 float angle=vUV.x*6.283185;vec2 normal=vec2(cos(angle),sin(angle));
 // Find the first wet boundary cell along this radial direction. Use the
 // same closed-face discharges that remove water in the continuity pass.
 vec2 uv=vec2(.5);bool found=false;
 for(int i=0;i<5;i++){
  vec2 probe=normal*(WATER_RADIUS+.009-float(i)/128.);
  vec2 cell=(floor((probe*.5+.5)*128.)+.5)/128.;
  if(!found&&length((cell-.5)*2.)<WATER_RADIUS){uv=cell;found=true;}
 }
 vec2 dx=vec2(1./128.,0.),dy=vec2(0.,1./128.);
 float height=waterTexel(uv).x;vec2 face=flowTexel(uv),left=flowTexel(uv-dx),bottom=flowTexel(uv-dy);
 float flux=0.;
 if(length((uv+dx-.5)*2.)>=WATER_RADIUS)flux+=discharge(height,left.x)*max(normal.x,0.);
 if(length((uv-dx-.5)*2.)>=WATER_RADIUS)flux+=discharge(height,-face.x)*max(-normal.x,0.);
 if(length((uv+dy-.5)*2.)>=WATER_RADIUS)flux+=discharge(height,bottom.y)*max(normal.y,0.);
 if(length((uv-dy-.5)*2.)>=WATER_RADIUS)flux+=discharge(height,-face.y)*max(-normal.y,0.);
 float rate=clamp(flux*${RATE_SCALE}.,0.,1.);
 float previous=unpack16(texture2D(uRim,vUV).ba);
 float wet=max(0.,previous*exp(-uDelta/2.2)+rate*uDelta*1.8-uDelta*.01);
 if(wet<.001)wet=0.;
 gl_FragColor=vec4(pack16(rate),pack16(clamp(wet,0.,1.)));
}`;
const birthFragment=`
precision highp float;
varying vec2 vUV;
uniform sampler2D uWater;
uniform sampler2D uFlow;
uniform sampler2D uRim;
uniform sampler2D uBirth;
uniform float uTime;
uniform float uDelta;
uniform float uReset;
${sampling}
float angleFor(vec2 id){return fract((floor(id.x*64.)+floor(id.y*32.)*64.+hash(id)) / 2048.)*6.283185;}
void main(){
 vec4 previous=texture2D(uBirth,vUV);float head=previous.r*${HEAD_MAX},tangent=(previous.g*2.-1.)*.25,age=unpack16(previous.ba);
 if(uReset>.5){age=-1.;head=0.;tangent=0.;}
 else{
  if(age>=0.){age+=uDelta/${LIFE};if(age>1.)age=-1.;}
  if(age<0.){
   float angle=angleFor(vUV),rate=unpack16(texture2D(uRim,vec2(angle/6.283185,.5)).rg);
   float chance=1.-exp(-rate*uDelta*1.2);
   if(rate>.0001&&hash(vUV+vec2(floor(uTime*60.),93.))<chance){
    vec2 normal=vec2(cos(angle),sin(angle));
    head=pow((rate/${RATE_SCALE}.)/(${WATER_MODEL.discharge}*sqrt(2.*WATER_GRAVITY)),2./3.);
    tangent=clamp(dot(velocityAt(normal*(WATER_RADIUS-.018)),vec2(-normal.y,normal.x)),-.07,.07);age=0.;
   }
  }
 }
 gl_FragColor=vec4(clamp(head/${HEAD_MAX},0.,1.),tangent/.5+.5,pack16(age));
}`;
const pointVertex=`
precision highp float;
attribute vec2 aParticle;
uniform sampler2D uBirth;
uniform vec2 uPointer;
uniform vec2 uResolution;
varying float vAlpha;
varying float vSoft;
${modelGLSL}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec4 value=texture2D(uBirth,aParticle);float age=unpack16(value.ba),head=value.r*${HEAD_MAX},tangent=(value.g*2.-1.)*.25;
 float identity=hash(aParticle),theta=fract((floor(aParticle.x*64.)+floor(aParticle.y*32.)*64.+identity)/2048.)*6.283185;
 vec2 normal=vec2(cos(theta),sin(theta)),side=vec2(-normal.y,normal.x);
 float time=max(0.,age)*${LIFE};
 float speed=sqrt(2.*WATER_GRAVITY*max(head,.00002));
 // Gravity projected along the sloping metal carries a thin film to its lip.
 float acceleration=WATER_GRAVITY*.045;
 float edgeTime=(sqrt(speed*speed+2.*acceleration*(1.-WATER_RADIUS))-speed)/acceleration;
 float filmTime=min(time,edgeTime),air=max(0.,time-edgeTime),tau=.05+.025*identity;
 float radius=WATER_RADIUS+speed*filmTime+.5*acceleration*filmTime*filmTime;
 float edgeSpeed=speed+acceleration*edgeTime;
 radius+=edgeSpeed*tau*(1.-exp(-air/tau));
 vec2 q=normal*radius+side*tangent*(filmTime+tau*(1.-exp(-air/tau)));
 q+=side*sin(air*.85+identity*17.)*min(air,1.5)*.008;
 float drop=WATER_GRAVITY*(tau*air-tau*tau*(1.-exp(-air/tau)));
 float angle=.20+uPointer.x*.10,c=cos(angle),s=sin(angle);
 vec2 pool=q-vec2(.02,.075);pool.y/=1.48;
 vec2 plane=vec2(c*pool.x-s*pool.y,s*pool.x+c*pool.y);
 plane.y-=drop*.42;
 gl_Position=vec4(plane/2.45*2.,0.,1.);
 if(age<0.||age>1.)gl_Position=vec4(3.,3.,0.,1.);
 float fade=smoothstep(0.,.045,time)*(1.-smoothstep(5.,8.5,time));
 // Far-side airborne water is hidden by the basin, not cut from the simulation.
 if(normal.y>0.)fade*=1.-smoothstep(.035,.20,drop);
 vAlpha=fade*(.20+.45*clamp(head/.006,0.,1.));vSoft=smoothstep(0.,1.8,air);
 gl_PointSize=(3.3+vSoft*7.+identity*2.)*clamp(uResolution.x/500.,.65,1.5);
}`;
const pointFragment=`
precision mediump float;
varying float vAlpha;
varying float vSoft;
void main(){
 vec2 d=gl_PointCoord-.5;float halo=exp(-dot(d,d)*19.)*.18;
 float core=exp(-dot(d,d)*mix(110.,65.,vSoft))*.34;
 float alpha=(halo+core)*vAlpha;
 vec3 color=mix(vec3(.60,.73,.87),vec3(.97,.99,1.),clamp(core/(halo+core+.00001),0.,1.));
 gl_FragColor=vec4(color,alpha);
}`;

export class RimOverflow {
 constructor(gl){
  this.gl=gl;this.bins=256;this.count=2048;this.clock=0;this.initialized=false;this.spraySupported=gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)>=1;
  const link=(vertex,fragment)=>{
   const compile=(type,code)=>{const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);return shader;};
   const v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
   const linked=gl.getProgramParameter(program,gl.LINK_STATUS),error=linked?'':gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(v)+' '+gl.getShaderInfoLog(f);
   gl.deleteShader(v);gl.deleteShader(f);if(!linked){gl.deleteProgram(program);throw new Error(error);}return program;
  };
  this.mapProgram=link(quadVertex,rimFragment);
  this.birthProgram=this.spraySupported?link(quadVertex,birthFragment):null;this.pointProgram=this.spraySupported?link(pointVertex,pointFragment):null;
  const locations=program=>program?Object.fromEntries(['uWater','uFlow','uRim','uBirth','uTime','uDelta','uReset','uPointer','uResolution'].map(name=>[name,gl.getUniformLocation(program,name)])):null;
  this.mapLocations=locations(this.mapProgram);this.birthLocations=locations(this.birthProgram);this.pointLocations=locations(this.pointProgram);
  this.mapPosition=gl.getAttribLocation(this.mapProgram,'aPosition');this.birthPosition=this.birthProgram?gl.getAttribLocation(this.birthProgram,'aPosition'):0;this.pointPosition=this.pointProgram?gl.getAttribLocation(this.pointProgram,'aParticle'):0;
  this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const indices=new Float32Array(this.count*2);for(let y=0;y<32;y++)for(let x=0;x<64;x++){let i=(y*64+x)*2;indices[i]=(x+.5)/64;indices[i+1]=(y+.5)/32;}
  this.points=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.points);gl.bufferData(gl.ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  const targets=(width,height,unit,blank)=>[0,1].map(()=>{
   const texture=gl.createTexture();gl.activeTexture(unit);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,blank);
   const buffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Rim target unavailable');return {texture,buffer};
  });
  const blank=new Uint8Array(this.bins*4);for(let i=0;i<blank.length;i+=4){blank[i]=128;blank[i+2]=128;}
  this.mapTargets=targets(this.bins,1,gl.TEXTURE5,blank);this.birthTargets=this.spraySupported?targets(64,32,gl.TEXTURE6,null):[];gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 get texture(){return this.mapTargets[0].texture;}
 pause(){this.clock=0;}
 update(now,water,quiet){
  const delta=quiet?0:this.clock?Math.min((now-this.clock)/1000,.05):1/60;this.clock=now;
  if(quiet&&this.initialized){this.pause();return;}
  const gl=this.gl;gl.disable(gl.BLEND);
  const pass=(program,l,position,target,width,height)=>{
   gl.useProgram(program);gl.viewport(0,0,width,height);gl.bindFramebuffer(gl.FRAMEBUFFER,target.buffer);
   gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,water.previousTexture);gl.uniform1i(l.uWater,2);
   gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,water.flowTexture);gl.uniform1i(l.uFlow,4);
   gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(l.uRim,5);
   gl.uniform1f(l.uTime,now/1000);gl.uniform1f(l.uDelta,delta);gl.uniform1f(l.uReset,this.initialized?0:1);
   gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  };
  pass(this.mapProgram,this.mapLocations,this.mapPosition,this.mapTargets[1],this.bins,1);gl.drawArrays(gl.TRIANGLES,0,6);this.mapTargets.reverse();
  if(this.birthProgram){
   pass(this.birthProgram,this.birthLocations,this.birthPosition,this.birthTargets[1],64,32);
   gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,this.birthTargets[0].texture);gl.uniform1i(this.birthLocations.uBirth,6);gl.drawArrays(gl.TRIANGLES,0,6);this.birthTargets.reverse();
  }
  this.initialized=true;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 draw(width,height,tilt){
  if(!this.pointProgram)return;const gl=this.gl,l=this.pointLocations;gl.useProgram(this.pointProgram);gl.viewport(0,0,width,height);
  gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,this.birthTargets[0].texture);gl.uniform1i(l.uBirth,6);gl.uniform2f(l.uPointer,...tilt);gl.uniform2f(l.uResolution,width,height);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.points);gl.enableVertexAttribArray(this.pointPosition);gl.vertexAttribPointer(this.pointPosition,2,gl.FLOAT,false,0,0);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.POINTS,0,this.count);gl.disable(gl.BLEND);
 }
 measure(){
  const gl=this.gl,pixels=new Uint8Array(this.bins*4);gl.bindFramebuffer(gl.FRAMEBUFFER,this.mapTargets[0].buffer);gl.readPixels(0,0,this.bins,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let active=0,peak=0,angle=0,rate=0;const sectors=[0,0,0,0];
  for(let i=0;i<this.bins;i++){const flux=(pixels[i*4]*256+pixels[i*4+1]-32768)/32767;if(flux>.002){active++;sectors[Math.floor(i/(this.bins/4))]+=flux;}if(flux>peak){peak=flux;angle=(i+.5)/this.bins*360;}rate+=Math.max(0,flux)/RATE_SCALE;}
  let spray=0;if(this.birthTargets.length){const births=new Uint8Array(this.count*4);gl.bindFramebuffer(gl.FRAMEBUFFER,this.birthTargets[0].buffer);gl.readPixels(0,0,64,32,gl.RGBA,gl.UNSIGNED_BYTE,births);for(let i=0;i<this.count;i++)if(births[i*4+2]*256+births[i*4+3]>=32768)spray++;}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {active,peak,angle,rate:rate*2*Math.PI*WATER_MODEL.radius/this.bins,sectors,spray};
 }
 destroy(){
  const gl=this.gl;for(const target of [...(this.mapTargets||[]),...(this.birthTargets||[])]){gl.deleteTexture(target.texture);gl.deleteFramebuffer(target.buffer);}
  for(const program of [this.mapProgram,this.birthProgram,this.pointProgram])if(program)gl.deleteProgram(program);if(this.quad)gl.deleteBuffer(this.quad);if(this.points)gl.deleteBuffer(this.points);this.mapTargets=[];this.birthTargets=[];
 }
}
