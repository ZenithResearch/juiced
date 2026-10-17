import {WATER_MODEL,modelGLSL} from './water-model.js';
const vertex=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const common=`
precision highp float;
varying vec2 vUV;
uniform sampler2D uState;
uniform sampler2D uFlow;
uniform vec2 uTexel;
uniform float uDelta;
${modelGLSL}
bool inside(vec2 uv){return length((uv-.5)*2.)<WATER_RADIUS;}
float heightAt(vec2 uv){return unpack16(texture2D(uState,uv).rg)*HEIGHT_SCALE;}
vec2 flowAt(vec2 uv){vec4 value=texture2D(uFlow,uv);return vec2(unpack16(value.rg),unpack16(value.ba))*FLOW_SCALE;}
`;
const momentum=common+`
uniform vec4 uContacts[2];
uniform vec3 uDrop;
float pressureAt(vec2 uv){
 vec2 q=(uv-.5)*2.;float pressure=0.;
 for(int i=0;i<2;i++){vec4 contact=uContacts[i];vec2 d=q-contact.xy;pressure+=${WATER_MODEL.pressureHead}*contact.z*exp(-dot(d,d)/(contact.w*contact.w));}
 vec2 d=q-uDrop.xy;pressure+=uDrop.z*exp(-dot(d,d)/.0075);
 return pressure;
}
void main(){
 vec2 east=vUV+vec2(uTexel.x,0.),north=vUV+vec2(0.,uTexel.y),velocity=vec2(0.);
 if(inside(vUV)){
  float potential=heightAt(vUV)+pressureAt(vUV);
  vec2 previous=flowAt(vUV);
  // Viscosity removes sharp, grid-scale motion; extra lip friction softens
  // returning waves while keeping overtopping tied to the actual boundary.
  vec2 diffusion=.024*(flowAt(east)+flowAt(vUV-vec2(uTexel.x,0.))+flowAt(north)+flowAt(vUV-vec2(0.,uTexel.y))-4.*previous);
  // Staggered velocities sit on the east/north cell faces. Closed faces have
  // no normal flow; raised crests discharge through the height pass instead.
  if(inside(east))velocity.x=previous.x+diffusion.x-WATER_GRAVITY*uDelta/(2.*uTexel.x)*(heightAt(east)+pressureAt(east)-potential);
  if(inside(north))velocity.y=previous.y+diffusion.y-WATER_GRAVITY*uDelta/(2.*uTexel.y)*(heightAt(north)+pressureAt(north)-potential);
  float damping=mix(${WATER_MODEL.damping},.986,smoothstep(.70,WATER_RADIUS,length((vUV-.5)*2.)));
  velocity=clamp(velocity*damping,vec2(-${WATER_MODEL.maxSpeed}),vec2(${WATER_MODEL.maxSpeed}));
 }
 gl_FragColor=vec4(pack16(velocity.x/FLOW_SCALE),pack16(velocity.y/FLOW_SCALE));
}`;
const continuity=common+`
void main(){
 float next=0.,change=0.;
 if(inside(vUV)){
  vec2 east=vUV+vec2(uTexel.x,0.),west=vUV-vec2(uTexel.x,0.),north=vUV+vec2(0.,uTexel.y),south=vUV-vec2(0.,uTexel.y);
  float height=heightAt(vUV);vec2 face=flowAt(vUV),left=flowAt(west),bottom=flowAt(south);
  // Pairwise face fluxes conserve displaced water. Overtopping is an outward
  // boundary flux, so the escaped volume is removed from the basin itself.
  float e=inside(east)?max(.002,WATER_DEPTH+(height+heightAt(east))*.5)*face.x:discharge(height,max(left.x,0.));
  float w=inside(west)?max(.002,WATER_DEPTH+(height+heightAt(west))*.5)*left.x:-discharge(height,max(-face.x,0.));
  float n=inside(north)?max(.002,WATER_DEPTH+(height+heightAt(north))*.5)*face.y:discharge(height,max(bottom.y,0.));
  float s=inside(south)?max(.002,WATER_DEPTH+(height+heightAt(south))*.5)*bottom.y:-discharge(height,max(-face.y,0.));
  next=clamp(height-uDelta/(2.*uTexel.x)*(e-w+n-s),-WATER_DEPTH+.002,.08);
  change=next-height;
 }
 gl_FragColor=vec4(pack16(next/HEIGHT_SCALE),pack16(change/HEIGHT_SCALE));
}`;

export class WaterSimulation {
 constructor(gl){
  this.gl=gl;this.size=WATER_MODEL.size;this.clock=0;this.remainder=0;this.lastContacts=[[0,0,0,.12],[0,0,0,.105]];this.nextDrop=0;this.steps=0;
  const link=fragment=>{
   const compile=(type,code)=>{const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);return shader;};
   const v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
   const linked=gl.getProgramParameter(program,gl.LINK_STATUS),error=linked?'':gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(f);
   gl.deleteShader(v);gl.deleteShader(f);if(!linked){gl.deleteProgram(program);throw new Error(error);}return program;
  };
  this.momentumProgram=link(momentum);this.heightProgram=link(continuity);
  const locations=program=>Object.fromEntries(['uState','uFlow','uTexel','uDelta','uContacts[0]','uDrop'].map(name=>[name,gl.getUniformLocation(program,name)]));
  this.momentumLocations=locations(this.momentumProgram);this.heightLocations=locations(this.heightProgram);
  this.momentumPosition=gl.getAttribLocation(this.momentumProgram,'aPosition');this.heightPosition=gl.getAttribLocation(this.heightProgram,'aPosition');
  this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const blank=new Uint8Array(this.size*this.size*4);for(let i=0;i<blank.length;i+=4){blank[i]=128;blank[i+2]=128;}
  const makeTargets=()=>[0,1].map(()=>{
   const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.size,this.size,0,gl.RGBA,gl.UNSIGNED_BYTE,blank);
   const buffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Water target unavailable');return {texture,buffer};
  });
  this.targets=makeTargets();this.flowTargets=makeTargets();gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 get texture(){return this.targets[0].texture;}
 get previousTexture(){return this.targets[1].texture;}
 get flowTexture(){return this.flowTargets[0].texture;}
 pause(){this.clock=0;this.remainder=0;}
 pass(program,locations,position,target){
  const gl=this.gl;gl.useProgram(program);gl.bindFramebuffer(gl.FRAMEBUFFER,target.buffer);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(locations.uState,2);
  gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,this.flowTexture);gl.uniform1i(locations.uFlow,4);
  gl.uniform2f(locations.uTexel,1/this.size,1/this.size);gl.uniform1f(locations.uDelta,WATER_MODEL.step);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 }
 update(now,contacts,camera,quiet){
  if(quiet){this.pause();return;}
  this.remainder+=this.clock?Math.min(now-this.clock,80):16.7;this.clock=now;
  const count=Math.min(10,Math.floor(this.remainder/(1000*WATER_MODEL.step)));if(!count)return;this.remainder-=count*(1000*WATER_MODEL.step);
  const gl=this.gl;gl.disable(gl.BLEND);gl.viewport(0,0,this.size,this.size);
  for(let step=0;step<count;step++){
   const t=(step+1)/count,values=new Float32Array(8);
   contacts.forEach((contact,i)=>values.set(contact.map((v,j)=>this.lastContacts[i][j]+(v-this.lastContacts[i][j])*t),i*4));
   let drop=[0,0,0];if(camera&&now>=this.nextDrop){const angle=now*.00093,radius=.22+.32*(.5+.5*Math.sin(now*.00117));drop=[Math.cos(angle)*radius,Math.sin(angle)*radius,.008];this.nextDrop=now+3200;}
   this.pass(this.momentumProgram,this.momentumLocations,this.momentumPosition,this.flowTargets[1]);
   gl.uniform4fv(this.momentumLocations['uContacts[0]'],values);gl.uniform3f(this.momentumLocations.uDrop,...drop);gl.drawArrays(gl.TRIANGLES,0,6);this.flowTargets.reverse();
   this.pass(this.heightProgram,this.heightLocations,this.heightPosition,this.targets[1]);gl.drawArrays(gl.TRIANGLES,0,6);this.targets.reverse();this.steps++;
  }
  this.lastContacts=contacts.map(c=>[...c]);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 measure(){
  const gl=this.gl,pixels=new Uint8Array(this.size*this.size*4);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.targets[0].buffer);gl.readPixels(0,0,this.size,this.size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let energy=0,peak=0,volume=0;
  for(let y=0;y<this.size;y++)for(let x=0;x<this.size;x++){
   if(Math.hypot((x+.5)/this.size*2-1,(y+.5)/this.size*2-1)>=WATER_MODEL.radius)continue;
   const i=(y*this.size+x)*4,h=(pixels[i]*256+pixels[i+1]-32768)/32767*WATER_MODEL.heightScale;
   energy+=h*h;peak=Math.max(peak,Math.abs(h));volume+=(WATER_MODEL.depth+h)*(2/this.size)**2;
  }
  return {energy:energy/(this.size*this.size),peak,volume};
 }
 destroy(){
  const gl=this.gl;for(const target of [...(this.targets||[]),...(this.flowTargets||[])]){gl.deleteTexture(target.texture);gl.deleteFramebuffer(target.buffer);}
  if(this.quad)gl.deleteBuffer(this.quad);if(this.momentumProgram)gl.deleteProgram(this.momentumProgram);if(this.heightProgram)gl.deleteProgram(this.heightProgram);this.targets=[];this.flowTargets=[];
 }
}
