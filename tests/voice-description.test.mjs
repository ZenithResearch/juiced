import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,saveAudienceCharacter,saveCreatorProfile,saveVoicesSearch,getVoicesSearch,prepareVoicesSearch,voiceSearchIsCurrent,voiceDescriptionWordCount,voiceSearchDescriptionLimit} from '../src/model.js';
import {voicesView} from '../src/voices-view.js';
const words=n=>Array.from({length:n},(_,i)=>`word${i+1}`).join(' ');

test('free-form drafts preserve verbatim description, allow partial input and require 400 words to prepare',()=>{
 assert.equal(voiceDescriptionWordCount('  hello\nworld  — ... '),2);
 assert.equal(voiceDescriptionWordCount(''),0);assert.equal(voiceDescriptionWordCount('café 東京 hello-world'),3);
 const partial=saveVoicesSearch(emptyState(),{mode:'description',description:words(399)});
 assert.equal(getVoicesSearch(partial).description,words(399));assert.throws(()=>prepareVoicesSearch(partial),/400 words/);
 const raw='  '+words(400)+'\n';const saved=saveVoicesSearch(partial,{description:raw});const prepared=prepareVoicesSearch(saved),packet=prepared.world.voicesSearchHandoff;
 assert.equal(packet.context.source.kind,'character-description');assert.equal(packet.context.source.description,raw);assert.equal(packet.context.semanticDocument,raw);
 assert.equal(packet.retrieval.limit,5);assert.equal(packet.retrieval.status,'not-connected');assert.deepEqual(packet.results,[]);assert.ok(voiceSearchIsCurrent(prepared));
 assert.equal(JSON.parse(JSON.stringify(prepared)).world.voicesSearch.description,raw);
 assert.equal(saveVoicesSearch(prepared,{description:words(401)}).world.voicesSearchHandoff.status,'needs-update');
 assert.ok(!voiceSearchIsCurrent(saveVoicesSearch(prepared,{description:''})));
});

test('new description route retains legacy evidence but does not inject it into the new character input',()=>{
 let original=saveAudienceCharacter(emptyState(),{id:'old-character',name:'Old',situation:'Existing situation',desire:'Existing desire'});
 original=saveCreatorProfile(original,{name:'Existing creator'});
 original=saveVoicesSearch(original,{mode:'business',businessContext:'Existing business context',campaignContext:'Existing campaign context',channels:['irl']});
 original.world.voicesSearch.internalMetadata={keep:true};const before=JSON.stringify(original);
 const prepared=prepareVoicesSearch(saveVoicesSearch(original,{mode:'description',description:words(400)}));
 assert.equal(prepared.world.voicesSearch.businessContext,'Existing business context');assert.equal(prepared.world.voicesSearch.campaignContext,'Existing campaign context');assert.deepEqual(prepared.world.voicesSearch.channels,['irl']);
 assert.deepEqual(prepared.world.voicesSearch.internalMetadata,{keep:true});assert.equal(prepared.world.audienceCharacters,original.world.audienceCharacters);assert.equal(prepared.creatorProfile,original.creatorProfile);
 assert.deepEqual(Object.keys(prepared.world.voicesSearchHandoff.context).sort(),['semanticDocument','source','version']);
 assert.equal(JSON.stringify(original),before);assert.ok(!prepared.world.voicesSearchHandoff.context.semanticDocument.includes('Existing'));
 const snapshot=JSON.stringify(prepared);
 assert.throws(()=>saveVoicesSearch(prepared,{description:'x'.repeat(voiceSearchDescriptionLimit+1)}));assert.throws(()=>saveVoicesSearch(prepared,{description:42}));
 assert.throws(()=>saveVoicesSearch({...prepared,world:{...prepared.world,voicesSearch:{...prepared.world.voicesSearch,version:2}}},{description:'new'}));assert.equal(JSON.stringify(prepared),snapshot);
});

test('description UI keeps results absent until preparation and never renders fabricated neighbours',()=>{
 const draft=saveVoicesSearch(emptyState(),{mode:'description',description:words(400)}),initial=voicesView(draft);
 assert.match(initial,/id="voices-results"[^>]+hidden/);assert.ok(!initial.includes('Your business'));assert.ok(!initial.includes('Your shortlist'));assert.ok(!initial.includes('Create an audience character'));
 const prepared=voicesView(prepareVoicesSearch(draft));assert.match(prepared,/Five nearest voices/);assert.doesNotMatch(prepared,/id="voices-results"[^>]+hidden/);assert.ok(prepared.includes('aren’t connected'));
 assert.ok(!prepared.includes('data-voice-id'));assert.ok(!prepared.includes('98%'));
});
