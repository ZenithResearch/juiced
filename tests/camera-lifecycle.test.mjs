import test from 'node:test';
import assert from 'node:assert/strict';
import {CameraReflection} from '../src/art/camera-reflection.js';

class Element extends EventTarget{
 constructor(){super();this.dataset={};this.hidden=true;this.attributes={};this.textContent='';this.span={textContent:''};}
 setAttribute(key,value){this.attributes[key]=value;}
 querySelector(selector){return selector==='span'?this.span:selector==='[aria-hidden=true]'?this.span:null;}
}
function setup(getUserMedia){
 const button=new Element(),note=new Element(),controls=new Element(),power=new Element();controls.querySelector=selector=>selector==='button'?button:note;
 const page=new EventTarget();page.hidden=false;page.defaultView=new EventTarget();page.querySelector=selector=>selector==='#camera-power'?power:null;page.body={append:()=>{}};
 const renderer={ready:true,canvas:new EventTarget(),setInvitation(value){this.invitation=value;},attachCamera(video){this.attached=video;},detachCamera(){this.attached=null;}};
 const video={setAttribute(){},play:async()=>{},pause(){this.paused=true;},remove(){this.removed=true;}};
 const camera=new CameraReflection(renderer,controls,{mediaDevices:{getUserMedia},page,makeVideo:()=>video});
 return{camera,page,renderer,video,controls,note,power};
}
function source(){const track=new EventTarget();track.stopped=0;track.stop=()=>track.stopped++;return{track,stream:{getTracks:()=>[track]}};}
test('reflection is explicit, requests no audio and stops all tracks when hidden',async()=>{
 const local=source();let requests=0,constraints;
 const f=setup(async input=>{requests++;constraints=input;return local.stream;});
 assert.equal(requests,0);f.camera.invite();assert.equal(requests,0);
 await f.camera.start();assert.equal(requests,1);assert.equal(constraints.audio,false);assert.equal(f.controls.dataset.camera,'live');assert.equal(f.renderer.attached,f.video);
 f.page.hidden=true;f.page.dispatchEvent(new Event('visibilitychange'));
 assert.equal(local.track.stopped,1);assert.equal(f.renderer.attached,null);assert.equal(f.video.srcObject,null);assert.equal(f.video.removed,true);assert.equal(f.power.hidden,true);f.camera.destroy();
});
test('cancelling an outstanding camera request prevents a late stream from attaching',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve),f=setup(()=>pending),local=source();
 const start=f.camera.start();f.camera.stop();release(local.stream);await start;
 assert.equal(local.track.stopped,1);assert.ok(!f.renderer.attached);assert.equal(f.controls.dataset.camera,'off');f.camera.destroy();
});
test('permission errors stay recoverable without pretending the camera is live',async()=>{
 const f=setup(async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});});f.camera.invite();await f.camera.start();
 assert.equal(f.controls.dataset.camera,'off');assert.match(f.note.textContent,/wasn’t enabled/);assert.equal(f.power.hidden,true);f.camera.destroy();
});
