import {INVITATION} from './invitation-copy.js';
const stopTracks=stream=>stream?.getTracks().forEach(track=>track.stop());
const errorMessage=error=>({
 NotAllowedError:'Camera access wasn’t enabled. You can try again.',
 NotFoundError:'No camera found on this computer.',
 NotReadableError:'The camera couldn’t start. It may be in use.'
}[error?.name]||'Couldn’t start the camera. Please try again.');

export class CameraReflection {
 constructor(renderer,controls,{mediaDevices=typeof navigator==='object'?navigator.mediaDevices:null,page=document,makeVideo=()=>page.createElement('video'),disposeSource=()=>{}}={}){
  this.renderer=renderer;this.controls=controls;this.button=controls.querySelector('button');this.note=controls.querySelector('[role=status]');
  this.power=page.querySelector?.('#camera-power')||null;this.toast=page.querySelector?.('#camera-toast')||null;
  this.onPower=()=>this.stop();this.power?.addEventListener('click',this.onPower);
  this.mediaDevices=mediaDevices;this.page=page;this.makeVideo=makeVideo;this.disposeSource=disposeSource;
  this.stream=null;this.video=null;this.pending=false;this.invited=false;this.generation=0;
  this.available=!!(renderer.ready&&!renderer.forcedFallback&&mediaDevices?.getUserMedia);
  this.press=null;this.invitationArmed=false;
  this.deferInvitation=()=>{clearTimeout(this.invitationWake);this.invitationWake=setTimeout(()=>{this.invitationWake=0;this.invitationArmed=true;this.renderState();},350);};
  this.onInvitationMove=()=>{if(this.invited&&!this.stream&&!this.pending&&!this.invitationArmed)this.deferInvitation();};
  this.onPress=e=>{this.press={point:[e.clientX,e.clientY],moved:false,armed:this.invitationArmed};};
  this.onPressMove=e=>{if(this.press&&Math.hypot(e.clientX-this.press.point[0],e.clientY-this.press.point[1])>5)this.press.moved=true;};
  this.onClick=e=>{
   if(!this.stream&&!this.pending&&e.detail>0){
    const press=this.press;this.press=null;
    // A release from the discovery stroke is not a new camera invitation.
    // Let the luminous words form before accepting a fresh, still click.
    if(!press||!press.armed||press.moved||!this.invitationArmed)return;
   }
   this.stream||this.pending?this.stop():this.start();
  };
  this.button.addEventListener('pointerdown',this.onPress);this.button.addEventListener('pointermove',this.onPressMove);this.button.addEventListener('click',this.onClick);
  page.addEventListener('pointermove',this.onInvitationMove,true);
  this.onHidden=()=>{if(page.hidden&&(this.stream||this.pending))this.stop('Camera stopped while this page is hidden.');};
  this.onPageHide=()=>this.stop();this.onContextLoss=()=>this.stop('Camera stopped. The reflection is temporarily unavailable.');
  this.onContextRestore=()=>this.renderState();
  page.addEventListener('visibilitychange',this.onHidden);page.defaultView?.addEventListener('pagehide',this.onPageHide);
  renderer.canvas.addEventListener('webglcontextlost',this.onContextLoss);renderer.canvas.addEventListener('webglcontextrestored',this.onContextRestore);
  this.renderState();
  if(!this.available)this.note.textContent='Camera reflection isn’t available in this browser.';
 }
 renderState(message){
  const live=!!this.stream&&!this.pending;
  this.renderer.setInvitation?.(this.invited&&!live&&!this.pending);
  this.controls.hidden=!this.invited||this.pending||live;
  if(this.power){this.power.hidden=!(live||this.pending);this.power.textContent=this.pending?'Cancel camera request':'Camera on ×';this.power.setAttribute('aria-label',this.pending?'Cancel camera request':'Turn camera off');this.power.setAttribute('title',this.pending?'Cancel camera request':'Turn camera off');}
  this.controls.dataset.invitation=this.invited?'revealed':'hidden';
  this.controls.dataset.camera=this.pending?'requesting':live?'live':'off';
  this.controls.dataset.invitationReady=String(this.invitationArmed);
  this.button.disabled=!this.available||!!this.renderer.lost||!this.renderer.ready||this.renderer.forcedFallback||(this.invited&&!live&&!this.pending&&!this.invitationArmed);
  this.button.setAttribute('aria-pressed',String(live));
  this.button.querySelector('span').textContent=INVITATION.label;
  this.button.setAttribute('aria-label',INVITATION.label+' (use your camera)');
  const icon=this.button.querySelector('[aria-hidden=true]');if(icon)icon.textContent=live||this.pending?'×':'↗';
  if(message)this.note.textContent=message;
 }
 invite({gesture=false}={}){
  if(!this.available||this.stream||this.pending)return;
  if(!this.invited){this.invitationArmed=!gesture;if(gesture)this.deferInvitation();}
  this.invited=true;this.renderState('Use your camera. Processed here; nothing recorded.');
 }
 async start(){
  if(this.pending||this.stream)return;
  if(!this.available||!this.renderer.ready||this.renderer.lost||this.renderer.forcedFallback||this.page.hidden)return;
  const request=++this.generation;this.pending=true;this.invited=true;
  this.renderState('Allow your camera to appear in the mirror. No audio or recording.');
  try{
   const stream=await this.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:24}}});
   if(request!==this.generation||this.page.hidden){stopTracks(stream);this.disposeSource();return;}
   this.stream=stream;
   const video=this.makeVideo();this.video=video;
   video.muted=true;video.playsInline=true;video.className='camera-source';video.setAttribute('aria-hidden','true');video.srcObject=stream;
   this.page.body.append(video);
   stream.getTracks().forEach(track=>track.addEventListener('ended',()=>{if(this.stream===stream)this.stop('Camera access ended. You can turn it on again.');}));
   await video.play();
   if(request!==this.generation||this.page.hidden){stopTracks(stream);return;}
   this.renderer.attachCamera(video);this.pending=false;
   this.renderState('Your reflection, only here. Nothing recorded.');
   if(this.toast){clearTimeout(this.noticeWake);this.toast.hidden=false;this.noticeWake=setTimeout(()=>{this.toast.hidden=true;this.noticeWake=0;},2800);}
  }catch(error){
   if(request!==this.generation)return;
   this.stop(errorMessage(error));
  }
 }
 stop(message='Camera off. Processed here; nothing recorded.'){
  clearTimeout(this.noticeWake);this.noticeWake=0;if(this.toast)this.toast.hidden=true;
  clearTimeout(this.invitationWake);this.invitationWake=0;if(this.invited)this.invitationArmed=true;this.press=null;
  ++this.generation;this.pending=false;
  const stream=this.stream;this.stream=null;
  this.renderer.detachCamera();stopTracks(stream);
  if(this.video){this.video.pause();this.video.srcObject=null;this.video.remove();this.video=null;}
  this.disposeSource();this.renderState(message);
 }
 destroy(){
  this.stop();this.button.removeEventListener('click',this.onClick);this.button.removeEventListener('pointerdown',this.onPress);this.button.removeEventListener('pointermove',this.onPressMove);
  this.power?.removeEventListener('click',this.onPower);
  this.page.removeEventListener('pointermove',this.onInvitationMove,true);
  this.page.removeEventListener('visibilitychange',this.onHidden);this.page.defaultView?.removeEventListener('pagehide',this.onPageHide);
  this.renderer.canvas.removeEventListener('webglcontextlost',this.onContextLoss);this.renderer.canvas.removeEventListener('webglcontextrestored',this.onContextRestore);
 }
}

