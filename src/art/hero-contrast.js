// The text keeps its real font and DOM. A small, ephemeral black/white ink map
// supplies readable small copy and a gently animated, dithered headline.
const hero=document.querySelector('.hero');
const mirror=hero?.querySelector('.lens-art');
const targets=hero?[hero.querySelector('h1'),hero.querySelector('.hero-intro>p:first-child')]:[];
if(hero&&mirror&&targets.every(Boolean)){
 const field=document.createElement('canvas');
 const context=field.getContext('2d',{willReadFrequently:true});
 const source=mirror.querySelector('canvas');
 const linear=Array.from({length:256},(_,i)=>{const c=i/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
 // At this luminance, pure black and pure white have equal contrast.
 const threshold=Math.sqrt(.05*1.05)-.05;
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const ranks=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
 const grain=(x,y,t)=>{
  let h=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(t,2246822519);
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967295;
 };
 let bounds=null,geometry=null,last=0,dirty=true,fallback=null,disposed=false;
 let frames=0,total=0;
 function layout(){
  bounds=hero.getBoundingClientRect();
  const r=mirror.getBoundingClientRect();
  const scale=Math.min(1/4,320/Math.max(1,bounds.width),240/Math.max(1,bounds.height));
  field.width=Math.max(1,Math.ceil(bounds.width*scale));
  field.height=Math.max(1,Math.ceil(bounds.height*scale));
  geometry={x:r.left-bounds.left,y:r.top-bounds.top,width:r.width,height:r.height};
  hero.style.setProperty('--ink-width',`${bounds.width}px`);
  hero.style.setProperty('--ink-height',`${bounds.height}px`);
  for(const target of targets){
   const t=target.getBoundingClientRect();
   target.style.setProperty('--ink-x',`${bounds.left-t.left}px`);
   target.style.setProperty('--ink-y',`${bounds.top-t.top}px`);
  }
  dirty=false;
 }
 function paint(now,fromFrame=false){
  if(disposed||document.hidden||!context||(!dirty&&now-last<125))return;
  const webgl=mirror.dataset.renderer==='webgl';
  if(webgl&&!fromFrame)return;
  const image=webgl?source:fallback;
  if(!image)return;
  const area=hero.getBoundingClientRect();
  if(area.width<1||area.height<1)return;
  const start=performance.now();
  try{
   if(dirty||!bounds)layout();
   const sx=field.width/bounds.width,sy=field.height/bounds.height;
   context.fillStyle='#eeeae0';context.fillRect(0,0,field.width,field.height);
   context.drawImage(image,geometry.x*sx,geometry.y*sy,geometry.width*sx,geometry.height*sy);
   const pixels=context.getImageData(0,0,field.width,field.height);
   const noisy=context.createImageData(field.width,field.height);
   const quiet=motion.matches||mirror.dataset.quiet==='true'||!webgl;
   const time=quiet?0:now/1600,phase=Math.floor(time),fraction=time-phase;
   const blend=fraction*fraction*(3-2*fraction);
   // One regular four-CSS-pixel lattice: each cell has a single ink value.
   // Smooth the source first so reflected glints cannot tear the letters apart.
   const luminance=new Float32Array(field.width*field.height);
   for(let p=0;p<luminance.length;p++){
    const k=p*4;
    luminance[p]=linear[pixels.data[k]]*.2126+linear[pixels.data[k+1]]*.7152+linear[pixels.data[k+2]]*.0722;
   }
   let light=0,grainLight=0,extraLight=0,pattern=2166136261;
   for(let i=0;i<pixels.data.length;i+=4){
    const luma=linear[pixels.data[i]]*.2126+linear[pixels.data[i+1]]*.7152+linear[pixels.data[i+2]]*.0722;
    const ink=luma<threshold?255:0;
    pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=ink;pixels.data[i+3]=255;
    if(ink)light++;
    // Ordered cells follow the water's contour. Only the transition drifts;
    // the dark-water core stays clear, rather than becoming random static.
    const n=i/4,x=n%field.width,y=Math.floor(n/field.width);
    let smooth=0,weight=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const px=Math.max(0,Math.min(field.width-1,x+dx));
     const py=Math.max(0,Math.min(field.height-1,y+dy));
     const w=(dx===0?2:1)*(dy===0?2:1);
     smooth+=luminance[py*field.width+px]*w;weight+=w;
    }
    smooth/=weight;
    let headline=0;
    if(smooth<.32){
     const a=grain(x,y,phase),b=grain(x,y,phase+1),moving=a+(b-a)*blend;
     const q=Math.max(0,Math.min(1,(smooth-.15)/.17));
     const coverage=1-q*q*(3-2*q);
     const dither=(ranks[(y&3)*4+(x&3)]+.5)/16*.8+moving*.2;
     if(dither<coverage){
      headline=250;grainLight++;
      if(!ink)extraLight++;
     }
    }
    noisy.data[i]=noisy.data[i+1]=noisy.data[i+2]=headline;noisy.data[i+3]=255;
    pattern=Math.imul(pattern^headline,16777619)>>>0;
   }
   context.putImageData(pixels,0,0);
   hero.style.setProperty('--ink-map',`url("${field.toDataURL('image/png')}")`);
   context.putImageData(noisy,0,0);
   hero.style.setProperty('--ink-pixel-map',`url("${field.toDataURL('image/png')}")`);
   hero.dataset.inkMotion=quiet?'still':'drifting';
   hero.dataset.inkGrainLight=String(grainLight);
   hero.dataset.inkExtraLight=String(extraLight);
   hero.dataset.inkPattern=pattern.toString(16);
   hero.dataset.contrast='adaptive';
   hero.dataset.contrastSource=webgl?'rendered-mirror':'svg-fallback';
   hero.dataset.contrastLight=String(light);
   hero.dataset.contrastPixels=String(field.width*field.height);
   frames++;total+=performance.now()-start;
   hero.dataset.contrastMeanMs=(total/frames).toFixed(2);
   last=now;
  }catch{
   hero.dataset.contrast='fallback';
   hero.style.removeProperty('--ink-map');hero.style.removeProperty('--ink-pixel-map');
  }
 }
 const onFrame=()=>paint(performance.now(),true);
 const onResize=()=>{dirty=true;if(mirror.dataset.renderer!=='webgl')paint(performance.now());};
 const resize=new ResizeObserver(onResize);resize.observe(hero);resize.observe(mirror);
 const mode=new MutationObserver(()=>{dirty=true;if(mirror.dataset.renderer!=='webgl')paint(performance.now());});
 mode.observe(mirror,{attributes:true,attributeFilter:['data-renderer']});
 mirror.addEventListener('mirrorframe',onFrame);
 document.fonts?.ready.then(()=>{if(!disposed)dirty=true;});
 const svg=mirror.querySelector('svg');
 let fallbackURL=null;
 if(svg){
  fallbackURL=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
  const image=new Image();
  image.onload=()=>{fallback=image;URL.revokeObjectURL(fallbackURL);fallbackURL=null;if(!disposed)paint(performance.now());};
  image.onerror=()=>{if(fallbackURL)URL.revokeObjectURL(fallbackURL);fallbackURL=null;};
  image.src=fallbackURL;
 }
 window.addEventListener('pagehide',event=>{
  if(event.persisted)return;
  disposed=true;resize.disconnect();mode.disconnect();mirror.removeEventListener('mirrorframe',onFrame);
  if(fallbackURL)URL.revokeObjectURL(fallbackURL);
  hero.style.removeProperty('--ink-map');hero.style.removeProperty('--ink-pixel-map');
 });
}
