import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,getCreatorProfile,saveCreatorProfile,creatorProfileExport} from '../src/model.js';
import {creatorView} from '../src/creator-view.js';
const persona={id:'persona-one',name:'The midnight archivist',description:'A quiet narrator who finds strange histories in ordinary places.',context:'An evening film series.'};

test('creative character fields are additive and older work, audience, community and step retain their meanings',()=>{
 const state=emptyState();state.creatorProfile={version:1,name:'Existing name',about:'Existing work',audience:'Existing people',community:'Existing shared references',linksText:'https://example.test/work',formats:['video'],channels:['online'],step:'people'};
 const before=JSON.stringify(state),profile=getCreatorProfile(state);
 assert.deepEqual(profile.archetypes,[]);assert.deepEqual(profile.personas,[]);assert.equal(profile.character,'');assert.equal(profile.returningPull,'');assert.equal(profile.step,'people');assert.equal(JSON.stringify(state),before);
 const next=saveCreatorProfile(state,{character:'A curious observer.',voiceDescription:'Quiet with a mischievous edge.',archetypes:['explorer','storyteller','explorer'],customArchetype:'The night gardener',returningPull:'A familiar ritual with something unexpected.',personas:[persona]});
 for(const key of ['about','audience','community','linksText','step'])assert.equal(next.creatorProfile[key],state.creatorProfile[key]);assert.deepEqual(next.creatorProfile.archetypes,['explorer','storyteller']);assert.deepEqual(next.creatorProfile.formats,['video']);assert.equal(next.brand,state.brand);assert.equal(next.world,state.world);
 const packet=creatorProfileExport(next);assert.equal(packet.profile.status,'draft');assert.equal(packet.semanticDocument.archetypeBasis,'self-selected-creative-role');assert.ok(packet.semanticDocument.characterText.includes('The Explorer'));assert.ok(packet.semanticDocument.characterText.includes('Quiet with a mischievous edge.'));assert.ok(packet.semanticDocument.personaText.includes(persona.description));assert.ok(packet.semanticDocument.audienceText.includes('Existing shared references'));assert.ok(packet.semanticDocument.audienceText.includes('A familiar ritual'));assert.equal(packet.semanticDocument.workText,'Existing work');
});
test('multiple creative personas update by stable identity and remain separate from the main character and other work',()=>{
 const initial=saveCreatorProfile(emptyState(),{character:'The main creative character',archetypes:['worldbuilder'],personas:[persona,{id:'persona-two',name:'The host',description:'An open, lively presence.',context:'Live gatherings.'}]});
 initial.creatorProfile.personas[0].internalNote='Keep locally';
 const next=saveCreatorProfile(initial,{personas:[{...persona,description:'A revised narrator.'},{id:'persona-two',name:'The host',description:'An open, lively presence.',context:'Live gatherings.'}],step:'work'});
 assert.equal(next.creatorProfile.personas[0].id,'persona-one');assert.equal(next.creatorProfile.personas[0].internalNote,'Keep locally');assert.equal(next.creatorProfile.character,'The main creative character');assert.equal(initial.creatorProfile.personas[0].description,persona.description);
 const packet=creatorProfileExport(next);assert.equal(packet.profile.personas.length,2);assert.equal(packet.profile.personas[0].internalNote,undefined);assert.equal(packet.profile.personas[0].description,'A revised narrator.');
 const withoutOne=saveCreatorProfile(next,{personas:next.creatorProfile.personas.slice(1)});assert.equal(withoutOne.creatorProfile.personas.length,1);assert.equal(withoutOne.creatorProfile.personas[0].id,'persona-two');assert.equal(next.creatorProfile.personas.length,2);
 const before=JSON.stringify(next);
 for(const patch of [{archetypes:['unregistered']},{personas:[persona,persona]},{personas:[{...persona,id:''}]},{personas:[{...persona,description:'x'.repeat(2001)}]},{personas:Array.from({length:11},(_,i)=>({...persona,id:String(i)}))}])assert.throws(()=>saveCreatorProfile(next,patch));
 assert.equal(JSON.stringify(next),before);
});
test('legacy character prose remains safely readable in the optional character studio',()=>{
 const text='<img src=x onerror=alert(1)>',state=saveCreatorProfile(emptyState(),{step:'voice',customArchetype:text,character:text,voiceDescription:text,personas:[{id:'one',name:text,description:text,context:text}]});
 const edit=creatorView(state),preview=creatorView(state,true);
 assert.ok(edit.includes('Your character studio.'));assert.ok(edit.includes('data-character-space-nav="shadow"'));assert.ok(edit.includes('Your community'));assert.ok(!edit.includes('Choose your archetypes'));assert.ok(!edit.includes('Rolodex'));assert.ok(edit.includes('&lt;img'));assert.ok(preview.includes('&lt;img'));assert.ok(!preview.includes('<img src=x'));assert.ok(preview.includes('Archetype'));assert.ok(preview.includes('Where they appear'));
});
