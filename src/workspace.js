import {containDialogFocus} from './ui/dialog.js';
import {creatorSocialChannelsFormValue,bindCreatorSocialChannels} from './creator-about-view.js';
import {audienceCharacters,saveAudienceCharacter,saveVoicesSearch,prepareVoicesSearch,voiceSearchMinimumWords,voiceDescriptionWordCount,getCreatorProfile,getCreatorStudio,newCreativeCharacter,saveCreatorProfile,creatorSteps,creatorProfileExport} from './model.js';
import {voicesView,characterList,audienceEditor} from './voices-view.js';
import {creatorView} from './creator-view.js';
import {bindCreatorCommunityTags,creatorCommunityFormDetails} from './creator-community-view.js';
import {emptyState,safeURL,removeAsset,addInvitationDrafts,getBrandQuestionnaire,saveBrandQuestionnaire,brandQuestionnaireSections,brandQuestionnaireProgress,prepareBrandRoundtableHandoff,activeBrandQuestion,brandHandoffIsCurrent} from './model.js';
import {brandPieces,pieceState,connectPiece,capturePath,worksheetPath} from './brand-pieces.js';
import * as store from './store.js';
import {dashboardView,assetDescriptions} from './dashboard-view.js';
import {setCurrentPiece} from './dashboard-model.js';
import {questionnaireView} from './questionnaire-view.js';

const releaseDialogFocus=containDialogFocus(document);
window.addEventListener('pagehide',event=>{if(!event.persisted)releaseDialogFocus();});
const main=document.querySelector('main'),status=document.querySelector('#save-status');
const dialog=document.querySelector('#asset-dialog'),assetForm=document.querySelector('#asset-form');
let state=emptyState(),search='',storageReady=true,objectURLs=[],queue=Promise.resolve();
const uploadDialog=document.querySelector('#upload-dialog'),uploadStatus=document.querySelector('#upload-status');
const teamDialog=document.querySelector('#team-dialog'),teamInviteStatus=document.querySelector('#team-invite-status');
const questionnaireDialog=document.querySelector('#questionnaire-dialog'),questionnaireSaveStatus=document.querySelector('#questionnaire-save-status');
const matchingDialog=document.querySelector('#matching-dialog');
let questionnaireSession=null,questionnaireDirty=false,questionnaireTimer=null,questionnaireRevision=0,questionnaireClosing=false,questionnaireOpener='team';
let uploadOpener=null;
let renderVersion=0,voiceDraftTimer=null;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>crypto.randomUUID();
const message=text=>{if(questionnaireDialog.open){questionnaireSaveStatus.textContent=text;status.textContent='';}else if(teamDialog.open){teamInviteStatus.textContent=text;status.textContent='';}else if(uploadDialog.open){uploadStatus.textContent=text;status.textContent='';}else status.textContent=text;};
const icon=a=>a.kind==='link'?'↗':a.type?.startsWith('image/')?'◒':'≡';
const path=a=>a.capturePath||capturePath(a.originalName||a.name);
const serialize=task=>{const result=queue.then(task);queue=result.catch(()=>{});return result;};
const link=(href,label,primary=false)=>`<a href="${href}" class="${primary?'primary':'text-button'}">${label} <span aria-hidden="true">↗</span></a>`;
const heading=(kicker,title,description)=>`<header class="page-heading"><div><p class="eyebrow">${kicker}</p><h1 tabindex="-1">${title}</h1><p class="page-intro">${description}</p></div></header>`;
function guard(action){return event=>{event?.preventDefault();Promise.resolve().then(()=>action(event)).catch(error=>{console.error(error);message('This change could not be saved. Your previous material is still here.');});};}
async function persist(next,note='Saved on this browser.'){
 if(storageReady)await serialize(()=>store.save(next));
 state=next;message(storageReady?note:'Kept for this visit. Browser storage is unavailable.');
 syncBrandName();
}
function syncBrandName(){const target=document.querySelector('#brand-name');target.textContent=state.brand.name||'';target.hidden=!state.brand.name||location.hash.startsWith('#creator');}
function captureArea(){
 return `<section class="capture-entry" aria-label="Bring existing brand material"><label class="dropzone" id="dropzone"><span class="drop-mark" aria-hidden="true">＋</span><span><strong>Upload files</strong><small>Drop files or folders here, or browse.</small></span><span class="upload-link">Browse files ↗</span><input id="file-input" type="file" multiple class="file-input" aria-label="Add brand files"></label><details class="more-input"><summary>Add a link or folder</summary><form id="link-form" class="link-form"><div><input name="url" type="url" required placeholder="A website, Drive, Figma or folder link" aria-label="Link URL"><button type="submit" class="secondary">Add link ↗</button></div></form><label class="folder-input">Import a folder<input id="folder-input" type="file" webkitdirectory multiple aria-label="Import a brand folder"></label><p class="quiet-note">Saved on this browser. Up to 25 MB per file.</p></details></section>`;
}
function world(){return dashboardView(state);}
function captureCards(){
 const items=state.assets.filter(a=>a.name.toLowerCase().includes(search.toLowerCase()));
 return items.length?items.map(a=>`<button type="button" class="asset-card" data-asset="${a.id}"><span class="asset-cover ${a.kind==='link'?'link-cover':''}"><span>${icon(a)}</span><small>${a.kind==='link'?'LINK':escape((a.originalName||a.name).split('.').pop().toUpperCase().slice(0,6))}</small></span><span class="asset-title">${escape(a.name)}</span><span class="asset-meta">${escape(path(a))}</span></button>`).join(''):`<div class="empty-library"><h2>${state.assets.length?'No results.':'No files or links added.'}</h2><p>${state.assets.length?'Try another search.':'Add files or links to keep them here.'}</p></div>`;
}
function capture(){
 return `${'<a class="text-button back-link" href="#world">← Back</a>'+heading('','Files & links','Upload files, import folders or save links.')}${'<button type="button" class="primary" data-open-upload="library">Add files or links <span aria-hidden="true">＋</span></button>'}<div class="library-toolbar"><p class="quiet-note">${state.assets.length} ${state.assets.length===1?'item':'items'}</p><label class="search"><span class="sr-only">Search files and links</span><input id="asset-search" type="search" placeholder="Search…" value="${escape(search)}"></label></div><div class="asset-grid" id="asset-grid">${captureCards()}</div>`;
}
function pieceView(piece){
 const saved=pieceState(state,piece.id),connected=saved.assetIds.filter(id=>state.assets.some(a=>a.id===id)),collection=piece.kind==='collection';
 const currentOptions=state.assets.map(a=>`<option value="${a.id}" ${saved.currentAssetId===a.id?'selected':''}>${escape(a.name)}</option>`).join('');
 const installed=piece.worksheets.filter(w=>worksheetPath(w.href));
 return `<a class="text-button back-link" href="#world">← Back</a>${heading('',piece.title,assetDescriptions[piece.id])}${piece.id==='characters'?characterList(state):''}<div class="piece-detail-grid"><section class="piece-outline"><span class="outline-mark" aria-hidden="true">${piece.id==='characters'?'◐':'✳'}</span><h2>What belongs here</h2><ul>${piece.contains.map(s=>`<li>${s}</li>`).join('')}</ul><p class="quiet-note">${collection?'Select the reusable work your team can build with.':connected.length?'Files linked to this asset.':'Add a file or link, then select it as the current asset.'}</p><div data-worksheet-host="${piece.id}">${installed.map(w=>link(worksheetPath(w.href),escape(w.title))).join('')}</div>${collection?'':`<button type="button" class="app-button" data-open-questionnaire="piece" data-questionnaire-start="${piece.id}">Answer brand questions</button>`}</section><section class="connect-material"><p class="eyebrow"></p><h2>${collection?'Selected assets':'Files & references'}</h2><form id="connect-form" data-piece="${piece.id}">${state.assets.length&&!collection?`<label class="current-asset-picker">Current ${piece.title.toLowerCase()}<select name="currentAsset"><option value="">Missing — no current asset</option>${currentOptions}</select></label><p class="quiet-note">Choose the file or link to use for this asset. References are optional.</p>`:''}<div class="asset-selection">${state.assets.length?state.assets.map(a=>`<label><input type="checkbox" name="assets" value="${a.id}" ${connected.includes(a.id)?'checked':''}><span>${escape(a.name)}<small>${escape(path(a))}</small></span></label>`).join(''):`<p>No files added. Upload a file or add a link to use here.</p>`}</div>${state.assets.length?'<button class="app-button app-button-primary" type="submit">Save</button>':'<button type="button" class="primary" data-open-upload="piece">Add files or links <span aria-hidden="true">＋</span></button>'}</form><div class="creative-help"><p>Creative support</p><small>${piece.roles.join(' · ')}</small>${link('#consultation','Find creative support')}</div></section></div>`;
}
function network(){return voicesView(state);}
function consultation(){
 const interested=state.world?.consultation?.interested;
 return `<a class="text-button back-link" href="#world">← Back</a>${heading('','Creative support','Start with a free 30-minute conversation about your brand.')}<div class="conversation-panel"><span aria-hidden="true">↔</span><div><h2>A shared starting point.</h2><p>A conversation about what makes the brand yours, the people in its world, and the material that will help it grow.</p><p>Creative directors, writers, designers or studio teams can help shape the pieces with you.</p><button type="button" class="primary" id="consultation-interest">${interested?'Added to your next steps ✓':'Keep this as my next step ↗'}</button><p class="quiet-note">${interested?'Interest saved locally. ':''}Scheduling is not connected yet.</p></div></div>`;
}
function render(focus=true){
 saveVoiceDescriptionDraft().catch(error=>message('This draft could not be saved.'));
 objectURLs.forEach(url=>URL.revokeObjectURL(url));objectURLs=[];renderVersion++;
 status.textContent='';
 let route=location.hash.slice(1)||'world';
 if(['library','foundation','campaign','collaborators','handoff'].includes(route))route=route==='library'?'capture':'world';
 const piece=route.startsWith('piece/')?brandPieces.find(p=>p.id===route.slice(6)):null;
 const url=new URL(location.href);if(url.searchParams.has('view')){url.searchParams.delete('view');history.replaceState(null,'',url);}
 const view=piece?()=>pieceView(piece):({world,capture,network,consultation,creator:()=>creatorView(state),'creator/preview':()=>creatorView(state,true)}[route]||world);
 main.innerHTML=view();syncBrandName();
 document.querySelectorAll('[data-route]').forEach(a=>{if(a.dataset.route===(piece?'world':route))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 bind();loadBrandMark(renderVersion);if(focus){main.querySelector('h1')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
function bindCards(){main.querySelectorAll('[data-asset]').forEach(button=>button.addEventListener('click',guard(()=>openAsset(button.dataset.asset))));}
async function acceptFiles(list){
 const files=Array.from(list||[]);if(!files.length)return;
 if(!storageReady){message('File storage is unavailable in this browser.');return;}
 const valid=files.filter(file=>file.size<=25*1024*1024);if(!valid.length){message('Choose files smaller than 25 MB each.');return;}
 const pairs=valid.map(file=>[id(),file]);
 await serialize(async()=>{const added=pairs.map(([id,file])=>({id,name:file.name,originalName:file.name,capturePath:capturePath(file.webkitRelativePath||file.name),type:file.type,size:file.size,kind:'file',collection:'Capture'}));const next={...state,assets:[...state.assets,...added]};await store.addFiles(next,pairs);state=next;});
 render(false);if(uploadDialog.open)recordUploads(valid.map(file=>file.name));message(`${valid.length} ${valid.length===1?'file':'files'} added.${valid.length<files.length?' Files over 25 MB were skipped.':''}`);return pairs.map(([id])=>id);
}
async function droppedFiles(transfer){
 const walk=async(entry,prefix='')=>{
  if(entry.isFile)return [await new Promise((resolve,reject)=>entry.file(file=>resolve({file,relative:prefix+file.name}),reject))];
  if(!entry.isDirectory)return [];
  const reader=entry.createReader();let all=[],batch;
  do{batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));all.push(...batch);}while(batch.length);
  const nested=await Promise.all(all.map(item=>walk(item,prefix+entry.name+'/')));return nested.flat();
 };
 const entries=Array.from(transfer.items||[]).map(item=>item.webkitGetAsEntry?.()).filter(Boolean);
 if(!entries.length)return acceptFiles(transfer.files);
 const groups=await Promise.all(entries.map(entry=>walk(entry)));
 const material=groups.flat().map(({file,relative})=>{Object.defineProperty(file,'webkitRelativePath',{value:relative});return file;});
 return acceptFiles(material);
}
function openUpload(button){
 uploadOpener=button.dataset.openUpload;
 uploadStatus.textContent='';
 const receipts=document.querySelector('#upload-receipts');receipts.replaceChildren();receipts.hidden=true;
 uploadDialog.showModal();document.documentElement.classList.add('upload-open');
}
function recordUploads(names){
 const receipts=document.querySelector('#upload-receipts');
 for(const name of names){const item=document.createElement('li');item.textContent=name;receipts.append(item);}
 receipts.hidden=!receipts.childElementCount;
}
function bindCapture(root){
 for(const key of ['file-input','folder-input'])root.querySelector('#'+key)?.addEventListener('change',guard(async event=>{
  const input=event.target;try{await acceptFiles(input.files);}finally{input.value='';}
 }));
 const zone=root.querySelector('#dropzone');
 if(zone){
  for(const key of ['dragenter','dragover'])zone.addEventListener(key,event=>{event.preventDefault();zone.classList.add('drag-over');});
  zone.addEventListener('dragleave',event=>{if(!zone.contains(event.relatedTarget))zone.classList.remove('drag-over');});
  zone.addEventListener('drop',guard(event=>{zone.classList.remove('drag-over');return droppedFiles(event.dataTransfer);}));
 }
 root.querySelector('#link-form')?.addEventListener('submit',guard(async event=>{
  const input=event.target.elements.url,url=safeURL(input.value);
  if(!url){input.setCustomValidity('Use an http or https link without embedded credentials.');input.reportValidity();return;}
  const nextId=id(),name=new URL(url).hostname+new URL(url).pathname.replace(/\/$/,'');
  await persist({...state,assets:[...state.assets,{id:nextId,kind:'link',url,name,capturePath:'capture/links/'+nextId,collection:'Capture'}]});
  input.value='';render(false);recordUploads([name]);message('Link added.');
 }));
 root.querySelector('[name=url]')?.addEventListener('input',event=>event.target.setCustomValidity(''));
}
function renderInvitationDrafts(){
 const drafts=state.world?.invitationDrafts||[];
 document.querySelector('#team-invitation-drafts').innerHTML=drafts.length?`<h3>Invitation drafts</h3><ul class="invitation-draft-list">${drafts.map(draft=>`<li><span>${escape(draft.email)}</span><small>Draft · not sent</small></li>`).join('')}</ul>`:'';
}
function openTeamInvites(){
 teamInviteStatus.textContent='';renderInvitationDrafts();teamDialog.showModal();document.documentElement.classList.add('upload-open');
}
function updateQuestionnaireProgress(){
 if(!questionnaireSession)return;
 const progress=brandQuestionnaireProgress(questionnaireSession);
 document.querySelector('#questionnaire-progress-label').textContent=`${progress.answered} of ${progress.total} fragments shared`;
 document.querySelector('#questionnaire-progress').value=progress.answered;document.querySelector('#questionnaire-progress').max=progress.total;
 document.querySelector('#questionnaire-download').hidden=questionnaireDirty||!brandHandoffIsCurrent(state.world?.brandRoundtableHandoff,questionnaireSession);
 if(questionnaireSession.step==='review')document.querySelector('#questionnaire-next').disabled=!progress.answered&&!questionnaireSession.sourceIds.length&&!questionnaireSession.earlier.some(old=>Object.values(old.answers||{}).some(value=>String(value).trim()));else document.querySelector('#questionnaire-next').disabled=false;
 for(const section of progress.sections){const target=document.querySelector(`[data-section-progress="${section.id}"]`);if(target)target.textContent=`${section.answered} / ${section.total} shared`;}
}
function renderQuestionnaire(focus=false){
 document.querySelector('#questionnaire-body').innerHTML=questionnaireView(questionnaireSession,state.assets,state.world?.brandRoundtableHandoff);
 const index=brandQuestionnaireSections.findIndex(section=>section.id===questionnaireSession.step),review=questionnaireSession.step==='review';
 document.querySelector('#questionnaire-back').hidden=questionnaireSession.step==='materials';
 document.querySelector('#questionnaire-next').textContent=review?'Prepare roundtable handoff':questionnaireSession.step==='materials'?'Continue to questions':index===brandQuestionnaireSections.length-1&&activeBrandQuestion(questionnaireSession).id===brandQuestionnaireSections.at(-1).questions.at(-1).id?'Gather the threads':'Continue';
 document.querySelector('#questionnaire-save-close').hidden=review;
 updateQuestionnaireProgress();
 if(focus)document.querySelector('#questionnaire-section-title').focus({preventScroll:true});
 document.querySelector('#questionnaire-body').scrollTop=0;
}
function openQuestionnaire(button){
 questionnaireOpener=button.dataset.openQuestionnaire;
 questionnaireSession=getBrandQuestionnaire(state);if(button.dataset.questionnaireStart){questionnaireSession.step=button.dataset.questionnaireStart;questionnaireSession.activeQuestion=brandQuestionnaireSections.find(section=>section.id===questionnaireSession.step).questions[0].id;}questionnaireDirty=false;questionnaireRevision++;
 questionnaireSaveStatus.textContent=state.world?.brandQuestionnaire?(storageReady?'Draft saved on this browser.':'Kept for this visit.'):'You can save and return at any time.';
 renderQuestionnaire();questionnaireDialog.showModal();document.documentElement.classList.add('upload-open');
}
async function saveQuestionnaireDraft(){
 clearTimeout(questionnaireTimer);questionnaireTimer=null;
 if(!questionnaireDirty)return true;
 const snapshot={...questionnaireSession,answers:{...questionnaireSession.answers},origins:{...questionnaireSession.origins},sourceIds:[...questionnaireSession.sourceIds]},revision=questionnaireRevision;
 questionnaireSaveStatus.textContent='Saving…';
 try{
  await serialize(async()=>{const next=saveBrandQuestionnaire(state,snapshot);if(storageReady)await store.save(next);state=next;});
  if(revision===questionnaireRevision){questionnaireDirty=false;questionnaireSaveStatus.textContent=storageReady?'Draft saved on this browser.':'Kept for this visit. Browser storage is unavailable.';}
  updateQuestionnaireProgress();return true;
 }catch(error){console.error(error);questionnaireSaveStatus.textContent='Your draft could not be saved. Keep this window open and try again.';return false;}
}
function scheduleQuestionnaireSave(){
 questionnaireDirty=true;questionnaireRevision++;clearTimeout(questionnaireTimer);
 questionnaireSaveStatus.textContent='Saving…';questionnaireTimer=setTimeout(()=>saveQuestionnaireDraft(),450);
}
function changeQuestionnaireStep(step,questionId){
 if(!brandQuestionnaireSections.some(section=>section.id===step)&&!['materials','review'].includes(step))return;
 questionnaireSession.step=step;const section=brandQuestionnaireSections.find(section=>section.id===step);if(section)questionnaireSession.activeQuestion=questionId||section.questions[0].id;scheduleQuestionnaireSave();renderQuestionnaire(true);
}
async function closeQuestionnaire(){
 if(questionnaireClosing)return;
 questionnaireClosing=true;
 try{while(questionnaireDirty){if(!await saveQuestionnaireDraft())return;}questionnaireDialog.close();}
 finally{questionnaireClosing=false;}
}
function showMatchingChoices(profile=false){
 document.querySelector('#matching-choices').hidden=profile;
 document.querySelector('#matching-profile').hidden=!profile;
 document.querySelector('#matching-title').textContent=profile?'Connect Rolodex':'Find your people.';
 document.querySelector('#matching-intro').textContent=profile?'Begin with you.':'Start with you or your brand. No finished brand assets needed.';
}
function openMatching(){showMatchingChoices();matchingDialog.showModal();document.documentElement.classList.add('upload-open');}
document.querySelector('#matching-rolodex').addEventListener('click',()=>{showMatchingChoices(true);document.querySelector('#matching-title').focus({preventScroll:true});});
document.querySelector('#matching-back').addEventListener('click',()=>{showMatchingChoices();document.querySelector('#matching-rolodex').focus({preventScroll:true});});
document.querySelector('#close-matching').addEventListener('click',()=>matchingDialog.close());
document.querySelector('#matching-brand').addEventListener('click',event=>{matchingDialog.close();openQuestionnaire(event.currentTarget);});
matchingDialog.addEventListener('close',()=>{if(!questionnaireDialog.open){document.documentElement.classList.remove('upload-open');main.querySelector('[data-find-teammates]')?.focus({preventScroll:true});}});
function bind(){
 bindVoiceFlows();
 main.querySelectorAll('[data-find-teammates]').forEach(button=>button.addEventListener('click',openMatching));
 main.querySelectorAll('[data-open-questionnaire]').forEach(button=>button.addEventListener('click',()=>{if(main.querySelector('#voices-search-form'))flowAction(async()=>{await persist(saveVoicesSearch(state,voiceSearchPatch()));openQuestionnaire(button);},'voices-search-error');else openQuestionnaire(button);}));
 main.querySelectorAll('[data-invite-team]').forEach(button=>button.addEventListener('click',openTeamInvites));
 main.querySelectorAll('[data-open-upload]').forEach(button=>button.addEventListener('click',()=>openUpload(button)));
 main.querySelector('#choose-pieces')?.addEventListener('click',()=>{document.querySelector('#pieces-heading').focus({preventScroll:true});document.querySelector('#brand-pieces').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 main.querySelector('#asset-search')?.addEventListener('input',event=>{search=event.target.value;document.querySelector('#asset-grid').innerHTML=captureCards();bindCards();});
 main.querySelector('#brand-name-form')?.addEventListener('submit',guard(async event=>{const name=event.target.elements.name.value.trim();if(!name)return;await persist({...state,brand:{...state.brand,name}});render(false);}));
 main.querySelector('#connect-form')?.addEventListener('submit',guard(async event=>{const data=new FormData(event.target);let next=connectPiece(state,event.target.dataset.piece,data.getAll('assets'));if(brandPieces.find(p=>p.id===event.target.dataset.piece)?.kind!=='collection')next=setCurrentPiece(next,event.target.dataset.piece,data.get('currentAsset'));await persist(next,'Brand material updated.');render(false);}));
 main.querySelector('#consultation-interest')?.addEventListener('click',guard(async()=>{await persist({...state,world:{...state.world,consultation:{interested:true}}},'Added to your next steps.');render(false);}));
 main.querySelector('#edit-brand')?.addEventListener('click',()=>{
  const form=document.querySelector('#brand-details-form');for(const key of ['name','description','website'])form.elements[key].value=state.brand[key]||'';
  form.elements.logoAssetId.innerHTML='<option value="">Missing — no brand mark</option>'+state.assets.filter(a=>a.type?.startsWith('image/')).map(a=>`<option value="${a.id}" ${state.brand.logoAssetId===a.id?'selected':''}>${escape(a.name)}</option>`).join('');document.querySelector('#brand-details-dialog').showModal();
 });
 bindCards();
}
async function openAsset(assetId){
 const asset=state.assets.find(a=>a.id===assetId);if(!asset)return;
 assetForm.elements.id.value=asset.id;assetForm.elements.name.value=asset.name;
 document.querySelector('#capture-path').textContent=path(asset);
 const preview=document.querySelector('#asset-preview');preview.replaceChildren();
 if(asset.kind==='link'){const a=document.createElement('a');a.href=asset.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open reference ↗';a.className='text-button';preview.append(a);}
 else{const original=await store.file(asset.id);if(original){const url=URL.createObjectURL(original);objectURLs.push(url);if(asset.type?.startsWith('image/')){const img=document.createElement('img');img.src=url;img.alt=asset.name;preview.append(img);}const a=document.createElement('a');a.href=url;a.download=original.name||asset.originalName||asset.name;a.textContent='Download original ↗';a.className='text-button';preview.append(a);}}
 dialog.showModal();
}
async function addQuestionnaireMaterial(action){
 const added=await action();if(!added?.length||!questionnaireSession)return;
 questionnaireSession.sourceIds=[...new Set([...questionnaireSession.sourceIds,...added])];scheduleQuestionnaireSave();renderQuestionnaire();
}
const questionnaireBody=document.querySelector('#questionnaire-body');
questionnaireBody.addEventListener('dragover',event=>{const zone=event.target.closest('[data-questionnaire-drop]');if(zone){event.preventDefault();zone.classList.add('drag-over');}});
questionnaireBody.addEventListener('dragleave',event=>event.target.closest('[data-questionnaire-drop]')?.classList.remove('drag-over'));
questionnaireBody.addEventListener('drop',event=>{
 const zone=event.target.closest('[data-questionnaire-drop]');if(!zone)return;event.preventDefault();zone.classList.remove('drag-over');
 const action=droppedFiles(event.dataTransfer);guard(()=>addQuestionnaireMaterial(()=>action))(event);
});
questionnaireBody.addEventListener('click',event=>{
 if(!event.target.closest('[data-questionnaire-add-link]'))return;
 guard(async()=>{
 const input=document.querySelector('#questionnaire-link'),url=safeURL(input.value);
 if(!url){input.setCustomValidity('Use an http or https link without embedded credentials.');input.reportValidity();return;}
 const nextId=id(),source={id:nextId,kind:'link',url,name:new URL(url).hostname+new URL(url).pathname.replace(/\/$/,''),capturePath:'capture/links/'+nextId,collection:'Capture'};
 await persist({...state,assets:[...state.assets,source]});render(false);
 await addQuestionnaireMaterial(async()=>[nextId]);
 })(event);
});
questionnaireBody.addEventListener('input',event=>{if(event.target.id==='questionnaire-link')event.target.setCustomValidity('');});
document.querySelector('#questionnaire-download').addEventListener('click',guard(async()=>{
 if(!await saveQuestionnaireDraft())return;
 const packet=state.world?.brandRoundtableHandoff;
 if(packet?.status!=='prepared'){message('Prepare the updated handoff first.');return;}
 const blob=new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='brand-roundtable-handoff.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}));
document.querySelector('#close-questionnaire').addEventListener('click',guard(closeQuestionnaire));
document.querySelector('#questionnaire-save-close').addEventListener('click',guard(closeQuestionnaire));
questionnaireDialog.addEventListener('cancel',guard(closeQuestionnaire));
questionnaireDialog.addEventListener('close',()=>{
 clearTimeout(questionnaireTimer);questionnaireTimer=null;questionnaireSession=null;
 document.documentElement.classList.remove('upload-open');render(false);
 (questionnaireOpener==='matching'?main.querySelector('[data-find-teammates]'):main.querySelector(`[data-open-questionnaire="${questionnaireOpener}"]`))?.focus({preventScroll:true});
});
document.querySelector('#questionnaire-body').addEventListener('click',event=>{
 const button=event.target.closest('[data-questionnaire-step]');if(button)changeQuestionnaireStep(button.dataset.questionnaireStep);
});
document.querySelector('#questionnaire-body').addEventListener('input',event=>{
 const key=event.target.dataset.questionnaireAnswer;if(!key)return;
 questionnaireSession.answers[key]=event.target.value;scheduleQuestionnaireSave();updateQuestionnaireProgress();
});
document.querySelector('#questionnaire-body').addEventListener('change',event=>{
 if(event.target.matches('[data-questionnaire-origin]')){questionnaireSession.origins[event.target.dataset.questionnaireOrigin]=event.target.value;scheduleQuestionnaireSave();return;}
 if(event.target.matches('[data-questionnaire-files]')){guard(()=>addQuestionnaireMaterial(()=>acceptFiles(event.target.files)))(event);return;}
 if(!event.target.matches('[data-questionnaire-source]'))return;
 const selected=new Set(questionnaireSession.sourceIds);if(event.target.checked)selected.add(event.target.value);else selected.delete(event.target.value);
 questionnaireSession.sourceIds=[...selected];scheduleQuestionnaireSave();
});
document.querySelector('#questionnaire-back').addEventListener('click',()=>{
 if(questionnaireSession.step==='review'){const previous=brandQuestionnaireSections.at(-1);changeQuestionnaireStep(previous.id,previous.questions.at(-1).id);return;}
 const index=brandQuestionnaireSections.findIndex(section=>section.id===questionnaireSession.step),section=brandQuestionnaireSections[index],qIndex=section.questions.findIndex(q=>q.id===activeBrandQuestion(questionnaireSession).id);
 if(qIndex>0){changeQuestionnaireStep(section.id,section.questions[qIndex-1].id);return;}
 if(index===0){changeQuestionnaireStep('materials');return;}
 const previous=brandQuestionnaireSections[index-1];changeQuestionnaireStep(previous.id,previous.questions.at(-1).id);
});
document.querySelector('#questionnaire-form').addEventListener('submit',guard(async()=>{
 if(questionnaireSession.step==='review'){
  if(!await saveQuestionnaireDraft())return;
  await serialize(async()=>{const next=prepareBrandRoundtableHandoff(state);if(storageReady)await store.save(next);state=next;});
  renderQuestionnaire(true);questionnaireSaveStatus.textContent=storageReady?'Handoff prepared on this browser. It has not been sent.':'Handoff prepared for this visit. It has not been sent.';return;
 }
 if(questionnaireSession.step==='materials'){changeQuestionnaireStep(brandQuestionnaireSections[0].id);return;}
 const index=brandQuestionnaireSections.findIndex(section=>section.id===questionnaireSession.step),section=brandQuestionnaireSections[index],qIndex=section.questions.findIndex(q=>q.id===activeBrandQuestion(questionnaireSession).id);
 if(qIndex<section.questions.length-1)changeQuestionnaireStep(section.id,section.questions[qIndex+1].id);else changeQuestionnaireStep(brandQuestionnaireSections[index+1]?.id||'review');
}));
for(const key of ['close-team','done-team'])document.querySelector('#'+key).addEventListener('click',()=>teamDialog.close());
teamDialog.addEventListener('close',()=>{document.documentElement.classList.remove('upload-open');main.querySelector('[data-invite-team]')?.focus({preventScroll:true});});
document.querySelector('#team-invite-form').addEventListener('submit',guard(async event=>{
 const input=event.target.elements.emails;let next;
 try{next=addInvitationDrafts(state,input.value.split(','));}catch(error){input.setCustomValidity(error.message);input.reportValidity();return;}
 if(next===state){message('These people are already on your team or invitation list.');return;}
 await persist(next);input.value='';render(false);renderInvitationDrafts();message('Invitation draft saved. Nothing has been sent.');
}));
document.querySelector('#team-invite-form input').addEventListener('input',event=>event.target.setCustomValidity(''));
document.querySelector('#upload-area').innerHTML=captureArea();
bindCapture(uploadDialog);
for(const key of ['close-upload','done-upload'])document.querySelector('#'+key).addEventListener('click',()=>uploadDialog.close());
uploadDialog.addEventListener('close',()=>{
 document.documentElement.classList.remove('upload-open');
 (main.querySelector(`[data-open-upload="${uploadOpener}"]`)||main.querySelector('[data-open-upload]')||main.querySelector('[name=currentAsset]')||main.querySelector('h1'))?.focus({preventScroll:true});
});
assetForm.addEventListener('submit',guard(async()=>{const id=assetForm.elements.id.value;await persist({...state,assets:state.assets.map(a=>a.id===id?{...a,name:assetForm.elements.name.value.trim()||a.name}:a)});dialog.close();render(false);}));
 document.querySelector('#close-asset').addEventListener('click',()=>dialog.close());
 document.querySelector('#remove-asset').addEventListener('click',guard(async()=>{const id=assetForm.elements.id.value;let next=removeAsset(state,id);for(const piece of brandPieces)next=connectPiece(next,piece.id,pieceState(next,piece.id).assetIds);await serialize(()=>store.deleteAsset(next,id));state=next;dialog.close();render(false);message('Removed from Capture. The original source is unchanged.');}));
// All writes remain browser-local; these actions never publish or dispatch a match.
const characterDialog=document.querySelector('#character-dialog'),characterForm=document.querySelector('#character-form');
let characterReturnId='';
function voiceSearchPatch(){
 const form=main.querySelector('#voices-search-form');if(!form)return {};
 return {mode:'description',description:String(new FormData(form).get('description')||'')};
}
async function saveVoiceDescriptionDraft(){
 clearTimeout(voiceDraftTimer);
 const field=main.querySelector('#voices-description');if(!field||field.dataset.dirty!=='true')return;
 const next=saveVoicesSearch(state,voiceSearchPatch());field.dataset.dirty='false';state=next;
 const revision=field.value,note=main.querySelector('#voices-draft-note');
 try{if(storageReady)await serialize(()=>store.save(next));if(field.isConnected&&field.value===revision&&note)note.textContent=storageReady?'Draft saved on this browser.':'Draft kept for this visit.';}
 catch(error){if(field.isConnected){field.dataset.dirty='true';if(note)note.textContent='Could not save this draft. Your text is still here.';}throw error;}
}
async function flowAction(action,errorId){try{await action();}catch(error){const target=document.querySelector('#'+errorId);if(target)target.textContent=error.message;}}
function downloadJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function openCharacterEditor(characterId=''){
 if(main.querySelector('#voices-search-form'))await persist(saveVoicesSearch(state,voiceSearchPatch()));
 const character=audienceCharacters(state).find(c=>c.id===characterId);characterReturnId=character?.id||'';
 document.querySelector('#character-title').textContent=character?'Shape this character.':'Meet an audience character.';
 document.querySelector('#character-fields').innerHTML=audienceEditor(character||{});document.querySelector('#character-error').textContent='';
 characterDialog.showModal();document.documentElement.classList.add('upload-open');
}
document.querySelector('#close-character').addEventListener('click',()=>characterDialog.close());
characterDialog.addEventListener('close',()=>{document.documentElement.classList.remove('upload-open');const target=Array.from(main.querySelectorAll('[data-edit-character]')).find(button=>button.dataset.editCharacter===characterReturnId)||main.querySelector('[data-new-character]')||main.querySelector('h1');target?.focus({preventScroll:true});});
characterForm.addEventListener('submit',event=>{event.preventDefault();flowAction(async()=>{
 const data=new FormData(characterForm),patch=Object.fromEntries(['name','situation','desire','interests','outlook','basis'].map(key=>[key,String(data.get(key)||'')]));patch.id=String(data.get('id')||'')||id();
 let next=saveAudienceCharacter(state,patch);if(location.hash==='#network')next=saveVoicesSearch(next,{mode:'character',characterId:patch.id});
 await persist(next,'Audience character saved on this browser.');characterReturnId=patch.id;render(false);characterDialog.close();
},'character-error');});
function creatorFormPatch(){
 const form=main.querySelector('#creator-profile-form'),data=new FormData(form),patch={};
 for(const key of ['name','location','about','perspective','audience','community','collaborations','boundaries','linksText','returningPull','socialCircle','sharedLife','localArea','localPull'])if(data.has(key))patch[key]=String(data.get(key));
 if(data.get('step')==='about'){patch.communityDetails=creatorCommunityFormDetails(form);patch.socialChannels=creatorSocialChannelsFormValue(form);}
 if(data.get('step')==='voice'){
  const studio=getCreatorStudio(getCreatorProfile(state)),active=form.querySelector('[data-active-character]').dataset.activeCharacter;
  patch.studio={...studio,characters:studio.characters.map(c=>{
   if(c.id!==active)return c;const next={...c};
   form.querySelectorAll('[data-character-field]').forEach(input=>{next[input.dataset.characterField]=input.value;});
   if(studio.activeSpace==='profile')next.archetypeSeeds=Array.from(form.querySelectorAll('[data-archetype-seed]:checked')).map(input=>input.value);
   if(studio.activeSpace==='personality'){
    next.traits={...c.traits};
    for(const group of ['bigFive','myersBriggs']){next.traits[group]={...c.traits[group]};form.querySelectorAll(`[data-trait-group="${group}"]`).forEach(input=>{next.traits[group][input.dataset.traitKey]=input.dataset.traitSet==='true'?Number(input.value):null;});}
   }
   next.collections=c.collections.map(collection=>{
    const row=Array.from(form.querySelectorAll('[data-collection-id]')).find(row=>row.dataset.collectionId===collection.id);if(!row)return collection;
    return {...collection,title:row.querySelector('[data-collection-field="title"]').value,items:Array.from(row.querySelectorAll('[data-reference-id]')).map(itemRow=>{const item=collection.items.find(item=>item.id===itemRow.dataset.referenceId);return {...item,...Object.fromEntries(Array.from(itemRow.querySelectorAll('[data-reference-field]')).map(input=>[input.dataset.referenceField,input.value]))};})};
   });return next;
  })};
 }
 if(data.get('step')==='work'){patch.channels=data.getAll('channels');patch.formats=data.getAll('formats');}return patch;
}
async function saveCreatorStep(step,preview=false){
 const refsOpen=main.querySelector('.character-references')?.open;
 await persist(saveCreatorProfile(state,{...creatorFormPatch(),step}),'Profile draft saved on this browser.');
 if(preview)location.hash='creator/preview';else{render(false);if(refsOpen&&main.querySelector('.character-references'))main.querySelector('.character-references').open=true;const h=main.querySelector('.creator-step-body h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}}
}
async function updateCreatorStudio(transform,focusSelector=''){
 const patch=creatorFormPatch();patch.studio=transform(patch.studio);
 await persist(saveCreatorProfile(state,patch),'Character draft saved on this browser.');render(false);
 if(focusSelector&&(focusSelector.includes('collection')||focusSelector.includes('reference'))&&main.querySelector('.character-references'))main.querySelector('.character-references').open=true;
 const focus=main.querySelector(focusSelector||'.character-space-content h3');if(focus){if(focus.tagName==='H3')focus.tabIndex=-1;focus.focus({preventScroll:true});}
}
function updateActiveCreativeCharacter(studio,transform){return {...studio,characters:studio.characters.map(c=>c.id===studio.activeCharacterId?transform(c):c)};}
function bindCharacterStudio(){
 const run=action=>flowAction(action,'creator-profile-error');
 main.querySelector('#creator-character-select')?.addEventListener('change',event=>run(()=>updateCreatorStudio(studio=>({...studio,activeCharacterId:event.target.value}))));
 main.querySelector('#creator-add-character')?.addEventListener('click',()=>run(()=>{const characterId=id();return updateCreatorStudio(studio=>({...studio,activeCharacterId:characterId,activeSpace:'profile',characters:[...studio.characters,newCreativeCharacter(characterId)]}),'[data-character-field="name"]');}));
 main.querySelectorAll('[data-character-space-nav]').forEach(button=>button.addEventListener('click',()=>run(()=>updateCreatorStudio(studio=>({...studio,activeSpace:button.dataset.characterSpaceNav})))));
 main.querySelectorAll('[data-trait-group]').forEach(input=>input.addEventListener('input',()=>{input.dataset.traitSet='true';input.setAttribute('aria-valuetext',`${input.value} / 100`);input.closest('.character-trait').querySelector('output').textContent=`${input.value} / 100`;}));
 main.querySelectorAll('[data-trait-reset]').forEach(button=>button.addEventListener('click',()=>{const input=button.closest('.character-trait').querySelector('input');input.value='50';input.dataset.traitSet='false';input.setAttribute('aria-valuetext','Not set');button.closest('.character-trait').querySelector('output').textContent='Not set';}));
 main.querySelector('#character-add-collection')?.addEventListener('click',()=>run(()=>{
  const kind=main.querySelector('#character-collection-kind').value;
  return updateCreatorStudio(studio=>updateActiveCreativeCharacter(studio,c=>({...c,collections:[...c.collections,{id:id(),kind,space:studio.activeSpace,title:'',items:[]}]})),'.character-collection:last-of-type [data-collection-field="title"]');
 }));
 main.querySelectorAll('[data-remove-collection]').forEach(button=>button.addEventListener('click',()=>run(()=>updateCreatorStudio(studio=>updateActiveCreativeCharacter(studio,c=>({...c,collections:c.collections.filter(list=>list.id!==button.dataset.removeCollection)})),'#character-add-collection'))));
 main.querySelectorAll('[data-add-reference]').forEach(button=>button.addEventListener('click',()=>run(()=>updateCreatorStudio(studio=>updateActiveCreativeCharacter(studio,c=>({...c,collections:c.collections.map(list=>list.id===button.dataset.addReference?{...list,items:[...list.items,{id:id(),title:'',note:'',url:'',imageURL:''}]}:list)})),`[data-collection-id="${CSS.escape(button.dataset.addReference)}"] [data-reference-id]:last-child [data-reference-field="title"]`))));
 main.querySelectorAll('[data-remove-reference]').forEach(button=>button.addEventListener('click',()=>run(()=>updateCreatorStudio(studio=>updateActiveCreativeCharacter(studio,c=>({...c,collections:c.collections.map(list=>list.id===button.dataset.referenceCollection?{...list,items:list.items.filter(item=>item.id!==button.dataset.removeReference)}:list)})),'#character-add-collection'))));
}

function bindVoiceFlows(){
 bindCharacterStudio();
 bindCreatorSocialChannels(main.querySelector('#creator-profile-form'));
 bindCreatorCommunityTags(main.querySelector('#creator-profile-form'),{onPlaceSubmit:async()=>{if(!storageReady)throw new Error('Storage unavailable');await persist(saveCreatorProfile(state,creatorFormPatch()),'Place review draft saved on this browser.');}});

 main.querySelector('#voices-search-form')?.addEventListener('input',()=>{
  const field=main.querySelector('#voices-description'),count=voiceDescriptionWordCount(field.value);field.dataset.dirty='true';
  main.querySelector('#voices-word-count').textContent=`${count} ${count===1?'word':'words'}`;
  main.querySelector('#voices-search-form [type="submit"]').disabled=count<voiceSearchMinimumWords;
  main.querySelector('#voices-results').hidden=true;main.querySelector('#voices-search-error').textContent='';
  main.querySelector('#voices-draft-note').textContent='Saving draft…';clearTimeout(voiceDraftTimer);
  voiceDraftTimer=setTimeout(()=>flowAction(saveVoiceDescriptionDraft,'voices-search-error'),350);
 });
 main.querySelectorAll('[data-new-character]').forEach(button=>button.addEventListener('click',()=>flowAction(()=>openCharacterEditor(),'voices-search-error')));
 main.querySelectorAll('[data-edit-character]').forEach(button=>button.addEventListener('click',()=>flowAction(()=>openCharacterEditor(button.dataset.editCharacter),'voices-search-error')));
 main.querySelector('#voices-search-form')?.addEventListener('submit',event=>{event.preventDefault();flowAction(async()=>{
  await saveVoiceDescriptionDraft();const next=prepareVoicesSearch(saveVoicesSearch(state,voiceSearchPatch()));
  await persist(next,'');render(false);main.querySelector('#voices-results-title')?.focus();
 },'voices-search-error');});
 main.querySelectorAll('[data-creator-step]').forEach(button=>button.addEventListener('click',()=>flowAction(()=>saveCreatorStep(button.dataset.creatorStep),'creator-profile-error')));
 main.querySelector('#creator-save')?.addEventListener('click',()=>flowAction(()=>saveCreatorStep(getCreatorProfile(state).step),'creator-profile-error'));
 main.querySelector('#creator-previous')?.addEventListener('click',()=>flowAction(()=>saveCreatorStep(creatorSteps[creatorSteps.findIndex(([id])=>id===getCreatorProfile(state).step)-1][0]),'creator-profile-error'));
 main.querySelector('#creator-profile-form')?.addEventListener('submit',event=>{event.preventDefault();flowAction(()=>{const index=creatorSteps.findIndex(([id])=>id===getCreatorProfile(state).step);return saveCreatorStep(creatorSteps[Math.min(index+1,creatorSteps.length-1)][0],index===creatorSteps.length-1);},'creator-profile-error');});
 main.querySelector('#download-creator-profile')?.addEventListener('click',()=>downloadJSON(creatorProfileExport(state),'voice-profile-draft.json'));
}

 window.addEventListener('hashchange',()=>render());
 try{const original=await store.load()||emptyState();state=original;}catch{storageReady=false;message('Browser storage is unavailable. You can explore; changes last for this visit.');}
 render(false);

async function loadBrandMark(version){
 const host=main.querySelector('[data-brand-mark]');if(!host)return;
 try{const original=await store.file(host.dataset.brandMark);if(!original||version!==renderVersion)return;const url=URL.createObjectURL(original);objectURLs.push(url);const img=document.createElement('img');img.src=url;img.alt=state.brand.name?state.brand.name+' brand mark':'Brand mark';host.append(img);}catch{host.textContent='Brand mark unavailable';}
}
const brandDialog=document.querySelector('#brand-details-dialog');
document.querySelector('#close-brand-details').addEventListener('click',()=>brandDialog.close());
document.querySelector('#brand-details-form').addEventListener('submit',guard(async event=>{
 const data=new FormData(event.target),website=String(data.get('website')||'').trim();
 if(website&&!safeURL(website)){event.target.elements.website.setCustomValidity('Use an http or https website address.');event.target.elements.website.reportValidity();return;}
 await persist({...state,brand:{...state.brand,name:String(data.get('name')||'').trim(),description:String(data.get('description')||'').trim(),website,logoAssetId:String(data.get('logoAssetId')||'')}});brandDialog.close();render(false);
}));
document.querySelector('#brand-details-form [name=website]').addEventListener('input',event=>event.target.setCustomValidity(''));
