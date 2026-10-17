import {GlyphRenderer} from './glyph-renderer.js';
import {WaterSimulation} from './water-simulation.js';
import {LuminousParticles} from './luminous-particles.js';
import {WaterLettering} from './water-lettering.js';
import {INVITATION} from './invitation-copy.js';
import {RimOverflow} from './rim-overflow.js';
import {WATER_MODEL} from './water-model.js';
import {cameraProjection,projectedCameraUV,cameraProjectionGLSL} from './camera-projection.js';
import {reflectionLightGLSL} from './reflection-light.js';

const vertexSource=`
attribute vec2 aPosition;
varying vec2 vUV;
void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}
`;
const blurSource=`
precision mediump float;
varying vec2 vUV;
uniform sampler2D uSource;
uniform vec2 uStep;
void main(){
 vec3 light=texture2D(uSource,vUV).rgb*.204164;
 light+=(texture2D(uSource,vUV+uStep).rgb+texture2D(uSource,vUV-uStep).rgb)*.180174;
 light+=(texture2D(uSource,vUV+uStep*2.).rgb+texture2D(uSource,vUV-uStep*2.).rgb)*.123832;
 light+=(texture2D(uSource,vUV+uStep*3.).rgb+texture2D(uSource,vUV-uStep*3.).rgb)*.066282;
 light+=(texture2D(uSource,vUV+uStep*4.).rgb+texture2D(uSource,vUV-uStep*4.).rgb)*.027631;
 gl_FragColor=vec4(light,1.);
}
`;
const fragmentSource=`
precision highp float;
varying vec2 vUV;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform sampler2D uWater;
uniform sampler2D uRim;
uniform float uTime;
uniform sampler2D uCamera;
uniform sampler2D uPreviousCamera;
uniform float uCameraAmount;
uniform vec2 uCameraOrigin;
uniform vec4 uCameraBasis;
uniform float uCameraHistory;
uniform sampler2D uInvitation;
uniform float uInvitationAmount;

mat2 turn(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float lineDistance(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));}
${cameraProjectionGLSL}
${reflectionLightGLSL}
float cameraLuma(vec2 uv){
 return dot(texture2D(uCamera,clamp(uv,.01,.99)).rgb,vec3(.2126,.7152,.0722));
}
float previousLuma(vec2 uv){
 return dot(texture2D(uPreviousCamera,clamp(uv,.01,.99)).rgb,vec3(.2126,.7152,.0722));
}
float softLight(vec2 uv){
 return cameraLuma(uv);
}
float previousLight(vec2 uv){
 return previousLuma(uv);
}
float fieldHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float softNoise(vec2 p){
 vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(fieldHash(cell),fieldHash(cell+vec2(1.,0.)),f.x),mix(fieldHash(cell+vec2(0.,1.)),fieldHash(cell+vec2(1.,1.)),f.x),f.y);
}
vec2 current(vec2 q,float time){
 return vec2(sin(q.y*5.4+sin(q.x*3.2-time*.18)+time*.22),cos(q.x*5.8+sin(q.y*3.4+time*.14)-time*.17));
}
vec3 livingReflection(vec2 q,vec3 normal,out float livingLight,float activity){
 vec2 drift=current(q,uTime);
 vec2 source=cameraUV(q)+normal.xy*.22+drift*.006;
 vec2 uv=clamp(source,.01,.99);
 vec2 stepSize=vec2(.014,.019);
 float center=softLight(uv);
 float left=softLight(uv-vec2(stepSize.x,0.)),right=softLight(uv+vec2(stepSize.x,0.));
 float down=softLight(uv-vec2(0.,stepSize.y)),up=softLight(uv+vec2(0.,stepSize.y));
 float light=center*.62+(left+right+down+up)*.095;
 vec2 contour=vec2(right-left,up-down);
 float motion=0.;
 if(uCameraHistory>.5){
  motion=abs(center-previousLight(uv));
 }
 // Only light, soft contours and frame-to-frame movement survive the camera.
 // Broad bloom inhabits the water; the finest emissions follow its currents.
 float outline=1.-exp(-length(contour)*4.5);
 float bloom=pow(outline,.65)*.65+motion*1.4;
 float caustic=pow(.5+.5*sin(q.x*10.+q.y*8.+drift.x*2.2-uTime*.34),5.);
 float organisms=smoothstep(.66,.92,softNoise(q*92.+drift*1.7));
 float emission=outline*(.30+.30*caustic+organisms*.40)+motion*2.8;
 float breath=.94+.06*sin(uTime*.38+light*4.);
 vec3 glow=mix(vec3(.55,.48,.90),vec3(.38,.90,.84),.56+.24*sin(q.y*2.-uTime*.10));
 vec3 water=mix(vec3(.045,.075,.14),vec3(.44,.62,.70),reflectionTone(light));
 // Camera-shaped light stays legible at rest; water movement adds shimmer.
 float presence=.55+.45*activity;
 water+=glow*(bloom*.50+emission*.55)*breath*presence;
 water+=vec3(.82,.95,1.)*pow(outline,3.)*organisms*.22*presence;
 livingLight=clamp(.24+outline*.80+motion*2.,0.,1.);
 return water;
}

// Only reflected light and suggestions of an unseen canopy. The scene is
// analytic: the depth belongs to the water rather than a picture on it.
vec3 beyond(vec3 direction){
 vec2 q=direction.xy/max(direction.z,.28)*2.4;
 vec3 deep=vec3(.065,.045,.125),silver=vec3(.64,.60,.73);
 vec3 c=mix(deep,silver,smoothstep(-1.35,1.3,q.y));
 float opening=exp(-pow((q.x+.32+sin(q.y*1.7)*.19)*1.65,2.));
 c=mix(c,vec3(.90,.88,.92),opening*.48);
 float veil=.5+.5*sin(q.x*3.+sin(q.y*2.4)*1.4);
 c+=vec3(.045,.021,.082)*veil;
 float shadow=lineDistance(q,vec2(.58,-1.2),vec2(.28,1.2));
 shadow=min(shadow,lineDistance(q,vec2(.46,-.3),vec2(1.05,.64)));
 shadow=min(shadow,lineDistance(q,vec2(.38,.22),vec2(-.06,.94)));
 shadow=min(shadow,lineDistance(q,vec2(-.85,-1.1),vec2(-.61,.72)));
 shadow=min(shadow,lineDistance(q,vec2(-.73,-.18),vec2(-1.20,.55)));
 c=mix(c,deep,exp(-shadow*shadow*175.)*.42);
 float horizon=exp(-pow((q.y-.20-sin(q.x*1.8)*.16)*9.,2.));
 c+=vec3(.15,.12,.21)*horizon*.4;
 float star=exp(-dot(q-vec2(-.25,.31),q-vec2(-.25,.31))*2400.);
 star+=exp(-dot(q-vec2(.32,.14),q-vec2(.32,.14))*3100.);
 star+=exp(-dot(q-vec2(-.43,-.12),q-vec2(-.43,-.12))*3600.);
 c+=vec3(.51,.46,.66)*star*.45;
 return c;
}
vec3 metalLight(vec3 direction){
 vec2 q=direction.xy/max(abs(direction.z),.22)*2.7;
 vec3 c=mix(vec3(.14,.11,.20),vec3(.90,.88,.88),smoothstep(-.6,1.2,q.y));
 float band=exp(-pow((q.x+.38+q.y*.07)*2.4,2.));
 c=mix(c,vec3(.98,.97,.93),band*.88);
 c=mix(c,vec3(.15,.12,.22),exp(-pow((q.x-.62)*5.,2.))*.80);
 c+=vec3(.045,.02,.09)*(.5+.5*sin(q.x*2.1+q.y));
 return c;
}
float unpackWater(vec2 value){return (dot(floor(value*255.+.5),vec2(256.,1.))-32768.)/32767.;}
vec2 waterTexel(vec2 uv){vec4 value=texture2D(uWater,uv);return vec2(unpackWater(value.rg),unpackWater(value.ba))*${WATER_MODEL.heightScale};}
vec2 waterState(vec2 q){
 // Decode BEFORE interpolating: packed bytes must not blend across carries.
 vec2 p=clamp(q*.5+.5,.005,.995)*128.-.5,cell=floor(p),f=fract(p);
 vec2 uv=(cell+.5)/128.;
 return mix(mix(waterTexel(uv),waterTexel(uv+vec2(1./128.,0.)),f.x),mix(waterTexel(uv+vec2(0.,1./128.)),waterTexel(uv+vec2(1./128.)),f.x),f.y);
}
vec2 waterSlope(vec2 q,out float rippleLight,out vec2 gradient,out float curvature,out vec2 state){
 vec2 slope=.0012*cos(q.x*4.2+q.y*2.6-uTime*.19)*vec2(4.2,2.6);
 slope+=.0010*cos(q.y*4.8-q.x*1.4+uTime*.14)*vec2(-1.4,4.8);
 float shore=1.-smoothstep(.62,.84,length(q)),e=2./128.;
 state=waterState(q);
 float left=waterState(q-vec2(e,0.)).x,right=waterState(q+vec2(e,0.)).x;
 float down=waterState(q-vec2(0.,e)).x,up=waterState(q+vec2(0.,e)).x;
 gradient=vec2(right-left,up-down)/(2.*e);
 curvature=right+left+down+up-4.*state.x;
 slope+=gradient*.38*shore;
 // Motion and bending excite individual crests; constant depression does not
 // turn up the brightness of a stationary blanket of noise.
 rippleLight=smoothstep(.000006,.00008,abs(state.y))*shore;
 if(uCameraAmount>.001){
  // Broad differences capture light changes without pixel-sized surface noise.
  vec2 uv=cameraUV(q),stepSize=vec2(.035,.045);
  vec3 luminance=vec3(.2126,.7152,.0722);
  float x=dot(texture2D(uCamera,clamp(uv+vec2(stepSize.x,0.),.01,.99)).rgb-texture2D(uCamera,clamp(uv-vec2(stepSize.x,0.),.01,.99)).rgb,luminance);
  float y=dot(texture2D(uCamera,clamp(uv+vec2(0.,stepSize.y),.01,.99)).rgb-texture2D(uCamera,clamp(uv-vec2(0.,stepSize.y),.01,.99)).rgb,luminance);
  slope+=vec2(-x,y)*.013*uCameraAmount*shore;
 }
 return slope;
}
float seed(float n){return fract(sin(n*127.1+43.7)*43758.5453);}
vec3 stirredLight(vec2 q,vec2 gradient,float curvature,vec2 state,float activity){
 vec3 light=vec3(0.);
 // Three refracted depths supply faint submerged light beneath the moving
 // particle population. Signed bends focus the glow and shift its projection.
 for(int i=0;i<3;i++){
  float depth=.025+float(i)*.035;
  vec2 p=q+gradient*depth*.7;
  p.y+=state.x*.13-depth*.25;
  p+=current(p,uTime)*depth*.20;
  float volume=pow(softNoise(p*17.+vec2(uTime*.009,-uTime*.007)),3.);
  float focus=clamp(.6-curvature*85.,.15,1.6);
  vec3 tint=mix(vec3(.42,.35,.80),vec3(.28,.72,.78),1.-float(i)*.25);
  light+=tint*volume*activity*.16*focus*exp(-depth*7.);
 }
 return light;
}
vec3 moonlitKoi(vec2 q,vec2 gradient,vec2 state){
 vec3 light=vec3(0.);
 // A suggestion beneath the water, made of separated luminous grains.
 // The two bodies orbit a shared centre; their tails flex independently.
 q+=gradient*.045;q.y+=state.x*.16-.025;
 for(int i=0;i<2;i++){
  float identity=float(i),angle=uTime*.035+identity*3.141593+.4;
  vec2 radial=vec2(cos(angle),sin(angle)),tangent=vec2(-radial.y,radial.x);
  vec2 d=q-radial*.34;
  vec2 p=vec2(dot(d,tangent),dot(d,radial));
  if(abs(p.x)>.34||abs(p.y)>.13)continue;
  float bend=sin(p.x*13.-uTime*.62+identity*1.7)*(.006+.018*(1.-smoothstep(-.20,.12,p.x)));
  p.y-=bend;
  float body=1.-smoothstep(.88,1.06,length(vec2((p.x+.005)/.158,p.y/.043)));
  float tailDepth=clamp((-.135-p.x)/.16,0.,1.);
  float tailWidth=.007+.068*tailDepth;
  float tail=(1.-smoothstep(-.17,-.135,p.x))*smoothstep(-.30,-.28,p.x);
  tail*=1.-smoothstep(.78,1.05,abs(p.y)/tailWidth);
  tail*=smoothstep(-.003,.011,abs(p.y)-max(0.,tailDepth-.55)*.065);
  vec2 fin=vec2((p.x-.005)/.065,(abs(p.y)-.047)/.018);
  float fins=(1.-smoothstep(.65,1.1,length(fin)))*.34;
  float shape=max(body,max(tail,fins));
  if(shape<.001)continue;
  vec2 grid=p*74.,cell=floor(grid);
  vec2 centre=vec2(.18+.64*fieldHash(cell+identity*31.),.18+.64*fieldHash(cell+17.+identity*31.));
  float grain=exp(-dot(fract(grid)-centre,fract(grid)-centre)*24.);
  float scattered=step(.26,fieldHash(cell+43.));
  float breath=.82+.18*sin(uTime*.35+fieldHash(cell)*6.283185);
  vec3 tint=mix(vec3(.39,.78,.76),vec3(.65,.58,.86),identity*.68);
  light+=tint*shape*(grain*scattered*.42*breath+.035);
 }
 return light;
}
vec3 invitationLight(vec2 q,vec2 gradient){
 if(uInvitationAmount<.001)return vec3(0.);
 // Letterforms are a generated alpha mask. Their light, fine organisms,
 // refraction and emergence are computed here in the water's coordinates.
 float width=mix(1.52,1.20,smoothstep(480.,760.,uResolution.x));
 vec2 uv=(q+gradient*.018-vec2(0.,.035))/vec2(width,width*.343333)+.5;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return vec3(0.);
 float letter=texture2D(uInvitation,uv).a;
 vec2 stepSize=vec2(1./512.,1./176.);
 float halo=texture2D(uInvitation,uv+stepSize*vec2(2.,0.)).a+texture2D(uInvitation,uv-stepSize*vec2(2.,0.)).a;
 halo+=texture2D(uInvitation,uv+stepSize*vec2(0.,2.)).a+texture2D(uInvitation,uv-stepSize*vec2(0.,2.)).a;
 vec2 cell=floor(uv*vec2(440.,152.));
 float organism=.58+.42*step(.36,fieldHash(cell));
 float shimmer=.88+.12*sin(uTime*1.4+fieldHash(cell+18.)*6.283185);
 return (vec3(.48,.92,1.)*letter*organism*.92+vec3(.18,.58,.82)*halo*.075)*uInvitationAmount*shimmer;
}
void overflowLight(vec2 q,inout vec3 color){
 float radius=length(q);
 if(radius<.805||radius>1.012)return;
 // The whole rim reads the latest outward discharge. No preset spill lanes.
 float angle=fract(atan(q.y,q.x)/6.283185+1.);
 vec4 rim=texture2D(uRim,vec2(angle,.5));
 float rate=max(0.,unpackWater(rim.rg)),wet=max(0.,unpackWater(rim.ba));
 float energy=clamp(rate*.8+wet*.45,0.,1.);
 float crest=exp(-pow((radius-.839)*95.,2.));
 float film=smoothstep(.832,.853,radius)*(1.-smoothstep(.982,1.009,radius));
 float grain=.55+.45*softNoise(vec2(angle*110.,radius*80.-uTime*.7));
 color=mix(color,vec3(.73,.79,.89),energy*film*grain*.23);
 color+=vec3(.26,.45,.55)*(crest*rate*.24+film*wet*.08);
}
void main(){
 vec3 paper=vec3(238.,234.,224.)/255.;
 vec2 q=(vUV-.5)*2.45;
 q=turn(.20+uPointer.x*.10)*q;
 q.y*=1.48;q+=vec2(.02,.075);
 float r=length(q);
 float body=1.-smoothstep(.991,1.008,r);
 float castShadow=exp(-max(length((q-vec2(.015,-.09))*vec2(.98,1.))-1.,0.)*20.)*.13;
 castShadow*=smoothstep(1.,1.045,r);
 vec3 color=paper*(1.-castShadow);
 float lower=1.-smoothstep(.998,1.010,length(q-vec2(.012,-.052)));
 vec3 underside=mix(vec3(.23,.19,.30),vec3(.49,.46,.53),.5+.5*q.x);
 color=mix(color,underside,lower);
 if(r<1.012){
  vec3 incident=normalize(vec3(q.x*.43,q.y*.34,-1.8));
  vec3 rimNormal=normalize(vec3(q*.92,.30+pow(abs(r-.91)*8.,2.)));
  vec3 metal=metalLight(reflect(incident,rimNormal));
  float edge=exp(-pow((r-.970)*150.,2.));
  metal+=vec3(.27,.26,.30)*edge;
  float channel=exp(-pow((r-.884)*50.,2.));
  metal=mix(metal,vec3(.27,.22,.34),channel*.65);
  float rippleLight=0.,curvature=0.;vec2 gradient=vec2(0.),state=vec2(0.);
  vec3 n=normalize(vec3(-waterSlope(q,rippleLight,gradient,curvature,state),1.));
  n=normalize(n+vec3(uPointer*.20,0.));
  vec3 reflected=reflect(incident,n);
  vec3 water=mix(beyond(reflected),vec3(.12,.16,.25),.16);
  float life=.35;
  if(uCameraAmount>.001){
   water=mix(water,livingReflection(q,n,life,rippleLight),uCameraAmount);
  }
  vec2 flow=current(q,uTime);
  float caustic=exp(-pow(sin(q.y*4.2+q.x*2.8+flow.x*.65-uTime*.16)*5.,2.));
  water+=vec3(.09,.14,.20)*caustic*(1.-smoothstep(.52,.84,r))*.32;
  water+=stirredLight(q,gradient,curvature,state,rippleLight);
  if(uCameraAmount<.18)water+=moonlitKoi(q,gradient,state)*rippleLight*(1.-smoothstep(0.,.18,uCameraAmount));
  // A little absorption gives the still surface a dark, inhabited depth.
  water*=mix(.62+.28*pow(r,.7),.94,uCameraAmount);
  // Moving water catches a broad, quiet glancing light. Height change and
  // curvature reveal actual crests without adding timed decorative rings.
  float wake=(1.-exp(-abs(curvature)*1900.-abs(state.y)*2400.))*smoothstep(.005,.035,length(gradient));
  water+=vec3(.24,.29,.35)*wake*.45*(1.-smoothstep(.74,.83,r));
  float sky=pow(max(dot(n,normalize(vec3(-.7,.8,1.7)-incident)),0.),100.);
  water+=vec3(.22,.21,.26)*sky;
  float fresnel=pow(1.-max(dot(n,-incident),0.),4.);
  water=mix(water,vec3(.79,.76,.85),fresnel*.62);
  water+=invitationLight(q,gradient);
  float shore=exp(-pow((r-.835)*210.,2.));
  water+=vec3(.16,.13,.24)*shore;
  float waterMask=1.-smoothstep(.826,.849,r);
  vec3 surface=mix(metal,water,waterMask);
  float lip=exp(-pow((r-.994)*270.,2.));
  surface+=vec3(.24,.22,.28)*lip;
  color=mix(color,clamp(surface,0.,1.),body);
 }
 overflowLight(q,color);
 gl_FragColor=vec4(color,1.);
}
`;

export class OpticalRenderer extends GlyphRenderer {
 constructor(host,options){
  super(host,options);
  this.cameraVideo=null;this.cameraAmount=0;this.cameraTarget=0;this.cameraFrame=-1;this.cameraFrameToken=0;
  this.waterContacts=[[0,0,0,.12],[0,0,0,.105]];
  this.pointerContact=null;
  this.onWaterMove=e=>{
   if(e.pointerType!=='mouse'||this.quiet||this.forcedFallback||!this.visible||document.hidden)return;
   const controls=e.target.closest('.camera-controls');
   if(controls&&controls.dataset.camera!=='off'){this.pointerContact=null;return;}
   const q=this.screenToPool(e.clientX,e.clientY);
   this.pointerContact=Math.hypot(...q)<WATER_MODEL.radius-.018?q:null;
   if(this.pointerContact)this.waterActiveUntil=performance.now()+6000;
   this.host.dataset.rippleSource='pointer';this.request();
  };
  this.onWaterLeave=()=>{this.pointerContact=null;this.request();};
  host.addEventListener('pointermove',this.onWaterMove);host.addEventListener('pointerleave',this.onWaterLeave);
 }
 screenToPool(x,y){
  const r=this.host.getBoundingClientRect(),px=((x-r.left)/r.width-.5)*2.45,py=(.5-(y-r.top)/r.height)*2.45;
  const angle=.20+this.tilt[0]*.10,c=Math.cos(angle),s=Math.sin(angle);
  return [c*px+s*py+.02,(-s*px+c*py)*1.48+.075];
 }
 poolToScreen(q){
  const r=this.host.getBoundingClientRect(),x=q[0]-.02,y=(q[1]-.075)/1.48;
  const angle=.20+this.tilt[0]*.10,c=Math.cos(angle),s=Math.sin(angle);
  return [(r.left+((c*x-s*y)/2.45+.5)*r.width)/innerWidth,(r.top+(.5-(s*x+c*y)/2.45)*r.height)/innerHeight];
 }
 init(){
  const gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
  if(!gl)throw new Error('WebGL unavailable');this.gl=gl;this.release();
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);return shader;};
  const link=source=>{
   const v=compile(gl.VERTEX_SHADER,vertexSource),f=compile(gl.FRAGMENT_SHADER,source),p=gl.createProgram();
   gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
   const linked=gl.getProgramParameter(p,gl.LINK_STATUS),message=linked?'':gl.getProgramInfoLog(p)+' '+gl.getShaderInfoLog(f);
   gl.deleteShader(v);gl.deleteShader(f);if(!linked){gl.deleteProgram(p);throw new Error(message);}return p;
  };
  const program=link(fragmentSource);
  this.program=program;this.locations={};for(const name of ['uResolution','uPointer','uWater','uRim','uTime','uCamera','uPreviousCamera','uCameraAmount','uCameraOrigin','uCameraBasis','uCameraHistory','uInvitation','uInvitationAmount'])this.locations[name]=gl.getUniformLocation(program,name);
  const texture=()=>{
   const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));return t;
  };
  this.cameraTexture=texture();this.previousCameraTexture=texture();this.cameraSourceTexture=texture();this.cameraBlurTexture=texture();this.cameraFrames=0;
  this.invitationTexture=texture();
  const invitationTexture=this.invitationTexture;
  const drawInvitation=()=>{
   if(this.invitationTexture!==invitationTexture||this.lost)return;
   const canvas=this.host.ownerDocument.createElement('canvas');canvas.width=512;canvas.height=176;
   const context=canvas.getContext('2d');context.clearRect(0,0,512,176);context.fillStyle='#fff';context.textAlign='center';
   context.font='500 43px Manrope, Arial, sans-serif';context.fillText(INVITATION.lines[0],256,67);
   context.font='500 49px Manrope, Arial, sans-serif';context.fillText(INVITATION.lines[1],256,127);
   gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,invitationTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
   this.letteringGlyph=context.getImageData(0,0,512,176);this.waterLettering?.setGlyph(this.letteringGlyph);this.request();
  };
  drawInvitation();this.host.ownerDocument.fonts?.ready.then(drawInvitation);
  this.cameraBuffers=[gl.createFramebuffer(),gl.createFramebuffer()];this.cameraBlurSize=[0,0];
  this.blurProgram=link(blurSource);
  this.blurLocations={source:gl.getUniformLocation(this.blurProgram,'uSource'),step:gl.getUniformLocation(this.blurProgram,'uStep'),position:gl.getAttribLocation(this.blurProgram,'aPosition')};
  this.positionLocation=gl.getAttribLocation(program,'aPosition');this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);this.resources.push(this.quad);
  this.waterSimulation=new WaterSimulation(gl);
  this.rimOverflow=new RimOverflow(gl);
  this.luminousParticles=gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)>=3?new LuminousParticles(gl):null;
  this.waterLettering=gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)>=3?new WaterLettering(gl):null;
  if(this.waterLettering&&this.letteringGlyph)this.waterLettering.setGlyph(this.letteringGlyph);
  gl.disable(gl.DEPTH_TEST);this.ready=true;this.host.dataset.renderer=this.forcedFallback?'fallback':'webgl';
  this.host.dataset.vertices='6';this.host.dataset.scene='silver-pool';this.host.dataset.textures=String(11+(this.waterLettering?3:0)+(this.rimOverflow.spraySupported?2:0)+(this.luminousParticles?6:0));this.host.dataset.spillParticles=String(this.rimOverflow.spraySupported?this.rimOverflow.count:0);this.host.dataset.particles=String(this.luminousParticles?.count||0);this.host.dataset.camera='off';
 }
 setInvitation(value){this.invitationTarget=value?1:0;this.host.dataset.invitationLight=value?'forming':'hidden';this.request();}
 attachCamera(video){
  if(!this.ready||this.lost||this.forcedFallback)throw new Error('Reflection renderer unavailable');
  this.detachCamera();this.cameraVideo=video;this.cameraTarget=.92;this.cameraFrame=-1;
  if(this.quiet)this.cameraAmount=this.cameraTarget;
  this.host.dataset.camera='live';this.host.dataset.cameraStyle='bioluminescent';this.host.dataset.cameraProjection='viewport-masked';this.request();this.scheduleCameraFrame();
 }
 scheduleCameraFrame(){
  const video=this.cameraVideo;if(!video)return;
  const next=()=>{this.cameraWake=0;if(this.cameraVideo!==video)return;this.cameraFrameToken++;this.request();this.scheduleCameraFrame();};
  if(typeof video.requestVideoFrameCallback==='function'){
   this.cameraWakeKind='video';this.cameraWake=video.requestVideoFrameCallback(next);
  }else{this.cameraWakeKind='timer';this.cameraWake=setTimeout(next,67);}
 }
 detachCamera(){
  const video=this.cameraVideo;
  if(this.cameraWake){if(this.cameraWakeKind==='video')video?.cancelVideoFrameCallback?.(this.cameraWake);else clearTimeout(this.cameraWake);}
  this.cameraWake=0;this.cameraVideo=null;this.cameraTarget=0;this.cameraAmount=0;this.cameraFrame=-1;this.cameraFrameToken=0;this.cameraFrames=0;
  if(this.gl&&this.cameraTexture&&!this.lost){
   this.gl.activeTexture(this.gl.TEXTURE0);
   this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null);
   for(const texture of [this.cameraTexture,this.previousCameraTexture,this.cameraSourceTexture,this.cameraBlurTexture]){
    this.gl.bindTexture(this.gl.TEXTURE_2D,texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,1,1,0,this.gl.RGBA,this.gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
   }
  }
  this.cameraBlurSize=[0,0];this.host.dataset.cameraHistory='0';
  for(const key of ['cameraRegion','cameraOrigin','cameraBasis'])delete this.host.dataset[key];
  this.host.dataset.camera='off';this.host.dataset.cameraStyle='off';this.host.dataset.cameraProjection='off';this.request();
 }
 release(){
  this.waterLettering?.destroy();this.waterLettering=null;this.rimOverflow?.destroy();this.rimOverflow=null;this.luminousParticles?.destroy();this.luminousParticles=null;this.waterSimulation?.destroy();this.waterSimulation=null;super.release();if(this.gl){
   for(const texture of [this.cameraTexture,this.previousCameraTexture,this.cameraSourceTexture,this.cameraBlurTexture,this.invitationTexture])if(texture)this.gl.deleteTexture(texture);
   for(const buffer of this.cameraBuffers||[])this.gl.deleteFramebuffer(buffer);
   if(this.blurProgram)this.gl.deleteProgram(this.blurProgram);
  }
  this.invitationTexture=null;this.cameraTexture=null;this.previousCameraTexture=null;this.cameraSourceTexture=null;this.cameraBlurTexture=null;this.blurProgram=null;this.cameraBuffers=[];this.cameraFrames=0;
 }
 softenCamera(video){
  const gl=this.gl,width=240,height=Math.max(1,Math.round(width*video.videoHeight/video.videoWidth));
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.cameraSourceTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);
  if(this.cameraBlurSize[0]!==width||this.cameraBlurSize[1]!==height){
   for(const texture of [this.cameraTexture,this.previousCameraTexture,this.cameraBlurTexture]){
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
   }
   this.cameraBlurSize=[width,height];this.cameraFrames=0;
  }
  [this.cameraTexture,this.previousCameraTexture]=[this.previousCameraTexture,this.cameraTexture];
  gl.useProgram(this.blurProgram);gl.viewport(0,0,width,height);
  gl.uniform1i(this.blurLocations.source,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(this.blurLocations.position);gl.vertexAttribPointer(this.blurLocations.position,2,gl.FLOAT,false,0,0);
  const passes=[{source:this.cameraSourceTexture,target:this.cameraBlurTexture,step:[1/width,0]},{source:this.cameraBlurTexture,target:this.cameraTexture,step:[0,1/height]}];
  passes.forEach((pass,i)=>{
   gl.bindFramebuffer(gl.FRAMEBUFFER,this.cameraBuffers[i]);
   gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,pass.target,0);
   gl.bindTexture(gl.TEXTURE_2D,pass.source);gl.uniform2f(this.blurLocations.step,...pass.step);gl.drawArrays(gl.TRIANGLES,0,6);
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  this.cameraFrame=this.cameraFrameToken;this.cameraFrames=Math.min(2,this.cameraFrames+1);
  this.host.dataset.cameraHistory=String(this.cameraFrames);this.host.dataset.cameraBlur=width+'x'+height;
 }
 cancel(){this.waterLettering?.pause();this.rimOverflow?.pause();this.luminousParticles?.pause();this.waterSimulation?.pause();this.pointerContact=null;clearTimeout(this.overflowWake);this.overflowWake=0;this.host.dataset.overflow='paused';super.cancel();}
 setQuiet(value){super.setQuiet(value);if(value){clearTimeout(this.overflowWake);this.overflowWake=0;}}
 scheduleOverflow(){
  if(this.overflowWake||this.quiet||this.cameraVideo||!this.visible||document.hidden||this.forcedFallback||this.lost)return;
  // Ambient light needs only a measured 20fps; active water input stays fluid.
  this.host.dataset.animating='true';
  this.overflowWake=setTimeout(()=>{this.overflowWake=0;this.request();},50);
 }
 draw(now){
  clearTimeout(this.overflowWake);this.overflowWake=0;
  this.frame=0;if(!this.visible||document.hidden||this.forcedFallback||this.lost)return;
  const dt=this.last?Math.min(now-this.last,50):16;this.last=now;const blend=this.quiet?1:1-Math.exp(-dt/160);
  this.tilt=this.tilt.map((v,i)=>v+(this.pointer[i]-v)*blend);
  const target=this.cameraTarget||0;
  this.cameraAmount=(this.cameraAmount||0)+(target-(this.cameraAmount||0))*(this.quiet?1:1-Math.exp(-dt/300));
  const cameraSettled=Math.abs(this.cameraAmount-target)<.001;if(cameraSettled)this.cameraAmount=target;
  const invitationTarget=this.invitationTarget||0;
  this.invitationAmount=(this.invitationAmount||0)+(invitationTarget-(this.invitationAmount||0))*(this.quiet?1:1-Math.exp(-dt/650));
  const invitationSettled=Math.abs(this.invitationAmount-invitationTarget)<.001;if(invitationSettled)this.invitationAmount=invitationTarget;
  const settled=invitationSettled&&this.tilt.every((v,i)=>Math.abs(v-this.pointer[i])<.001)&&cameraSettled;if(settled)this.tilt=[...this.pointer];
  const rect=this.host.getBoundingClientRect(),limit=this.cameraVideo?320000:480000,dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(limit/Math.max(1,rect.width*rect.height)));
  const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  const pointer=this.pointerContact||[0,0];
  if(this.pointerContact)this.waterActiveUntil=now+6000;
  const active=!this.quiet&&(!!this.cameraVideo||now<(this.waterActiveUntil||0));
  const desired=[[...pointer,this.pointerContact?(this.cameraVideo ? .65 : 1):0,.120],[0,0,0,.105]];
  const contacts=desired.map((target,i)=>{
   const previous=this.waterContacts[i],level=target[2],strength=this.quiet?0:previous[2]+(level-previous[2])*(1-Math.exp(-dt/(level>previous[2]?100:650)));
   const position=level>0?previous.slice(0,2).map((v,j)=>previous[2]<.001?target[j]:v+(target[j]-v)*(1-Math.exp(-dt/60))):previous.slice(0,2);
   return [...position,strength<.0005?0:strength,target[3]];
  });this.waterContacts=contacts;
  this.waterSimulation.update(now,contacts,!!this.cameraVideo,this.quiet);
  this.luminousParticles?.update(now,this.waterSimulation.texture,this.waterSimulation.flowTexture,contacts,this.quiet);
  const letterWidth=1.52-(1.52-1.20)*(()=>{const t=Math.max(0,Math.min(1,(w-480)/280));return t*t*(3-2*t);})();
  this.waterLettering?.update(now,this.waterSimulation.texture,this.waterSimulation.flowTexture,this.luminousParticles?.wakeTargets[0].texture||this.waterSimulation.flowTexture,contacts,this.quiet,this.invitationAmount,letterWidth);
  this.rimOverflow.update(now,this.waterSimulation,this.quiet);
  this.host.dataset.waterSteps=String(this.waterSimulation.steps);
  if(this.reviewWater&&now-(this.lastMeasure||0)>500){
   const state=this.waterSimulation.measure();this.host.dataset.waterEnergy=state.energy.toExponential(3);this.host.dataset.waterPeak=state.peak.toFixed(4);this.host.dataset.waterVolume=state.volume.toFixed(6);
   const spill=this.rimOverflow.measure();
   this.host.dataset.rimActive=String(spill.active);this.host.dataset.rimPeak=spill.peak.toFixed(5);this.host.dataset.rimAngle=spill.angle.toFixed(1);this.host.dataset.rimSectors=spill.sectors.map(v=>v.toFixed(3)).join(',');this.host.dataset.rimRate=spill.rate.toExponential(3);this.host.dataset.sprayActive=String(spill.spray);this.host.dataset.sprayMax=String(this.maxSpray=Math.max(this.maxSpray||0,spill.spray));
   if(spill.peak>(this.peakDischarge||0)){this.peakDischarge=spill.peak;this.host.dataset.rimMax=spill.peak.toFixed(5);this.host.dataset.rimMaxAngle=spill.angle.toFixed(1);}
   const grains=this.luminousParticles?.measure(now,contacts);
   if(grains){this.host.dataset.rearCells=String(grains.rearLight);this.host.dataset.frontCells=String(grains.frontLight);this.host.dataset.wakeCells=String(grains.trailLight);this.host.dataset.contactCells=String(grains.localLight);this.host.dataset.particleChanged=String(grains.changed);this.host.dataset.particleLocalMotion=grains.near.toFixed(5);this.host.dataset.particleFarMotion=grains.far.toFixed(5);this.host.dataset.luminousCells=String(grains.luminous);this.host.dataset.meanEmission=grains.emission.toFixed(5);this.host.dataset.peakEmission=grains.peak.toFixed(4);}
   if(this.waterLettering&&this.invitationAmount>.001){const letters=this.waterLettering.measure();this.host.dataset.letterSpread=letters.maximum.toFixed(4);this.host.dataset.letterMean=letters.mean.toFixed(4);this.host.dataset.letterDisplaced=String(letters.displaced);}
   this.lastMeasure=now;
  }
  this.host.dataset.pressure=this.pointerContact?'cursor':this.cameraVideo?'ambient':'released';
  const gl=this.gl;
  const video=this.cameraVideo;
  if(video&&video.readyState>=2&&this.cameraFrameToken!==this.cameraFrame){
   // A separable GPU blur keeps the light continuous and preserves just two
   // softened frames for movement. All camera textures clear together on stop.
   this.softenCamera(video);
  }
  gl.viewport(0,0,w,h);gl.useProgram(this.program);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.cameraTexture);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.previousCameraTexture);
  gl.uniform2f(this.locations.uResolution,w,h);gl.uniform2f(this.locations.uPointer,...this.tilt);

  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.waterSimulation.texture);gl.uniform1i(this.locations.uWater,2);
  gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,this.rimOverflow.texture);gl.uniform1i(this.locations.uRim,5);
  const cameraAspect=video?.videoWidth?video.videoWidth/video.videoHeight:4/3;
  const projection=cameraProjection([[0,0],[1,0],[0,1]].map(q=>this.poolToScreen(q)),innerWidth/innerHeight,cameraAspect);
  // A 3% wider view, keeping the reflection's current centre in place.
  projection.basis=projection.basis.map(value=>value*1.03);
  gl.uniform2f(this.locations.uCameraOrigin,...projection.origin);gl.uniform4f(this.locations.uCameraBasis,...projection.basis);
  if(video)this.host.dataset.cameraProjection='viewport-masked';
  if(this.reviewWater&&video){this.host.dataset.cameraOrigin=projection.origin.map(v=>v.toFixed(4)).join(',');this.host.dataset.cameraBasis=projection.basis.map(v=>v.toFixed(4)).join(',');this.host.dataset.cameraRegion=projectedCameraUV([0,0],projection).map(v=>v.toFixed(4)).join(',');}
  gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.invitationTexture);gl.uniform1i(this.locations.uInvitation,7);gl.uniform1f(this.locations.uInvitationAmount,this.waterLettering?0:this.invitationAmount);
  gl.uniform1f(this.locations.uTime,this.quiet?2.5:now/1000);
  gl.uniform1i(this.locations.uCamera,0);gl.uniform1i(this.locations.uPreviousCamera,1);gl.uniform1f(this.locations.uCameraHistory,this.cameraFrames>1?1:0);
  gl.uniform1f(this.locations.uCameraAmount,video&&video.readyState>=2?this.cameraAmount:0);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(this.positionLocation);gl.vertexAttribPointer(this.positionLocation,2,gl.FLOAT,false,0,0);
  gl.drawArrays(gl.TRIANGLES,0,6);
  this.luminousParticles?.draw(w,h,this.waterSimulation.texture,contacts,this.tilt,this.quiet?2.5:now/1000);
  this.waterLettering?.draw(w,h,this.waterSimulation.texture,this.tilt,this.quiet?2.5:now/1000,this.invitationAmount,letterWidth);
  this.rimOverflow.draw(w,h,this.tilt);
  this.host.dispatchEvent(new Event('mirrorframe'));
  this.host.dataset.lettering=this.waterLettering?'submerged-particles':'refracted-mask';this.host.dataset.letterParticles=String(this.waterLettering?.count||0);
  this.host.dataset.ripple=active?'active':'still';
  this.host.dataset.overflow=this.quiet?'still':'drifting';this.host.dataset.spill='wave-driven-full-boundary';this.host.dataset.bioluminescence='advected-wake-flashes';
  if(!settled||active)this.request();else{this.last=0;this.host.dataset.animating='false';this.scheduleOverflow();}
 }
 destroy(){this.detachCamera();this.host.removeEventListener('pointermove',this.onWaterMove);this.host.removeEventListener('pointerleave',this.onWaterLeave);super.destroy();}
}
