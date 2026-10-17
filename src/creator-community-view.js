import {safeURL,getCreatorCommunity,normalizeCreatorCommunityTags,draftCreatorPlaceSubmission,creatorCommunityGroups,creatorInterestFollowup,activeCreatorSpecificReferences,creatorLocationSuggestions} from './model.js';
import {interestSummary,interestFormValue,bindInterestEditor} from './creator-interest-editor.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function creatorLocationField(profile){return `<label class="creator-location-field" for="creator-based">Where are you based?<input id="creator-based" name="location" list="creator-city-options" value="${esc(profile.location)}" maxlength="180" placeholder="Choose a city or type your own" autocomplete="address-level2"></label><datalist id="creator-city-options">${creatorLocationSuggestions.map(city=>`<option value="${esc(city)}"></option>`).join('')}</datalist>`;}
export function creatorCommunityDetailsView(profile){
 const details=getCreatorCommunity(profile),interestData={interests:details.interests,cuisines:details.cuisines,interestDetails:details.interestDetails,interestReferences:details.interestReferences};
 return `<section class="creator-community-details creator-about-details" aria-label="Interests and favourite places"><div data-interest-value="${esc(JSON.stringify(interestData))}">${interestSummary(interestData)}</div><fieldset class="community-tag-field" data-community-tag-group="favouriteSpots" data-place-submissions="${esc(JSON.stringify(details.placeSubmissions||[]))}"><legend>Favourite local spots <span>optional</span></legend><p>A café, park, venue or place you keep going back to.</p><div class="community-pills">${details.favouriteSpots.map(name=>{const entity=details.favouriteSpotEntities.find(item=>item.name===name),pending=(details.placeSubmissions||[]).some(item=>item.name.toLowerCase()===name.toLowerCase());return `<label class="community-pill"><input type="checkbox" name="community-favouriteSpots" value="${esc(name)}" ${entity?`data-picked-entity="${esc(JSON.stringify(entity))}"`:''} checked><span>${esc(name)}${pending?'<small>Review draft</small>':''}</span></label>`;}).join('')}</div><div class="community-tag-adder"><input type="text" data-community-tag-input="favouriteSpots" aria-label="Add a local spot" placeholder="Name a place" maxlength="120" autocomplete="off"><button type="button" class="app-button" data-add-community-tag="favouriteSpots" aria-label="Submit a place for approval">Submit a place</button></div><p class="community-tag-error" role="alert"></p><p class="place-review-note" role="status">Submit a place for approval. Review requests are saved on this browser for now.</p></fieldset></section>`;
}
function pickedEntities(field){return Array.from(field.querySelectorAll('input:checked[data-picked-entity]')).map(input=>JSON.parse(input.dataset.pickedEntity));}
export function creatorCommunityFormDetails(form){
 const field=form.querySelector('[data-community-tag-group="favouriteSpots"]');
 return {version:1,...interestFormValue(form),favouriteSpots:Array.from(field.querySelectorAll('input[type="checkbox"]:checked')).map(input=>input.value),placeSubmissions:JSON.parse(field.dataset.placeSubmissions||'[]'),favouriteSpotEntities:pickedEntities(field)};
}
export function bindCreatorCommunityTags(form,{onPlaceSubmit=async()=>{}}={}){
 const section=form?.querySelector('.creator-community-details');if(!section)return;
 bindInterestEditor(section);
 const field=section.querySelector('[data-community-tag-group="favouriteSpots"]'),input=field.querySelector('[data-community-tag-input]'),button=field.querySelector('[data-add-community-tag]'),error=field.querySelector('[role="alert"]'),note=field.querySelector('.place-review-note');
 const submit=async()=>{
  if(button.disabled)return;error.textContent='';if(!input.value.trim()){input.focus();return;}
  try{
   const name=normalizeCreatorCommunityTags('favouriteSpots',[input.value])[0],current=Array.from(field.querySelectorAll('input[type="checkbox"]:checked')).map(input=>input.value);
   normalizeCreatorCommunityTags('favouriteSpots',[...current,name]);
   let choice=Array.from(field.querySelectorAll('input[type="checkbox"]')).find(input=>input.value.toLowerCase()===name.toLowerCase());
   if(!choice){
    const submissions=draftCreatorPlaceSubmission(JSON.parse(field.dataset.placeSubmissions||'[]'),name,form.elements.location?.value||'');
    const label=document.createElement('label'),span=document.createElement('span'),badge=document.createElement('small');label.className='community-pill';choice=document.createElement('input');choice.type='checkbox';choice.name='community-favouriteSpots';choice.value=name;span.textContent=name;badge.textContent='Review draft';span.append(badge);label.append(choice,span);field.querySelector('.community-pills').append(label);field.dataset.placeSubmissions=JSON.stringify(submissions);
   }
   choice.checked=true;input.value='';button.disabled=true;await onPlaceSubmit();note.textContent='Review draft saved on this browser. It has not been sent for approval yet.';input.focus();
  }catch(err){error.textContent=err.message||'This review draft could not be saved.';input.focus();}finally{button.disabled=false;}
 };
 button.addEventListener('click',submit);
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();submit();}});
 input.addEventListener('input',()=>{error.textContent='';});
}
export function creatorCommunitySummary(profile){
 const details=getCreatorCommunity(profile),sections=Object.entries(creatorCommunityGroups).filter(([group])=>details[group].length&&(group!=='cuisines'||details.interests.includes('Food & drink'))).map(([group,spec])=>[spec.title,details[group],group==='favouriteSpots'?details.favouriteSpotEntities:[]]);
 for(const interest of details.interests){const values=details.interestDetails[interest];if(values?.length)sections.push([creatorInterestFollowup(interest).title,values]);}
 for(const {interest,detail,items,entities=[]} of activeCreatorSpecificReferences(profile))sections.push([`${interest} → ${detail}`,items,entities]);
 return sections.map(([title,values,entities=[]])=>`<section class="community-summary"><h3>${esc(title)}</h3><ul class="creator-profile-tags">${values.map(value=>`<li>${entities.find(entity=>entity.name===value)?`<a href="${esc(safeURL(entities.find(entity=>entity.name===value).url)||'')}" target="_blank" rel="noopener noreferrer">${esc(value)} ↗</a>`:esc(value)}</li>`).join('')}</ul></section>`).join('');
}
