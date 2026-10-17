import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,getCreatorProfile,getCreatorCommunity,normalizeCreatorCommunityTags,saveCreatorProfile,creatorProfileExport} from '../src/model.js';
import {creatorView} from '../src/creator-view.js';

test('optional creator preferences preserve old local answers and remain distinct from character and audience descriptions',()=>{
 const state=saveCreatorProfile(emptyState(),{name:'A studio',location:'Existing city',socialCircle:'My friends',localArea:'Earlier connection',localPull:'Earlier possibility',audience:'Existing followers'}),before=JSON.stringify(state);
 assert.deepEqual(getCreatorCommunity(getCreatorProfile(state)),{version:1,interests:[],cuisines:[],favouriteSpots:[],interestDetails:{},interestReferences:[],favouriteSpotEntities:[]});assert.equal(JSON.stringify(state),before);
 const next=saveCreatorProfile(state,{communityDetails:{interests:[' Film ','film','Zine making'],cuisines:['italian','Japanese'],favouriteSpots:['The reading room']}});
 assert.deepEqual(next.creatorProfile.communityDetails.interests,['Film','Zine making']);assert.equal(next.creatorProfile.location,'Existing city');assert.equal(next.creatorProfile.localPull,'Earlier possibility');assert.equal(next.creatorProfile.audience,'Existing followers');assert.equal(next.world,state.world);
 next.creatorProfile.communityDetails.privateNote='Retain locally';const revised=saveCreatorProfile(next,{communityDetails:{cuisines:[]}});assert.equal(revised.creatorProfile.communityDetails.privateNote,'Retain locally');assert.deepEqual(revised.creatorProfile.communityDetails.interests,['Film','Zine making']);
 const packet=creatorProfileExport(revised);assert.equal(packet.profile.communityDetails.privateNote,undefined);assert.equal(packet.semanticDocument.communityDetails.privateNote,undefined);assert.ok(packet.semanticDocument.communityPreferencesText.includes('Zine making'));assert.ok(packet.semanticDocument.communityPreferencesText.includes('The reading room'));assert.ok(!packet.semanticDocument.audienceText.includes('Zine making'));assert.equal(packet.semanticDocument.preferencesBasis,'creator-selected-and-authored');
 const cleared=saveCreatorProfile(revised,{communityDetails:{interests:[],cuisines:[],favouriteSpots:[]}});assert.deepEqual(cleared.creatorProfile.communityDetails.interests,[]);assert.equal(cleared.creatorProfile.localArea,'Earlier connection');
});
test('custom preferences normalize safely and invalid or future-version writes fail atomically',()=>{
 assert.deepEqual(normalizeCreatorCommunityTags('cuisines',[' Italian ','italian','Nikkei']),['Italian','Nikkei']);
 const state=saveCreatorProfile(emptyState(),{communityDetails:{interests:['Film']}}),before=JSON.stringify(state);
 for(const details of [{interests:'Film'},{cuisines:['']},{interests:[42]},{interests:['x'.repeat(61)]},{favouriteSpots:['x'.repeat(121)]},{cuisines:Array.from({length:16},(_,i)=>String(i))},{version:2,interests:[]}]){assert.throws(()=>saveCreatorProfile(state,{name:'Do not save',communityDetails:details}));assert.equal(JSON.stringify(state),before);}
 assert.throws(()=>normalizeCreatorCommunityTags('__proto__',[]));assert.throws(()=>normalizeCreatorCommunityTags('unknown',[]));
 assert.throws(()=>saveCreatorProfile({...state,creatorProfile:{...state.creatorProfile,communityDetails:{version:2,interests:['Film']}}},{communityDetails:{interests:[]}}));
});
test('profile details render escaped, allow city entry and remove retired outreach questions without deleting their data',()=>{
 const text='<img src=x onerror=alert(1)>',state=saveCreatorProfile(emptyState(),{step:'about',location:text,localArea:'Old connection',localPull:'Old potential',communityDetails:{interests:[text],cuisines:['Italian'],favouriteSpots:[text]}}),html=creatorView(state),preview=creatorView(state,true);
 for(const view of [html,preview]){assert.ok(view.includes('&lt;img'));assert.ok(!view.includes('<img src=x'));assert.ok(!view.includes('Old potential'));}
 assert.ok(!html.includes('Could you get people to show up?'));assert.ok(!html.includes('Where do you know people?'));assert.ok(html.includes('name="location"'));const characters=creatorView(saveCreatorProfile(state,{step:'voice'}));assert.ok(!characters.includes('name="location"'));assert.ok(characters.includes('profiles brands will be able to discover you through'));assert.ok(html.includes('data-edit-interests'));assert.ok(html.includes('name="community-favouriteSpots"'));assert.equal(creatorProfileExport(state).profile.localPull,'Old potential');
 const work=creatorView(saveCreatorProfile(state,{step:'work'}));assert.ok(!work.includes('name="location"'));assert.equal(getCreatorProfile(state).location,text);
});

test('interest branches retain hidden answers but only selected branches describe current preferences',()=>{
 const initial=saveCreatorProfile(emptyState(),{communityDetails:{interests:['Music','Food & drink'],cuisines:['Italian'],interestDetails:{Music:[' jazz ','Jazz','Dream pop']}}});
 const packet=creatorProfileExport(initial);assert.deepEqual(packet.profile.communityDetails.interestDetails.Music,['Jazz','Dream pop']);assert.ok(packet.semanticDocument.communityPreferencesText.includes('Dream pop'));assert.ok(packet.semanticDocument.communityPreferencesText.includes('Italian'));
 const hidden=saveCreatorProfile(initial,{communityDetails:{interests:[]}}),exported=creatorProfileExport(hidden);
 assert.deepEqual(exported.profile.communityDetails.interestDetails.Music,['Jazz','Dream pop']);assert.deepEqual(exported.profile.communityDetails.cuisines,['Italian']);assert.ok(!exported.semanticDocument.communityPreferencesText.includes('Dream pop'));assert.ok(!exported.semanticDocument.communityPreferencesText.includes('Italian'));
 const restored=saveCreatorProfile(hidden,{communityDetails:{interests:['Music']}});assert.ok(creatorProfileExport(restored).semanticDocument.communityPreferencesText.includes('Dream pop'));
 const custom=saveCreatorProfile(restored,{communityDetails:{interests:['Zine making'],interestDetails:{'Zine making':['Risograph']}}});assert.ok(creatorProfileExport(custom).semanticDocument.communityPreferencesText.includes('Risograph'));
 assert.deepEqual(custom.creatorProfile.communityDetails.interestDetails.Music,['Jazz','Dream pop']);
});
test('invalid nested detail writes are atomic, optional empty details remain valid, and authored labels are escaped',()=>{
 const state=saveCreatorProfile(emptyState(),{communityDetails:{interests:['Music']}}),before=JSON.stringify(state);
 for(const interestDetails of [[],{Music:'Jazz'},{Music:['x'.repeat(61)]},{Music:[22]},{Music:Array.from({length:16},(_,i)=>String(i))},JSON.parse('{"__proto__": ["bad"]}')]){assert.throws(()=>saveCreatorProfile(state,{name:'No write',communityDetails:{interestDetails}}));assert.equal(JSON.stringify(state),before);}
 const text='<img src=x onerror=alert(1)>',custom=saveCreatorProfile(state,{step:'about',communityDetails:{interests:[text],interestDetails:{[text]:['Good']}}}),html=creatorView(custom);
 assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));assert.ok(creatorView(custom,true).includes('Good'));
 const cleared=saveCreatorProfile(state,{communityDetails:{interestDetails:{Music:[]}}});assert.deepEqual(cleared.creatorProfile.communityDetails.interestDetails.Music,[]);
});

test('specific favourites retain their parent path, legacy preferences and inactive references across partial updates',()=>{
 const original=saveCreatorProfile(emptyState(),{name:'Same person',communityDetails:{interests:['Music','Food & drink'],cuisines:['Italian'],interestDetails:{Music:['Jazz','Ambient']}}});
 const next=saveCreatorProfile(original,{communityDetails:{interestReferences:[{interest:'Music',detail:'jazz',items:[' Blue Note ','blue note','Alice Coltrane']},{interest:'Food & drink',detail:'italian',items:['A favourite trattoria']},{interest:'Music',detail:'Ambient',items:['Blue Note']}]}});
 assert.equal(next.creatorProfile.name,'Same person');assert.deepEqual(next.creatorProfile.communityDetails.interestReferences[0],{interest:'Music',detail:'Jazz',items:['Blue Note','Alice Coltrane'],entities:[]});
 const packet=creatorProfileExport(next);assert.ok(packet.semanticDocument.communityPreferencesText.includes('Music → Jazz: Blue Note, Alice Coltrane'));assert.ok(packet.semanticDocument.communityPreferencesText.includes('Food & drink → Italian: A favourite trattoria'));
 next.creatorProfile.communityDetails.interestReferences[0].privateNote='Local only';const hidden=saveCreatorProfile(next,{communityDetails:{interestDetails:{Music:['Ambient']},interests:['Music']}}),exported=creatorProfileExport(hidden);
 assert.equal(hidden.creatorProfile.communityDetails.interestReferences.length,3);assert.ok(!exported.semanticDocument.communityPreferencesText.includes('Alice Coltrane'));assert.ok(!exported.semanticDocument.communityPreferencesText.includes('A favourite trattoria'));assert.ok(exported.semanticDocument.communityPreferencesText.includes('Music → Ambient: Blue Note'));assert.equal(exported.profile.communityDetails.interestReferences[0].privateNote,undefined);
 const restored=saveCreatorProfile(hidden,{communityDetails:{interestDetails:{Music:['Jazz','Ambient']}}});assert.ok(creatorProfileExport(restored).semanticDocument.communityPreferencesText.includes('Alice Coltrane'));
 const edited=saveCreatorProfile(restored,{communityDetails:{interestReferences:[{interest:'Music',detail:'Jazz',items:['Alice Coltrane']}]}});assert.equal(edited.creatorProfile.communityDetails.interestReferences[0].privateNote,'Local only');assert.equal(edited.creatorProfile.communityDetails.interestReferences.length,1);
 const cleared=saveCreatorProfile(edited,{communityDetails:{interestReferences:[]}});assert.deepEqual(cleared.creatorProfile.communityDetails.interestReferences,[]);assert.deepEqual(cleared.creatorProfile.communityDetails.interestDetails.Music,['Jazz','Ambient']);
});
test('specific favourites validate atomically, distinguish duplicate paths and escape authored names in editor and preview',()=>{
 const state=saveCreatorProfile(emptyState(),{step:'about',communityDetails:{interests:['Music'],interestDetails:{Music:['Jazz']}}}),before=JSON.stringify(state),entry={interest:'Music',detail:'Jazz',items:['A name']};
 for(const references of [{},[null],[{...entry,items:'A name'}],[{...entry,items:['x'.repeat(121)]}],[{...entry,items:[3]}],[{...entry,items:Array.from({length:16},(_,i)=>String(i))}],[entry,{...entry,detail:'jazz'}],[{...entry,interest:''}],[{...entry,detail:''}]]){assert.throws(()=>saveCreatorProfile(state,{name:'Do not save',communityDetails:{interestReferences:references}}));assert.equal(JSON.stringify(state),before);}
 const text='<img src=x onerror=alert(1)>',safe=saveCreatorProfile(state,{communityDetails:{interestReferences:[{...entry,items:[text]}]}});
 for(const html of [creatorView(safe),creatorView(safe,true)]){assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img'));}
 assert.ok(creatorView(safe).includes('data-open-interest="Music"'));assert.ok(!creatorView(safe).includes('Specific favourites for Jazz'));
 const empty=saveCreatorProfile(state,{communityDetails:{interestReferences:[{...entry,items:[]}]}});assert.deepEqual(empty.creatorProfile.communityDetails.interestReferences,[]);
});
