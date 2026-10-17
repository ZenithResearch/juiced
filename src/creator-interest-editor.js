import {creatorCommunityGroups,creatorInterestFollowup,creatorSpecificSuggestions,editCreatorInterest} from './model.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chosenDetails=(data,interest)=>interest==='Food & drink'?data.cuisines:data.interestDetails[interest]||[];
export function interestSummary(data){
 return `<div class="interest-summary"><div class="interest-summary-heading"><h3>Interests <span>optional</span></h3><button type="button" class="interest-add" data-edit-interests>＋ Add interests</button></div>${data.interests.length?`<div class="interest-chips">${data.interests.map(interest=>{const count=chosenDetails(data,interest).length;return `<button type="button" class="interest-chip" data-open-interest="${esc(interest)}" aria-label="Explore ${esc(interest)}">${esc(interest)}${count?`<small>${count}</small>`:''}<span aria-hidden="true">›</span></button>`;}).join('')}</div>`:'<p class="interest-empty">A few things you’re into. Explore as much or as little as you like.</p>'}</div>`;
}
export function interestFormValue(form){
 const data=JSON.parse(form.querySelector('[data-interest-value]').dataset.interestValue);
 return {interests:data.interests,cuisines:data.cuisines,interestDetails:data.interestDetails,interestReferences:data.interestReferences};
}
export function bindInterestEditor(section){
 const holder=section.querySelector('[data-interest-value]'),dialog=document.querySelector('#interest-dialog');if(!holder||!dialog)return;
 const body=dialog.querySelector('#interest-dialog-body'),trail=dialog.querySelector('#interest-breadcrumbs'),error=dialog.querySelector('#interest-dialog-error');
 let draft,interest='',detail='',opener=null,open=false;
 const update=patch=>{draft=editCreatorInterest(draft,patch);};
 const currentInput=()=>body.querySelector('[data-interest-custom]');
 const render=()=>{
  error.textContent='';
  trail.innerHTML=`<button type="button" data-interest-root ${!interest?'aria-current="page"':''}>Interests</button>${interest?`<span aria-hidden="true">/</span><button type="button" data-interest-up ${!detail?'aria-current="page"':''}>${esc(interest)}</button>`:''}${detail?`<span aria-hidden="true">/</span><span aria-current="page">${esc(detail)}</span>`:''}`;
  let title,description,choices,selected,mode;
  if(!interest){
   title='What are you into?';description='Pick an interest to explore. The details are optional.';
   choices=[...new Set([...creatorCommunityGroups.interests.suggestions,...draft.interests,...Object.keys(draft.interestDetails),...draft.interestReferences.map(entry=>entry.interest)])];selected=draft.interests;mode='interest';
  }else if(!detail){
   const spec=interest==='Food & drink'?creatorCommunityGroups.cuisines:creatorInterestFollowup(interest);
   title=interest;description='Choose something you like, then go a little deeper if you want.';
   choices=[...new Set([...spec.suggestions,...chosenDetails(draft,interest),...draft.interestReferences.filter(entry=>entry.interest===interest).map(entry=>entry.detail)])];selected=chosenDetails(draft,interest);mode='detail';
  }else{
   title=detail;description='A few favourites, or add your own.';
   selected=draft.interestReferences.find(entry=>entry.interest===interest&&entry.detail===detail)?.items||[];
   choices=[...creatorSpecificSuggestions(interest,detail).map(value=>selected.find(item=>item.toLowerCase()===value.toLowerCase())||value),...selected.filter(value=>!creatorSpecificSuggestions(interest,detail).some(item=>item.toLowerCase()===value.toLowerCase()))];mode='reference';
  }
  body.innerHTML=`<h3 tabindex="-1">${esc(title)}</h3><p class="interest-explainer">${description}</p><div class="interest-options ${mode==='reference'?'interest-reference-options':''}" data-interest-mode="${mode}">${choices.map(value=>mode==='reference'?`<label class="community-pill"><input type="checkbox" data-interest-reference value="${esc(value)}" ${selected.includes(value)?'checked':''}><span>${esc(value)}</span></label>`:`<button type="button" class="interest-option" data-interest-choice="${esc(value)}"><span>${esc(value)}</span><span aria-hidden="true">${selected.includes(value)?'✓':'›'}</span><span class="sr-only">${selected.includes(value)?'selected, ':''}explore</span></button>`).join('')}</div><div class="interest-custom-adder"><input data-interest-custom aria-label="${mode==='interest'?'Add your own interest':mode==='detail'?'Add your own detail':'Add your own favourite'}" placeholder="${mode==='interest'?'Something else you’re into':mode==='detail'?'Add your own detail':'Add a name'}" maxlength="${mode==='reference'?120:60}" autocomplete="off"><button type="button" class="app-button" data-interest-add>Add</button></div>${interest?`<button type="button" class="interest-remove" data-interest-remove>Remove ${esc(detail||interest)}</button>`:''}`;
 };
 const show=value=>{
  opener=document.activeElement;draft=JSON.parse(holder.dataset.interestValue);interest=value||'';detail='';open=true;render();dialog.showModal();body.querySelector('h3').focus({preventScroll:true});
 };
 const choose=value=>{
  value=value.trim().normalize('NFC');
  if(!interest){update({level:'interest',interest:value});interest=draft.interests.find(item=>item.toLowerCase()===value.toLowerCase())||value;}
  else if(!detail){update({level:'detail',interest,detail:value});detail=chosenDetails(draft,interest).find(item=>item.toLowerCase()===value.toLowerCase())||value;}
  else update({level:'reference',interest,detail,value});
  render();body.querySelector('h3').focus({preventScroll:true});
 };
 const attempt=action=>{try{action();}catch(err){error.textContent=err.message;}};
 section.addEventListener('click',event=>{const add=event.target.closest('[data-edit-interests]'),chip=event.target.closest('[data-open-interest]');if(add||chip)show(chip?.dataset.openInterest);});
 // One active editor owns the dialog for the life of the current About you form.
 const controller=new AbortController(),signal=controller.signal;
 const retire=()=>{if(!section.isConnected){controller.abort();observer.disconnect();}};
 const observer=new MutationObserver(retire);observer.observe(document.querySelector('main'),{childList:true,subtree:true});
 dialog.addEventListener('click',event=>{
  if(!open)return;
  if(event.target.closest('[data-interest-cancel]')){dialog.close();return;}
  if(event.target.closest('[data-interest-done]')){
   holder.dataset.interestValue=JSON.stringify(draft);holder.innerHTML=interestSummary(draft);opener=holder.querySelector(interest?`[data-open-interest="${CSS.escape(interest)}"]`:'[data-edit-interests]')||holder.querySelector('[data-edit-interests]');dialog.close();return;
  }
  if(event.target.closest('[data-interest-root]')){interest='';detail='';render();return;}
  if(event.target.closest('[data-interest-up]')){detail='';render();return;}
  const button=event.target.closest('[data-interest-choice]');if(button){attempt(()=>choose(button.dataset.interestChoice));return;}
  if(event.target.closest('[data-interest-add]')){const value=currentInput().value.trim();if(value)attempt(()=>choose(value));return;}
  if(event.target.closest('[data-interest-remove]'))attempt(()=>{if(detail){update({level:'detail',interest,detail,selected:false});detail='';}else{update({level:'interest',interest,selected:false});interest='';}render();});
 },{signal});
 dialog.addEventListener('change',event=>{if(open&&event.target.matches('[data-interest-reference]')){try{update({level:'reference',interest,detail,value:event.target.value,selected:event.target.checked});error.textContent='';}catch(err){event.target.checked=!event.target.checked;error.textContent=err.message;}}},{signal});
 dialog.addEventListener('keydown',event=>{if(open&&event.key==='Enter'&&event.target.matches('[data-interest-custom]')){event.preventDefault();const value=event.target.value.trim();if(value)attempt(()=>choose(value));}},{signal});
 dialog.addEventListener('close',()=>{if(!open)return;open=false;body.replaceChildren();error.textContent='';(opener?.isConnected?opener:holder.querySelector('[data-edit-interests]'))?.focus({preventScroll:true});},{signal});
}
