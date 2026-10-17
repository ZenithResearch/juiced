import {referencePresets} from './reference-presets.js';
import {brandPieces} from './brand-pieces.js';
import {legacyBrandQuestionnaireSections} from './questionnaire-legacy.js';
export const collections=['Strategy & story','Identity & assets','References & ideas'];
export const roles=['Creative direction','Design & production','Creators & distribution'];
export function emptyState(){
 return {version:1,brand:{name:'',description:'',audience:'',voice:''},assets:[],campaign:{title:'',objective:'',audience:'',format:'Online + real world',deliverables:'',assetIds:[]},collaboration:{roles:[],context:''}};
}
export function safeURL(value){
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function assetCollection(name){
 return /\.(png|jpe?g|webp|gif|svg|mp4|mov|ai|psd|fig)$/i.test(name)?collections[1]:collections[0];
}
export function removeAsset(state,id){
 return {...state,assets:state.assets.filter(asset=>asset.id!==id),campaign:{...state.campaign,assetIds:state.campaign.assetIds.filter(value=>value!==id)}};
}
export function handoff(state){
 const included=new Set(state.campaign.assetIds);
 return {brand:{...state.brand},campaign:{...state.campaign,assetIds:undefined},collaboration:{...state.collaboration},assets:state.assets.filter(asset=>included.has(asset.id)).map(({id,name,collection,kind,url,type})=>({id,name,collection,kind,url,type}))};
}
export function briefText(state){
 const brief=handoff(state);
 return [`${brief.brand.name||'Brand'} / ${brief.campaign.title||'Campaign draft'}`,'',brief.brand.description,`Audience: ${brief.campaign.audience||brief.brand.audience||'To define together'}`,`Brand voice: ${brief.brand.voice||'To define together'}`,'',`Objective: ${brief.campaign.objective||'To define together'}`,`Where: ${brief.campaign.format}`,`What we’re making: ${brief.campaign.deliverables||'To define together'}`,`Creative partners: ${brief.collaboration.roles.join(', ')||'To define together'}`,brief.collaboration.context,'','Included source material:',...brief.assets.map(a=>`• ${a.name}${a.url?' — '+a.url:''}`)].filter(line=>line!==undefined).join('\n');
}

// Invitation drafts are local planning records, never team membership or proof of delivery.
export function addInvitationDrafts(state,emails){
 const requested=[...new Set(emails.map(email=>String(email).trim().toLowerCase()).filter(Boolean))];
 if(!requested.length||requested.some(email=>!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email)))throw new Error('Enter valid email addresses, separated by commas.');
 const drafts=state.world?.invitationDrafts||[];
 const existing=new Set([...drafts,...(state.world?.team||[])].map(person=>person.email?.toLowerCase()).filter(Boolean));
 const additions=requested.filter(email=>!existing.has(email)).map(email=>({email}));
 if(!additions.length)return state;
 return {...state,world:{...state.world,invitationDrafts:[...drafts,...additions]}};
}

// V2 collects original fragments. Asset definitions remain the roundtable’s work.
export const brandQuestionnaireSections=[
 {
  "id": "brand-book",
  "title": "The ember",
  "description": "The founder, or the person carrying it forward.",
  "questions": [
   {
    "id": "firstPull",
    "label": "Before this was a plan, what kept pulling at you?",
    "hint": "Take us into a moment that helps us feel why. If you joined later, what made you stay? There does not need to be one grand beginning.",
    "subject": "founder-or-steward",
    "outputs": [
     "brand-book",
     "voice"
    ]
   },
   {
    "id": "costlyConviction",
    "label": "Which part would you protect if it made the road longer?",
    "hint": "Remember a small choice that cost time, ease or money because the easier way felt wrong. If it is a promise you have not tested yet, that belongs here too.",
    "subject": "brand-in-action",
    "outputs": [
     "brand-book",
     "design-system"
    ]
   }
  ]
 },
 {
  "id": "characters",
  "title": "The threshold",
  "description": "The people whose lives this work enters.",
  "questions": [
   {
    "id": "arrivalScene",
    "label": "Someone finds you at just the right moment. What has just happened in their life?",
    "hint": "Think of one person, rather than a whole audience. What occupied their day before you entered it? Tell us what you have seen, or what you are still imagining.",
    "subject": "people-served",
    "outputs": [
     "characters",
     "brand-book"
    ]
   },
   {
    "id": "desireAndContinuity",
    "label": "What are they reaching for—and what are they trying to keep?",
    "hint": "A desire can sit beside something they do not want to lose. A conversation, an ordinary decision or a hunch can give us a thread to follow.",
    "subject": "people-served",
    "outputs": [
     "characters",
     "voice"
    ]
   }
  ]
 },
 {
  "id": "voice",
  "title": "The gathering",
  "description": "The brand, alive in an exchange between people.",
  "questions": [
   {
    "id": "overheardMoment",
    "label": "Let us overhear a moment that felt completely like you.",
    "hint": "An exchange inside your team, or with a customer. What was said or done? Rough words, a message or a tiny incident are enough.",
    "subject": "brand-in-relationship",
    "outputs": [
     "voice",
     "brand-book"
    ]
   },
   {
    "id": "smallAct",
    "label": "What small act would tell someone they’re in the right place?",
    "hint": "A greeting, a habit, a quiet detail or the way you respond when a plan goes wrong. It might already happen, or be something you want to make possible.",
    "subject": "brand-in-relationship",
    "outputs": [
     "voice",
     "characters",
     "design-system"
    ]
   }
  ]
 },
 {
  "id": "identity",
  "title": "The atmosphere",
  "description": "Places, objects and memories that carry a feeling.",
  "questions": [
   {
    "id": "feltPlace",
    "label": "Take us somewhere you’ve felt the feeling you want to give people.",
    "hint": "A room, a song, a shop, a landscape, a scene. What small detail brings it back—the light, a material, the pace, the way you were treated?",
    "subject": "founder-or-steward",
    "outputs": [
     "identity",
     "design-system"
    ]
   },
   {
    "id": "returningFragment",
    "label": "Is there something you keep returning to? What does it hold for you?",
    "hint": "A note, a song, an object, an image or a memory. It can be ordinary. A stranger may miss what matters about it. You can also leave this one.",
    "subject": "founder-or-steward",
    "outputs": [
     "identity",
     "brand-book"
    ]
   }
  ]
 },
 {
  "id": "design-system",
  "title": "The echo",
  "description": "What travels with the work as other people bring it to life.",
  "questions": [
   {
    "id": "withoutTheSign",
    "label": "The name and logo disappear. What could still give you away?",
    "hint": "Choose a detail in how you make something or treat someone. Something already recognisable is useful; something you hope to become is a different, equally useful starting point.",
    "subject": "brand-in-action",
    "outputs": [
     "identity",
     "voice",
     "design-system"
    ]
   },
   {
    "id": "ordinaryTuesday",
    "label": "Your world meets an ordinary Tuesday. Where does someone feel it?",
    "hint": "Follow one real encounter: a screen, a parcel, a message, a shop or a conversation. What happens there? What should survive when somebody else makes it?",
    "subject": "brand-in-relationship",
    "outputs": [
     "design-system",
     "characters"
    ]
   }
  ]
 }
];

const questionnaireQuestions=brandQuestionnaireSections.flatMap(section=>section.questions);
export const questionnaireOrigins=[['','Leave open'],['lived','Something that happened'],['imagined','A possibility'],['mixed','A bit of both'],['uncertain','Not sure yet']];
function legacySnapshot(saved){return {...saved,version:saved.version||1,sections:legacyBrandQuestionnaireSections,answers:{...saved.answers},sourceIds:[...(saved.sourceIds||[])]};}
export function getBrandQuestionnaire(state){
 const saved=state.world?.brandQuestionnaire||{},current=saved.version===2;
 const answers=Object.fromEntries(questionnaireQuestions.map(q=>[q.id,current&&typeof saved.answers?.[q.id]==='string'?saved.answers[q.id]:'']));
 const origins=Object.fromEntries(questionnaireQuestions.map(q=>[q.id,current&&questionnaireOrigins.some(([value])=>value===saved.origins?.[q.id])?saved.origins[q.id]:'']));
 const available=new Set((state.assets||[]).map(asset=>asset.id));
 const sourceIds=[...new Set(Array.isArray(saved.sourceIds)?saved.sourceIds:[...available])].filter(id=>available.has(id));
 const step=current&&(brandQuestionnaireSections.some(section=>section.id===saved.step)||['materials','review'].includes(saved.step))?saved.step:'materials';
 const section=brandQuestionnaireSections.find(section=>section.id===step)||brandQuestionnaireSections[0];
 const activeQuestion=section.questions.some(q=>q.id===saved.activeQuestion)?saved.activeQuestion:section.questions[0].id;
 const earlier=[...(state.world?.brandQuestionnaireHistory||[]),...(!current&&state.world?.brandQuestionnaire?[legacySnapshot(saved)]:[])];
 return {version:2,answers,origins,sourceIds,step,activeQuestion,earlier,existingBrandDetails:{...state.brand}};
}
export function activeBrandQuestion(draft){
 const section=brandQuestionnaireSections.find(section=>section.id===draft.step)||brandQuestionnaireSections[0];
 return section.questions.find(q=>q.id===draft.activeQuestion)||section.questions[0];
}
export function brandHandoffIsCurrent(packet,draft){
 return packet?.version===2&&packet.status==='prepared'&&JSON.stringify(packet.answers)===JSON.stringify(draft.answers)&&JSON.stringify(packet.origins)===JSON.stringify(draft.origins)&&JSON.stringify(packet.sourceIds)===JSON.stringify(draft.sourceIds)&&JSON.stringify(packet.existingBrandDetails)===JSON.stringify(draft.existingBrandDetails);
}
export function saveBrandQuestionnaire(state,patch){
 const old=state.world?.brandQuestionnaire,current=old?.version===2,draft=getBrandQuestionnaire(state);
 if(old?.version>2)throw new Error('This draft uses a newer questionnaire. Keep it in its original version.');
 const answers={...(current?old.answers:{}),...draft.answers},origins={...(current?old.origins:{}),...draft.origins};
 for(const question of questionnaireQuestions){
  if(Object.hasOwn(patch.answers||{},question.id)){
   const value=patch.answers[question.id];if(typeof value!=='string'||value.length>4000)throw new Error('Keep each fragment under 4,000 characters.');answers[question.id]=value;
  }
  if(Object.hasOwn(patch.origins||{},question.id)){
   const value=patch.origins[question.id];if(!questionnaireOrigins.some(([allowed])=>allowed===value))throw new Error('Choose where this fragment comes from, or leave it open.');origins[question.id]=value;
  }
 }
 const available=new Set((state.assets||[]).map(asset=>asset.id));
 const sourceIds=[...new Set(Array.isArray(patch.sourceIds)?patch.sourceIds:draft.sourceIds)].filter(id=>available.has(id));
 const step=brandQuestionnaireSections.some(section=>section.id===patch.step)||['materials','review'].includes(patch.step)?patch.step:draft.step;
 const section=brandQuestionnaireSections.find(section=>section.id===step)||brandQuestionnaireSections[0];
 const activeQuestion=section.questions.some(q=>q.id===patch.activeQuestion)?patch.activeQuestion:section.questions.some(q=>q.id===draft.activeQuestion)?draft.activeQuestion:section.questions[0].id;
 const nextDraft={...(current?old:{}),version:2,answers,origins,sourceIds,step,activeQuestion};
 const packet=state.world?.brandRoundtableHandoff;
 const changed=packet?.version===2&&!brandHandoffIsCurrent(packet,getBrandQuestionnaire({...state,world:{...state.world,brandQuestionnaire:nextDraft}}));
 return {...state,world:{...state.world,brandQuestionnaire:nextDraft,...(old&&!current?{brandQuestionnaireHistory:[...(state.world?.brandQuestionnaireHistory||[]),legacySnapshot(old)]}:{}),...(changed?{brandRoundtableHandoff:{...packet,status:'needs-update'}}:{})}};
}
export function brandQuestionnaireProgress(draft){
 const sections=brandQuestionnaireSections.map(section=>({id:section.id,answered:section.questions.filter(q=>String(draft.answers?.[q.id]||'').trim()).length,total:section.questions.length}));
 return {answered:sections.reduce((sum,section)=>sum+section.answered,0),total:questionnaireQuestions.length,sections};
}
export function prepareBrandRoundtableHandoff(state){
 const draft=getBrandQuestionnaire(state);
 if(!brandQuestionnaireProgress(draft).answered&&!draft.sourceIds.length&&!draft.earlier.some(old=>Object.values(old.answers||{}).some(value=>String(value).trim())))throw new Error('Bring a fragment or a file before preparing the handoff.');
 const ids=new Set(draft.sourceIds);
 const sources=(state.assets||[]).filter(source=>ids.has(source.id)).map(({id,name,kind,url,type,size,capturePath,originalName})=>({id,name,kind,...(url?{url}:{}),...(type?{type}:{}),...(size!==undefined?{size}:{}),...(capturePath?{capturePath}:{}),...(originalName?{originalName}:{})}));
 const evidence=questionnaireQuestions.filter(q=>draft.answers[q.id].trim()).map(q=>({questionId:q.id,prompt:q.label,subject:q.subject,text:draft.answers[q.id],basis:draft.origins[q.id]||'unspecified',mayInform:[...q.outputs]}));
 const packet={version:2,questionnaireVersion:2,destination:'creative-roundtable',workflow:'brand-package',status:'prepared',existingBrandDetails:{...state.brand},answers:{...draft.answers},origins:{...draft.origins},sourceIds:[...draft.sourceIds],sources,evidence,interpretations:[],earlierQuestionnaires:draft.earlier,openThreads:questionnaireQuestions.filter(q=>!draft.answers[q.id].trim()).map(q=>({questionId:q.id,prompt:q.label})),practicalFollowUps:['Confirm the actual offer and any unsupported claims from source material.','Confirm accessibility, language, platform, licensing and production constraints before making a design system.'],outputs:brandPieces.filter(piece=>piece.kind!=='collection').map(piece=>({id:piece.id,title:piece.title,questionIds:questionnaireQuestions.filter(q=>q.outputs.includes(piece.id)).map(q=>q.id)})),interpretationRules:['Keep the respondent’s words separate from proposed creative interpretations.','Tie each proposed reading to evidence and uncertainty, and invite correction.','Do not infer audience preferences from founder taste or assign personality/clinical types from metaphors.'],fileStorage:'Original files remain in this browser’s IndexedDB files store, keyed by source ID. This packet contains references, not file bodies.'};
 const previous=state.world?.brandRoundtableHandoff;
 return {...state,world:{...state.world,brandRoundtableHandoff:packet,...(previous&&previous.version!==2?{brandRoundtableHandoffHistory:[...(state.world?.brandRoundtableHandoffHistory||[]),previous]}:{})}};
}

// Voices v1: authored audience characters, search intent and a separate creator draft.
export const voiceChannels=[['online','Online'],['irl','In the real world']];
export const creatorFormats=[['video','Film & video'],['photography','Photography'],['writing','Writing'],['audio','Audio'],['social','Social content'],['activation','IRL activations']];
export const creatorSteps=[['about','About you'],['voice','Characters'],['people','Your community'],['work','Your work']];
// Optional creative starting points. Each character can mix these and author its own archetype.
export const creatorArchetypes=[
 ['worldbuilder','The Worldbuilder','Turns ideas into worlds people can enter.'],
 ['explorer','The Explorer','Follows curiosity into the unfamiliar.'],
 ['storyteller','The Storyteller','Finds a story in the overlooked.'],
 ['trickster','The Trickster','Plays with wit, surprise and a little disruption.'],
 ['sage','The Sage','Makes something complex feel clear.'],
 ['rebel','The Rebel','Questions the rules and makes another way.'],
 ['host','The Host','Makes space for people to belong.'],
 ['alchemist','The Alchemist','Turns familiar things into unexpected forms.']
];
const characterFields=['name','situation','desire','interests','outlook'];
const creatorFields=['name','location','about','perspective','audience','community','collaborations','boundaries','linksText','customArchetype','character','voiceDescription','returningPull','socialCircle','sharedLife','localArea','localPull'];
function limitedText(value,max=4000){if(typeof value!=='string'||value.length>max)throw new Error(`Keep this answer under ${max.toLocaleString()} characters.`);return value;}
function supportedVersion(saved,label){if(saved?.version>1)throw new Error(`${label} uses a newer version. Keep it in its original version.`);}
function checkedIds(values,choices){if(!Array.isArray(values)||values.some(id=>!choices.some(([value])=>id===value)))throw new Error('Choose one of the available options.');return [...new Set(values)];}
export function audienceCharacters(state){return Array.isArray(state.world?.audienceCharacters)?state.world.audienceCharacters:[];}
export function saveAudienceCharacter(state,patch){
 if(typeof patch.id!=='string'||!patch.id.trim()||patch.id.length>100)throw new Error('A character needs a stable ID.');
 const existing=audienceCharacters(state).find(character=>character.id===patch.id);supportedVersion(existing,'This character');
 const next={...existing,version:1,id:patch.id};
 for(const key of characterFields)next[key]=Object.hasOwn(patch,key)?limitedText(patch[key],key==='name'?180:4000):existing?.[key]||'';
 next.basis=patch.basis??existing?.basis??'unspecified';if(!['observed','imagined','mixed','unspecified'].includes(next.basis))throw new Error('Choose the basis for this character.');
 if(!next.situation.trim()||!next.desire.trim())throw new Error('Give this character a situation and something they are reaching for.');
 const characters=existing?audienceCharacters(state).map(character=>character.id===next.id?next:character):[...audienceCharacters(state),next];
 const saved={...state,world:{...state.world,audienceCharacters:characters}};return invalidateVoiceSearch(saved);
}
export const voiceSearchMinimumWords=400;
export const voiceSearchDescriptionLimit=24000;
export function voiceDescriptionWordCount(text){return typeof text==='string'?text.trim().split(/\s+/u).filter(word=>/[\p{L}\p{N}]/u.test(word)).length:0;}
export function getVoicesSearch(state){
 const saved=state.world?.voicesSearch||{},characters=audienceCharacters(state);
 return {version:1,mode:['business','description'].includes(saved.mode)?saved.mode:'character',description:typeof saved.description==='string'?saved.description:'',characterId:typeof saved.characterId==='string'?(characters.some(c=>c.id===saved.characterId)?saved.characterId:''):characters[0]?.id||'',businessContext:typeof saved.businessContext==='string'?saved.businessContext:state.brand?.description||'',campaignContext:saved.campaignContext||'',channels:Array.isArray(saved.channels)?saved.channels.filter(id=>voiceChannels.some(([value])=>value===id)):[]};
}
export function saveVoicesSearch(state,patch){
 const old=state.world?.voicesSearch;supportedVersion(old,'This search');const draft=getVoicesSearch(state),next={...old,...draft,version:1};
 if(Object.hasOwn(patch,'mode')){if(!['character','business','description'].includes(patch.mode))throw new Error('Choose a supported search starting point.');next.mode=patch.mode;}
 if(Object.hasOwn(patch,'description'))next.description=limitedText(patch.description,voiceSearchDescriptionLimit);
 for(const key of ['businessContext','campaignContext'])if(Object.hasOwn(patch,key))next[key]=limitedText(patch[key]);
 if(Object.hasOwn(patch,'channels'))next.channels=checkedIds(patch.channels,voiceChannels);
 if(Object.hasOwn(patch,'characterId')){if(patch.characterId&&!audienceCharacters(state).some(c=>c.id===patch.characterId))throw new Error('Choose an existing audience character.');next.characterId=patch.characterId;}
 return invalidateVoiceSearch({...state,world:{...state.world,voicesSearch:next}});
}
export function voicesSearchContext(state){
 const search=getVoicesSearch(state),character=audienceCharacters(state).find(c=>c.id===search.characterId);
 if(search.mode==='description')return {version:1,source:{kind:'character-description',description:search.description},semanticDocument:search.description};
 const source=search.mode==='business'?{kind:'business',name:state.brand?.name||'',description:search.businessContext}:{kind:'audience-character',character:character?Object.fromEntries(['version','id',...characterFields,'basis'].map(key=>[key,character[key]??''])):null};
 const text=search.mode==='business'?search.businessContext:character?['situation','desire','interests','outlook'].map(key=>character[key]).filter(Boolean).join('\n\n'):'';
 return {version:1,source,brand:{name:state.brand?.name||'',description:state.brand?.description||''},campaignContext:search.campaignContext,channels:[...search.channels],semanticDocument:[text,search.campaignContext].filter(Boolean).join('\n\n')};
}
export function voiceSearchIsCurrent(state){const packet=state.world?.voicesSearchHandoff;return packet?.version===1&&packet.status==='prepared'&&JSON.stringify(packet.context)===JSON.stringify(voicesSearchContext(state));}
function invalidateVoiceSearch(state){const packet=state.world?.voicesSearchHandoff;return packet?.version===1&&!voiceSearchIsCurrent(state)?{...state,world:{...state.world,voicesSearchHandoff:{...packet,status:'needs-update'}}}:state;}
export function prepareVoicesSearch(state){
 const context=voicesSearchContext(state);
 if(context.source.kind==='character-description'&&voiceDescriptionWordCount(context.source.description)<voiceSearchMinimumWords)throw new Error(`Describe the character in at least ${voiceSearchMinimumWords} words.`);
 if(context.source.kind==='audience-character'&&!context.source.character)throw new Error('Create an audience character, or start with your business.');
 if(context.source.kind==='business'&&!context.source.description.trim())throw new Error('Tell us a little about the business before preparing the search.');
 return {...state,world:{...state.world,voicesSearchHandoff:{version:1,status:'prepared',context,retrieval:{method:'semantic',status:'not-connected',...(context.source.kind==='character-description'?{limit:5}:{})},results:[]}}};
}
// Optional author-built characters. Trait positions describe the character, not an assessed person.
export const characterSpaces=[['profile','Profile'],['world','World'],['shadow','Shadow'],['masks','Masks'],['complexes','Complexes'],['personality','Personality']];
export const collectionKinds=[['bookshelf','Bookshelf'],['films','Film catalogue'],['gallery','Gallery'],['moodboard','Moodboard'],['list','A list of your own']];
export const characterTraitAxes={
 bigFive:[['openness','Openness','Familiar','Exploratory'],['conscientiousness','Conscientiousness','Spontaneous','Structured'],['extraversion','Extraversion','Inward','Outward'],['agreeableness','Agreeableness','Challenging','Accommodating'],['neuroticism','Emotional sensitivity','Steady','Reactive']],
 myersBriggs:[['ei','Energy','Introversion · I','Extraversion · E'],['sn','Attention','Sensing · S','Intuition · N'],['tf','Decisions','Thinking · T','Feeling · F'],['jp','Approach','Judging · J','Perceiving · P']]
};
const studioTextFields=['name','bio','interests','archetype','voice','world','shadow','masks','complexes','context'];
export function newCreativeCharacter(id,seed={}){
 return {...seed,id,archetypeSeeds:Array.isArray(seed.archetypeSeeds)?seed.archetypeSeeds.filter(id=>creatorArchetypes.some(([key])=>key===id)):[],...Object.fromEntries(studioTextFields.map(key=>[key,typeof seed[key]==='string'?seed[key]:''])),traits:{...seed.traits,...Object.fromEntries(Object.entries(characterTraitAxes).map(([group,axes])=>[group,{...seed.traits?.[group],...Object.fromEntries(axes.map(([key])=>[key,seed.traits?.[group]?.[key]??null]))}]))},collections:Array.isArray(seed.collections)?seed.collections:[]};
}
export function getCreatorStudio(profile){
 const saved=profile.studio;
 // A read-only projection until explicitly saved; the original v1 prose/personas remain intact.
 const characters=Array.isArray(saved?.characters)&&saved.characters.length?saved.characters.map(c=>newCreativeCharacter(c.id,c)):[newCreativeCharacter('primary',{name:profile.name,bio:profile.character,voice:profile.voiceDescription,archetype:profile.customArchetype,archetypeSeeds:profile.archetypes}),...(profile.personas||[]).map(p=>newCreativeCharacter(`persona-${p.id}`,{name:p.name,bio:p.description,context:p.context,legacyPersonaId:p.id}))];
 return {...saved,version:saved?.version||1,characters,activeCharacterId:characters.some(c=>c.id===saved?.activeCharacterId)?saved.activeCharacterId:characters[0].id,activeSpace:characterSpaces.some(([key])=>key===saved?.activeSpace)?saved.activeSpace:'profile'};
}
function stableIdentity(value,ids,label){if(typeof value!=='string'||!value.trim()||value.length>120||ids.has(value))throw new Error(`Each ${label} needs its own stable ID.`);ids.add(value);return value;}
function referenceURL(value){const text=limitedText(value??'',2000);if(text&&!safeURL(text))throw new Error('Use a complete http or https reference link, without embedded credentials.');return text;}
function validateCreatorStudio(saved,patch){
 supportedVersion(saved,'This character studio');supportedVersion(patch,'This character studio');
 if(!patch||!Array.isArray(patch.characters)||!patch.characters.length||patch.characters.length>20)throw new Error('Keep between one and twenty characters in this studio.');
 const ids=new Set(),characters=patch.characters.map(c=>{
  if(!c||typeof c!=='object')throw new Error('Give each character its own space.');
  stableIdentity(c.id,ids,'character');const existing=saved?.characters?.find(old=>old.id===c.id),next={...existing,id:c.id};
  for(const key of studioTextFields)next[key]=limitedText(c[key]??existing?.[key]??'',key==='name'?180:key==='context'?500:4000);
  next.archetypeSeeds=Object.hasOwn(c,'archetypeSeeds')?checkedIds(c.archetypeSeeds,creatorArchetypes):[...(existing?.archetypeSeeds||[])];
  next.traits={...existing?.traits};
  for(const [group,axes]of Object.entries(characterTraitAxes)){
   next.traits[group]={...existing?.traits?.[group]};
   for(const [key]of axes){const value=Object.hasOwn(c.traits?.[group]||{},key)?c.traits[group][key]:existing?.traits?.[group]?.[key]??null;if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100))throw new Error('A character slider must be unset or between 0 and 100.');next.traits[group][key]=value;}
  }
  const collections=c.collections??existing?.collections??[];
  if(!Array.isArray(collections)||collections.length>30)throw new Error('Keep up to thirty collections per character.');
  const collectionIds=new Set();next.collections=collections.map(collection=>{
   if(!collection||typeof collection!=='object')throw new Error('Give this collection a type.');
   stableIdentity(collection.id,collectionIds,'collection');const old=existing?.collections?.find(item=>item.id===collection.id);
   if(!collectionKinds.some(([kind])=>kind===collection.kind)||!characterSpaces.some(([space])=>space===collection.space))throw new Error('Choose an available collection type and character space.');
   if(!Array.isArray(collection.items)||collection.items.length>60)throw new Error('Keep up to sixty references in a collection.');
   const itemIds=new Set();return {...old,id:collection.id,kind:collection.kind,space:collection.space,title:limitedText(collection.title??'',180),items:collection.items.map(item=>{if(!item||typeof item!=='object')throw new Error('Give this reference its own entry.');stableIdentity(item.id,itemIds,'reference');const prior=old?.items?.find(entry=>entry.id===item.id);return {...prior,id:item.id,title:limitedText(item.title??'',180),note:limitedText(item.note??'',2000),url:referenceURL(item.url),imageURL:referenceURL(item.imageURL)};})};
  });return next;
 });
 if(!characters.some(c=>c.id===patch.activeCharacterId))throw new Error('Choose a character in this studio.');
 if(!characterSpaces.some(([space])=>space===patch.activeSpace))throw new Error('Choose a character space.');
 return {...saved,version:1,characters,activeCharacterId:patch.activeCharacterId,activeSpace:patch.activeSpace};
}
function exportCreatorStudio(profile){const studio=getCreatorStudio(profile);return {version:1,activeCharacterId:studio.activeCharacterId,activeSpace:studio.activeSpace,characters:studio.characters.map(c=>({id:c.id,archetypeSeeds:[...c.archetypeSeeds],...Object.fromEntries(studioTextFields.map(key=>[key,c[key]])),traits:Object.fromEntries(Object.entries(characterTraitAxes).map(([group,axes])=>[group,Object.fromEntries(axes.map(([key])=>[key,c.traits[group][key]]))])),collections:c.collections.map(({id,kind,space,title,items})=>({id,kind,space,title,items:items.map(({id,title,note,url,imageURL})=>({id,title,note,url,imageURL}))}))}))};}

// Optional real-person preferences; separate from authored studio characters.
export const creatorLocationSuggestions=['London, Ontario, Canada','Waterloo, Ontario, Canada','Toronto, Ontario, Canada','Guelph, Ontario, Canada','Kingston, Ontario, Canada','Hamilton, Ontario, Canada','Ottawa, Ontario, Canada','Vancouver, British Columbia, Canada','Victoria, British Columbia, Canada','Montréal, Québec, Canada','New York, New York, United States','London, United Kingdom','Berlin, Germany'];
export const creatorCommunityGroups={
 interests:{title:'Interests',inputLabel:'Add an interest',buttonLabel:'Add interest',limit:25,maxLength:60,suggestions:['Food & drink','Music','Film','Art & design','Books','Gaming','Sport','Outdoors','Fashion','Tech','Photography','Fitness','Nightlife','Travel','Volunteering','Student life']},
 cuisines:{title:'Favourite cuisines',inputLabel:'Add a cuisine',buttonLabel:'Add cuisine',limit:15,maxLength:60,suggestions:['Italian','Japanese','Mexican','Indian','Thai','Chinese','Korean','Greek','Middle Eastern','Vietnamese','Caribbean','French']},
 favouriteSpots:{title:'Favourite local spots',inputLabel:'Add a local spot',buttonLabel:'Add spot',limit:25,maxLength:120,suggestions:[]}
};
// Branches are optional real-person tastes, not inferred traits or audience claims.
const interestFollowups={
 Music:['Favourite music genres','Add a music genre',['Electronic','Jazz','Hip-hop','Indie','Rock','Pop','Classical','Ambient','R&B','Folk']],
 Film:['Favourite film genres','Add a film genre',['Drama','Comedy','Science fiction','Fantasy','Documentary','Horror','Animation','Thriller']],
 Books:['Favourite book genres','Add a book genre',['Literary fiction','Fantasy','Science fiction','Memoir','History','Poetry','Non-fiction']],
 Gaming:['Favourite games & genres','Add a game or genre',['RPGs','Strategy','Adventure','Co-op','Simulation','Indie games']],
 'Art & design':['Art & design interests','Add an art or design interest',['Painting','Illustration','Sculpture','Graphic design','Architecture','Digital art']],
 Sport:['Favourite sports','Add a sport',['Football','Basketball','Tennis','Hockey','Running','Cycling']],
 Outdoors:['Favourite outdoor activities','Add an outdoor activity',['Hiking','Camping','Climbing','Kayaking','Walking','Gardening']],
 Fashion:['Fashion interests','Add a fashion interest',['Vintage','Streetwear','Independent designers','Thrifting']],
 Tech:['Tech interests','Add a tech interest',['Creative coding','AI','Games','Hardware','Open source']],
 Photography:['Photography interests','Add a photography interest',['Portraits','Street','Film photography','Landscape','Documentary']],
 Fitness:['Favourite ways to move','Add an activity',['Gym','Yoga','Pilates','Dance','Swimming']],
 Nightlife:['Favourite nights out','Add a night out',['Live music','Clubs','Comedy','Late-night cafés']],
 Travel:['What you travel for','Add a travel interest',['Food','Art & culture','Nature','Cities','Road trips']],
 Volunteering:['Causes you care about','Add a cause',[]],
 'Student life':['Student life interests','Add an interest',['Clubs & societies','Campus events','Student radio','Student arts']]
};
export function creatorInterestFollowup(interest){
 const [title,inputLabel,suggestions]=Object.hasOwn(interestFollowups,interest)?interestFollowups[interest]:[`More on ${interest}`,'Add a detail',[]];
 return {title,inputLabel,buttonLabel:inputLabel,limit:15,maxLength:60,suggestions};
}
function normalizePreferenceTags(spec,values){
 if(!spec||!Array.isArray(values))throw new Error(`Choose up to ${spec?.limit||25} items for this part of your profile.`);
 const seen=new Set(),result=[];
 for(const value of values){
  if(typeof value!=='string'||!value.trim()||value.trim().length>spec.maxLength)throw new Error(`Keep each item between 1 and ${spec.maxLength} characters.`);
  const clean=value.trim().normalize('NFC'),key=clean.toLowerCase();if(seen.has(key))continue;
  seen.add(key);result.push(spec.suggestions.find(s=>s.toLowerCase()===key)||clean);if(result.length>spec.limit)throw new Error(`Choose up to ${spec.limit} items for this part of your profile.`);
 }
 return result;
}
function interestKey(value){
 const key=normalizePreferenceTags(creatorCommunityGroups.interests,[value])[0];
 if(['__proto__','constructor','prototype','Food & drink'].includes(key))throw new Error('Use the cuisine choices for food and drink, or name another interest.');
 return key;
}
export function normalizeCreatorInterestTags(interest,values){return normalizePreferenceTags(creatorInterestFollowup(interestKey(interest)),values);}
export function normalizeCreatorCommunityTags(group,values){return normalizePreferenceTags(Object.hasOwn(creatorCommunityGroups,group)?creatorCommunityGroups[group]:null,values);}
export const creatorSpecificReferenceLimits={limit:15,maxLength:120,groups:256};
export function normalizeCreatorSpecificItems(values){return normalizePreferenceTags({...creatorSpecificReferenceLimits,suggestions:[]},values);}
export function creatorSpecificSuggestions(interest,detail){
 const branches=Object.hasOwn(referencePresets,interest)?referencePresets[interest]:null;
 return branches&&Object.hasOwn(branches,detail)?[...branches[detail]]:[];
}
function validatedPlaceSubmissions(values,saved=[]){
 if(!Array.isArray(values)||values.length>25)throw new Error('Keep up to twenty-five place review drafts.');
 const ids=new Set(),names=new Set();return values.map(value=>{
  if(!value||typeof value!=='object'||typeof value.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(value.id)||ids.has(value.id)||value.status!=='draft'||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt)))throw new Error('Use a valid local place review draft.');
  const name=normalizeCreatorCommunityTags('favouriteSpots',[value.name])[0],area=limitedText(value.area??'',180),folded=name.toLowerCase();
  if(names.has(folded))throw new Error('Keep one review draft for each place.');ids.add(value.id);names.add(folded);
  return {...saved.find(item=>item.id===value.id),id:value.id,name,area,status:'draft',createdAt:new Date(value.createdAt).toISOString()};
 });
}
export function draftCreatorPlaceSubmission(values,name,area='',options={}){
 const current=validatedPlaceSubmissions(values),clean=normalizeCreatorCommunityTags('favouriteSpots',[name])[0];
 if(current.some(item=>item.name.toLowerCase()===clean.toLowerCase()))return current;
 return validatedPlaceSubmissions([...current,{id:options.id||crypto.randomUUID(),name:clean,area,status:'draft',createdAt:options.createdAt||new Date().toISOString()}],current);
}

export function creatorPickedEntities(values,items){
 if(!Array.isArray(values)||values.length>25)throw new Error('Keep source details attached to your selected favourites.');
 const seen=new Set();return values.flatMap(value=>{
  if(!value||typeof value.name!=='string'||!['place','artist','book','film','game','person','event','organisation','other'].includes(value.kind)||value.provider!=='openai-web-search'||typeof value.url!=='string'||value.url.length>2000||!safeURL(value.url))throw new Error('Choose a search result with a valid source link.');
  const name=items.find(item=>item.toLowerCase()===value.name.toLowerCase());if(!name||seen.has(name))return [];seen.add(name);
  return [{name,kind:value.kind,url:safeURL(value.url),provider:'openai-web-search'}];
 });
}
function referencePath(interest,detail){return JSON.stringify([interest.toLowerCase(),detail.toLowerCase()]);}
function validateCreatorSpecificReferences(saved,patch){
 if(!Array.isArray(patch)||patch.length>creatorSpecificReferenceLimits.groups)throw new Error('Keep specific favourites in up to 256 detail groups.');
 const seen=new Set();return patch.map(entry=>{
  if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('Attach each favourite to an interest and a detail.');
  const interest=normalizeCreatorCommunityTags('interests',[entry.interest])[0];
  const detail=(interest==='Food & drink'?normalizeCreatorCommunityTags('cuisines',[entry.detail]):normalizeCreatorInterestTags(interest,[entry.detail]))[0];
  const path=referencePath(interest,detail);if(seen.has(path))throw new Error('Keep one favourites list for each interest and detail.');seen.add(path);
  const existing=Array.isArray(saved)?saved.find(value=>typeof value.interest==='string'&&typeof value.detail==='string'&&referencePath(value.interest,value.detail)===path):null;
  const items=normalizeCreatorSpecificItems(entry.items);return {...existing,interest,detail,items,entities:creatorPickedEntities(Object.hasOwn(entry,'entities')?entry.entities:existing?.entities||[],items)};
 }).filter(entry=>entry.items.length);
}
export function activeCreatorSpecificReferences(profile){
 const details=getCreatorCommunity(profile);
 return details.interestReferences.filter(entry=>details.interests.includes(entry.interest)&&(entry.interest==='Food & drink'?details.cuisines:details.interestDetails[entry.interest]||[]).includes(entry.detail)&&entry.items.length);
}
export function getCreatorCommunity(profile){
 const saved=profile.communityDetails||{};
 return {...saved,version:saved.version||1,...Object.fromEntries(Object.keys(creatorCommunityGroups).map(group=>[group,Array.isArray(saved[group])?saved[group].filter(value=>typeof value==='string').slice():[]])),interestDetails:Object.fromEntries(Object.entries(saved.interestDetails||{}).filter(([,values])=>Array.isArray(values)).map(([key,values])=>[key,values.filter(value=>typeof value==='string').slice()])),interestReferences:Array.isArray(saved.interestReferences)?saved.interestReferences.filter(entry=>entry&&typeof entry.interest==='string'&&typeof entry.detail==='string'&&Array.isArray(entry.items)).map(entry=>({...entry,items:entry.items.filter(value=>typeof value==='string').slice(),entities:Array.isArray(entry.entities)?entry.entities.map(entity=>({...entity})):[]})):[],favouriteSpotEntities:Array.isArray(saved.favouriteSpotEntities)?saved.favouriteSpotEntities.map(entity=>({...entity})):[]};
}
function saveCreatorCommunity(profile,patch){
 const saved=profile.communityDetails||{};supportedVersion(saved,'These profile details');supportedVersion(patch,'These profile details');
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw new Error('Choose profile details to save.');
 const next={...saved,version:1};
 for(const group of Object.keys(creatorCommunityGroups))next[group]=normalizeCreatorCommunityTags(group,Object.hasOwn(patch,group)?patch[group]:saved[group]||[]);
 const incoming=patch.interestDetails??{};
 if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))throw new Error('Save interest details as lists under each interest.');
 const merged={...saved.interestDetails,...incoming};
 if(Object.keys(merged).length>64)throw new Error('Keep details for up to sixty-four interests.');
 const seen=new Set();next.interestDetails=Object.fromEntries(Object.entries(merged).map(([key,values])=>{
  const interest=interestKey(key),folded=interest.toLowerCase();if(seen.has(folded))throw new Error('Keep one detail list for each interest.');seen.add(folded);
  return [interest,normalizeCreatorInterestTags(interest,values)];
 }));
 if(Object.hasOwn(patch,'interestReferences'))next.interestReferences=validateCreatorSpecificReferences(saved.interestReferences,patch.interestReferences);
 if(Object.hasOwn(patch,'placeSubmissions'))next.placeSubmissions=validatedPlaceSubmissions(patch.placeSubmissions,saved.placeSubmissions||[]);
 next.favouriteSpotEntities=creatorPickedEntities(Object.hasOwn(patch,'favouriteSpotEntities')?patch.favouriteSpotEntities:saved.favouriteSpotEntities||[],next.favouriteSpots);
 return next;
}
function exportCreatorCommunity(profile){const details=getCreatorCommunity(profile);return {version:1,...Object.fromEntries(Object.keys(creatorCommunityGroups).map(group=>[group,[...details[group]]])),interestDetails:Object.fromEntries(Object.entries(details.interestDetails).map(([key,values])=>[key,[...values]])),interestReferences:details.interestReferences.map(({interest,detail,items,entities})=>({interest,detail,items:[...items],entities:creatorPickedEntities(entities||[],items)})),favouriteSpotEntities:creatorPickedEntities(details.favouriteSpotEntities,details.favouriteSpots),...(details.placeSubmissions?.length?{placeSubmissions:validatedPlaceSubmissions(details.placeSubmissions).map(({id,name,area,status,createdAt})=>({id,name,area,status,createdAt}))}:{})};}

export function getCreatorProfile(state){
 const saved=state.creatorProfile||{};
 return {...saved,version:saved.version||1,...Object.fromEntries(creatorFields.map(key=>[key,typeof saved[key]==='string'?saved[key]:''])),archetypes:Array.isArray(saved.archetypes)?saved.archetypes.filter(id=>creatorArchetypes.some(([value])=>value===id)):[],personas:Array.isArray(saved.personas)?saved.personas.map(persona=>({...persona})):[],socialChannels:Array.isArray(saved.socialChannels)?saved.socialChannels.map(channel=>({...channel})):[],channels:(saved.channels||[]).filter(id=>voiceChannels.some(([value])=>value===id)),formats:(saved.formats||[]).filter(id=>creatorFormats.some(([value])=>value===id)),step:creatorSteps.some(([id])=>id===saved.step)?saved.step:'about',status:'draft'};
}
export function creatorLinks(profile){
 return String(profile.linksText||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(value=>{const url=safeURL(value);if(!url)throw new Error('Use a complete http or https link on each line, without embedded credentials.');return url;});
}
export function saveCreatorProfile(state,patch){
 supportedVersion(state.creatorProfile,'This profile');const profile=getCreatorProfile(state),next={...profile,version:1,status:'draft'};
 for(const key of creatorFields)if(Object.hasOwn(patch,key))next[key]=limitedText(patch[key],['name','location','customArchetype'].includes(key)?180:4000);
 if(Object.hasOwn(patch,'socialChannels'))next.socialChannels=normalizeCreatorSocialChannels(patch.socialChannels,profile.socialChannels);
 if(Object.hasOwn(patch,'archetypes'))next.archetypes=checkedIds(patch.archetypes,creatorArchetypes);
 if(Object.hasOwn(patch,'personas')){
  if(!Array.isArray(patch.personas)||patch.personas.length>10)throw new Error('Keep up to ten creative personas in this draft.');
  const ids=new Set();next.personas=patch.personas.map(persona=>{
   if(!persona||typeof persona.id!=='string'||!persona.id.trim()||persona.id.length>100||ids.has(persona.id))throw new Error('Each persona needs its own stable ID.');
   ids.add(persona.id);const existing=profile.personas.find(saved=>saved.id===persona.id);
   return {...existing,id:persona.id,name:limitedText(persona.name??'',180),description:limitedText(persona.description??'',2000),context:limitedText(persona.context??'',500)};
  });
 }
 for(const [key,choices]of [['channels',voiceChannels],['formats',creatorFormats]])if(Object.hasOwn(patch,key))next[key]=checkedIds(patch[key],choices);
 if(Object.hasOwn(patch,'step')){if(!creatorSteps.some(([id])=>id===patch.step))throw new Error('Choose a profile section.');next.step=patch.step;}
 if(Object.hasOwn(patch,'studio'))next.studio=validateCreatorStudio(getCreatorStudio(profile),patch.studio);
 if(Object.hasOwn(patch,'communityDetails'))next.communityDetails=saveCreatorCommunity(profile,patch.communityDetails);
 creatorLinks(next);return {...state,creatorProfile:next};
}
export function creatorSemanticDocument(profile){
 const studio=exportCreatorStudio(profile),communityDetails=exportCreatorCommunity(profile);
 const communityPreferencesText=[profile.location?`Based in: ${profile.location}`:'',...Object.entries(creatorCommunityGroups).map(([key,spec])=>communityDetails[key].length&&(key!=='cuisines'||communityDetails.interests.includes('Food & drink'))?`${spec.title}: ${communityDetails[key].join(', ')}`:''),...Object.entries(communityDetails.interestDetails).map(([interest,values])=>communityDetails.interests.includes(interest)&&values.length?`${creatorInterestFollowup(interest).title}: ${values.join(', ')}`:''),...activeCreatorSpecificReferences(profile).map(({interest,detail,items})=>`${interest} → ${detail}: ${items.join(', ')}`)].filter(Boolean).join('\n\n');
 const describe=c=>[c.name,c.bio,c.interests,...creatorArchetypes.filter(([id])=>c.archetypeSeeds.includes(id)).map(([,label])=>label),c.archetype,c.voice,c.world,c.shadow,c.masks,c.complexes,c.context].filter(Boolean).join('\n\n');
 const characterText=studio.characters.map(describe).filter(Boolean).join('\n\n');
 const personaText=studio.characters.slice(1).map(describe).filter(Boolean).join('\n\n');
 const referenceText=studio.characters.flatMap(c=>c.collections.map(list=>[c.name,list.space,list.kind,list.title,...list.items.flatMap(item=>[item.title,item.note])].filter(Boolean).join('\n'))).join('\n\n');
 const localContextText=[profile.localArea,profile.localPull].filter(Boolean).join('\n\n');
 const socialContextText=[profile.socialCircle,profile.sharedLife].filter(Boolean).join('\n\n');
 const audienceText=[profile.audience,profile.community,profile.returningPull].filter(Boolean).join('\n\n'),workText=[profile.about,profile.perspective].filter(Boolean).join('\n\n');
 return {version:1,kind:'creator',socialChannels:(profile.socialChannels||[]).map(({id,platform,value})=>({id,platform,value})),characterText,personaText,referenceText,characters:studio.characters,communityDetails,communityPreferencesText,socialContextText,localContextText,audienceText,workText,text:[characterText,referenceText,workText,communityPreferencesText,socialContextText,localContextText,audienceText,profile.collaborations,profile.boundaries].filter(Boolean).join('\n\n'),channels:[...profile.channels],formats:[...profile.formats],location:profile.location,characterBasis:'creator-authored',archetypeBasis:profile.studio?'creator-authored':'self-selected-creative-role',traitBasis:'author-set-character-description',preferencesBasis:'creator-selected-and-authored',socialContextBasis:'creator-described-social-circle',localContextBasis:'creator-described-local-connections',audienceBasis:'creator-described',embeddingStatus:'not-connected'};
}
export function creatorProfileExport(state){
 const profile=getCreatorProfile(state);
 return {version:1,status:'draft',profile:{version:1,status:'draft',step:profile.step,...Object.fromEntries(creatorFields.map(key=>[key,profile[key]])),archetypes:[...profile.archetypes],personas:profile.personas.map(({id,name,description,context})=>({id,name,description,context})),studio:exportCreatorStudio(profile),communityDetails:exportCreatorCommunity(profile),socialChannels:profile.socialChannels.map(({id,platform,value})=>({id,platform,value})),channels:[...profile.channels],formats:[...profile.formats],links:creatorLinks(profile)},semanticDocument:creatorSemanticDocument(profile),publishing:'not-connected'};
}


export const creatorSocialPlatforms=['Instagram','TikTok','YouTube','Twitch','X','LinkedIn','Substack','Newsletter','Website','Other'];
export function normalizeCreatorSocialChannels(values,saved=[]){
 if(!Array.isArray(values)||values.length>12)throw new Error('Add up to twelve channels.');
 const ids=new Set(),entries=new Set();return values.map(channel=>{
  if(!channel||typeof channel.id!=='string'||!channel.id.trim()||channel.id.length>100||ids.has(channel.id))throw new Error('Give each channel its own entry.');ids.add(channel.id);
  const platform=limitedText(channel.platform??'Other',60).trim()||'Other',value=limitedText(channel.value??'',300).trim().normalize('NFC');
  if(!value||/[\u0000-\u001f\u007f-\u009f]/.test(platform+value)||/^[a-z][a-z0-9+.-]*:/i.test(value)&&!safeURL(value))throw new Error('Use a handle, email or public http/https link.');
  return {...saved.find(item=>item.id===channel.id),id:channel.id,platform,value};
 }).filter(channel=>{const key=JSON.stringify([channel.platform.toLowerCase(),channel.value.toLowerCase()]);if(entries.has(key))return false;entries.add(key);return true;});
}
// View depth changes presentation, not the saved preference hierarchy.
export function editCreatorInterest(details,{level,interest,detail='',value,selected=true}){
 const current=getCreatorCommunity({communityDetails:details});
 const toggle=(values,name,normalize)=>normalize(selected?[...values,name]:values.filter(item=>item.toLowerCase()!==name.toLowerCase()));
 if(level==='interest'){
  const name=normalizeCreatorCommunityTags('interests',[interest])[0];if(['__proto__','constructor','prototype'].includes(name))throw new Error('Choose another interest name.');
  return saveCreatorCommunity({communityDetails:current},{interests:toggle(current.interests,name,values=>normalizeCreatorCommunityTags('interests',values))});
 }
 const name=normalizeCreatorCommunityTags('interests',[interest])[0],food=name==='Food & drink';
 if(['__proto__','constructor','prototype'].includes(name))throw new Error('Choose another interest name.');
 const normalizeDetails=values=>food?normalizeCreatorCommunityTags('cuisines',values):normalizeCreatorInterestTags(name,values);
 const branch=food?current.cuisines:current.interestDetails[name]||[];
 if(level==='detail'){
  const choice=normalizeDetails([detail])[0],values=toggle(branch,choice,normalizeDetails);
  return saveCreatorCommunity({communityDetails:current},food?{cuisines:values}:{interestDetails:{[name]:values}});
 }
 if(level!=='reference')throw new Error('Choose a preference level.');
 const choice=normalizeDetails([detail])[0],entries=[...current.interestReferences],index=entries.findIndex(entry=>referencePath(entry.interest,entry.detail)===referencePath(name,choice));
 const old=index>=0?entries[index]:{interest:name,detail:choice,items:[],entities:[]};
 const item=normalizeCreatorSpecificItems([value])[0],entry={...old,items:toggle(old.items,item,normalizeCreatorSpecificItems)};
 if(index>=0)entries[index]=entry;else entries.push(entry);
 return saveCreatorCommunity({communityDetails:current},{interestReferences:entries});
}
