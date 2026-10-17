function fittedCircle(points){
 const count=points.length,mean=points.reduce((sum,p)=>sum.map((v,i)=>v+p[i]/count),[0,0]);
 let xx=0,xy=0,yy=0,xr=0,yr=0;
 for(const point of points){const x=point[0]-mean[0],y=point[1]-mean[1],r=x*x+y*y;xx+=x*x;xy+=x*y;yy+=y*y;xr+=x*r;yr+=y*r;}
 const determinant=xx*yy-xy*xy;if(determinant<1e-6)return null;
 const center=[mean[0]+(xr*yy-yr*xy)/(2*determinant),mean[1]+(yr*xx-xr*xy)/(2*determinant)];
 const radii=points.map(p=>Math.hypot(p[0]-center[0],p[1]-center[1]));
 const radius=radii.reduce((sum,r)=>sum+r/count,0);
 const error=Math.sqrt(radii.reduce((sum,r)=>sum+(r-radius)**2/count,0))/radius;
 return {center,radius,error};
}

// Recognize deliberate closed loops within the water, rather than
// counting crossings around the basin's centre or accumulating random wiggles.
export class CircleGesture {
 constructor(){this.reset();}
 reset(){this.points=[];this.turns=0;this.direction=0;this.lastTime=null;this.started=0;}
 sample(point,now){
  if(this.lastTime!==null&&now-this.lastTime>3500)this.reset();
  this.lastTime=now;
  const last=this.points.at(-1);
  if(last&&Math.hypot(point[0]-last[0],point[1]-last[1])<1.6)return false;
  if(!last)this.started=now;
  this.points.push([...point]);
  if(this.points.length>640)this.points=this.points.filter((_,i)=>i%2===0||i===this.points.length-1);
  if(now-this.started>15000){this.reset();this.points=[[...point]];this.lastTime=now;this.started=now;return false;}
  if(this.points.length<9)return false;
  // A straight approach must not contaminate the next three loops. Look for
  // a closed suffix of the stroke, so circling can begin after entering water.
  const candidates=[0];
  for(let i=2;i<this.points.length-8;i+=2)if(Math.hypot(point[0]-this.points[i][0],point[1]-this.points[i][1])<7)candidates.push(i);
  for(const start of candidates){
  const points=this.points.slice(start),fit=fittedCircle(points);
  if(!fit||fit.radius<7||fit.radius>600||fit.error>.38)continue;
  let sweep=0,travel=0,previous=null;
  for(const p of points){
   const angle=Math.atan2(p[1]-fit.center[1],p[0]-fit.center[0]);
   if(previous!==null){const delta=Math.atan2(Math.sin(angle-previous),Math.cos(angle-previous));sweep+=delta;travel+=Math.abs(delta);}
   previous=angle;
  }
  const first=points[0],closure=Math.hypot(point[0]-first[0],point[1]-first[1]);
  if(Math.abs(sweep)<Math.PI*2-.24||Math.abs(sweep)/Math.max(travel,.001)<.78||closure>fit.radius*.50)continue;
  const direction=Math.sign(sweep);
  this.turns=direction===this.direction?this.turns+1:1;this.direction=direction;
  this.points=[[...point]];this.started=now;
  return this.turns>=3;
  }
  return false;
 }
}

export class ReflectionDiscovery {
 constructor(renderer,camera,{page=renderer.host.ownerDocument,now=()=>performance.now()}={}){
  this.renderer=renderer;this.camera=camera;this.host=renderer.host;this.page=page;this.surface=page?.addEventListener?page:this.host;this.gesture=new CircleGesture();this.unlocked=false;this.lastNear=null;
  this.reveal=(gesture=false)=>{if(this.unlocked||!camera.available||!renderer.ready||renderer.lost||renderer.forcedFallback)return;this.unlocked=true;camera.invite({gesture});this.host.dataset.reflectionDiscovery='revealed';};
  this.reset=()=>{this.gesture.reset();this.lastNear=null;this.host.dataset.circleTurns='0';};
  this.onMove=e=>{
   if(e.pointerType!=='mouse'||page.hidden||this.unlocked||!renderer.ready||renderer.lost||renderer.forcedFallback)return;
   const time=now(),q=renderer.screenToPool(e.clientX,e.clientY);
   // Use the same water-space hit test as contact. Circling the rim or the
   // surrounding page cannot substitute for stirring inside the mirror.
   if(Math.hypot(...q)>.817){this.reset();return;}
   this.lastNear=time;
   const samples=e.getCoalescedEvents?.()||[];
   let complete=false;for(const sample of samples){const p=renderer.screenToPool(sample.clientX,sample.clientY);if(Math.hypot(...p)<.817)complete=this.gesture.sample([sample.clientX,sample.clientY],time)||complete;else this.reset();}
   complete=this.gesture.sample([e.clientX,e.clientY],time)||complete;this.host.dataset.circleTurns=String(this.gesture.turns);
   if(complete)this.reveal(true);
  };
  this.onKey=e=>{if(e.target===this.host&&(e.key==='Enter'||e.key===' ')){e.preventDefault();this.reveal();if(this.unlocked)camera.button.focus({preventScroll:true});}};
  this.host.dataset.reflectionDiscovery='waiting';this.reset();
  this.onHidden=()=>{if(page.hidden)this.reset();};page.addEventListener?.('visibilitychange',this.onHidden);
  this.surface.addEventListener('pointermove',this.onMove);this.host.addEventListener('keydown',this.onKey);
 }
 destroy(){this.surface.removeEventListener('pointermove',this.onMove);this.host.removeEventListener('keydown',this.onKey);this.page.removeEventListener?.('visibilitychange',this.onHidden);this.reset();}
}
