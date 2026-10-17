import './hero-contrast.js';
import {OpticalRenderer} from './optical-renderer.js';
import {GlyphRenderer} from './glyph-renderer.js';
import {CameraReflection} from './camera-reflection.js';
import {ReflectionDiscovery} from './circle-gesture.js';

// The accepted identity, with explicit lifecycle and no review/query-mode branches.
export function mountIdentity(page=document){
 const host=page.querySelector('.lens-art'),glyphHost=page.querySelector('[data-glyph]');
 if(!host||!glyphHost)return ()=>{};
 const art=new OpticalRenderer(host),glyph=new GlyphRenderer(glyphHost,{small:true});
 const camera=new CameraReflection(art,host.querySelector('.camera-controls'),{page});
 const discovery=new ReflectionDiscovery(art,camera,{page});
 const win=page.defaultView,motion=win.matchMedia('(prefers-reduced-motion: reduce)');
 const syncMotion=()=>[art,glyph].forEach(renderer=>renderer.setQuiet(motion.matches));
 motion.addEventListener('change',syncMotion);syncMotion();
 let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;motion.removeEventListener('change',syncMotion);win.removeEventListener('pagehide',onPageHide);discovery.destroy();camera.destroy();art.destroy();glyph.destroy();};
 const onPageHide=event=>{camera.stop();if(!event.persisted)dispose();};
 win.addEventListener('pagehide',onPageHide);
 return dispose;
}
if(typeof document==='object')mountIdentity(document);
