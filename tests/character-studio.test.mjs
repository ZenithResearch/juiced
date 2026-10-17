import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,getCreatorProfile,getCreatorStudio,newCreativeCharacter,saveCreatorProfile,creatorProfileExport} from '../src/model.js';
import {creatorView} from '../src/creator-view.js';
const studio=(characters=[newCreativeCharacter('one')],activeSpace='profile')=>({version:1,characters,activeCharacterId:characters[0].id,activeSpace});
const collection={id:'reading',kind:'bookshelf',space:'shadow',title:'What haunts them',items:[{id:'book-one',title:'A book title',note:'An unresolved longing.',url:'https://example.test/book',imageURL:''}]};

test('an empty optional studio is projected without writing state or assigning traits',()=>{
 const state=emptyState(),before=JSON.stringify(state),draft=getCreatorStudio(getCreatorProfile(state));
 assert.equal(draft.characters.length,1);assert.equal(draft.characters[0].bio,'');assert.ok(Object.values(draft.characters[0].traits.bigFive).every(value=>value===null));assert.equal(JSON.stringify(state),before);
 const saved=saveCreatorProfile(state,{studio:draft});assert.equal(saved.creatorProfile.studio.characters[0].name,'');assert.equal(saved.creatorProfile.status,'draft');assert.equal(saved.brand,state.brand);assert.equal(saved.assets,state.assets);
});
test('earlier character prose and personas become editable characters without deleting their sources',()=>{
 const old={...emptyState(),creatorProfile:{version:1,name:'Studio',character:'Old bio',customArchetype:'A role of my own',voiceDescription:'An old voice',archetypes:['explorer'],personas:[{id:'old',name:'Another',description:'Their story',context:'A film'}],about:'Existing work',linksText:'https://example.test/work',formats:['writing'],channels:['online'],step:'voice'}};
 const before=JSON.stringify(old),draft=getCreatorStudio(getCreatorProfile(old));assert.equal(draft.characters[0].bio,'Old bio');assert.equal(draft.characters[1].id,'persona-old');assert.equal(draft.characters[1].context,'A film');
 draft.characters[0].bio='Revised bio';draft.characters[1].shadow='A hidden need';const next=saveCreatorProfile(old,{studio:draft});
 assert.equal(JSON.stringify(old),before);assert.deepEqual(next.creatorProfile.personas,old.creatorProfile.personas);assert.equal(next.creatorProfile.character,'Old bio');assert.deepEqual(next.creatorProfile.archetypes,['explorer']);assert.equal(next.creatorProfile.about,'Existing work');
 const packet=creatorProfileExport(next);assert.ok(packet.semanticDocument.characterText.includes('Revised bio'));assert.ok(packet.semanticDocument.characterText.includes('A hidden need'));assert.ok(!packet.semanticDocument.characterText.includes('Old bio'));assert.equal(packet.semanticDocument.archetypeBasis,'creator-authored');
 const view=creatorView(next);assert.ok(view.includes('Earlier archetype selections'));assert.ok(!view.includes('Choose your archetypes'));assert.ok(view.includes('Archetype starting points'));
});
test('characters own independent spaces, traits and typed collections; edits preserve stable identities',()=>{
 const a=newCreativeCharacter('one',{name:'First',shadow:'A fear of stillness',collections:[collection]}),b=newCreativeCharacter('two',{name:'Second',world:'A city after rain'});
 a.traits.bigFive.openness=0;a.traits.bigFive.agreeableness=100;a.traits.myersBriggs.ei=50;
 let state=saveCreatorProfile(emptyState(),{studio:studio([a,b],'shadow')});state.creatorProfile.studio.characters[0].internalNote='private';state.creatorProfile.studio.characters[0].collections[0].items[0].privateNote='local only';
 const draft=getCreatorStudio(getCreatorProfile(state));draft.activeCharacterId='two';draft.activeSpace='world';draft.characters[1].world='The same city, years later.';
 const next=saveCreatorProfile(state,{studio:draft}),packet=creatorProfileExport(next),first=packet.profile.studio.characters[0];
 assert.equal(first.traits.bigFive.openness,0);assert.equal(first.traits.bigFive.agreeableness,100);assert.equal(first.traits.myersBriggs.ei,50);assert.equal(first.traits.myersBriggs.sn,null);assert.equal(first.collections[0].items[0].id,'book-one');assert.equal(first.collections[0].space,'shadow');
 assert.equal(next.creatorProfile.studio.characters[0].internalNote,'private');assert.equal(first.internalNote,undefined);assert.equal(first.collections[0].items[0].privateNote,undefined);assert.equal(packet.semanticDocument.characters[0].internalNote,undefined);assert.equal(packet.semanticDocument.traitBasis,'author-set-character-description');assert.equal(packet.semanticDocument.embeddingStatus,'not-connected');
 assert.equal(packet.profile.studio.characters[1].world,'The same city, years later.');assert.equal(state.creatorProfile.studio.characters[1].world,'A city after rain');
 draft.characters[0].traits.bigFive.openness=null;assert.equal(saveCreatorProfile(state,{studio:draft}).creatorProfile.studio.characters[0].traits.bigFive.openness,null);
});
test('invalid trait positions, references, identities and newer studios fail atomically',()=>{
 const initial=saveCreatorProfile(emptyState(),{studio:studio([newCreativeCharacter('one',{collections:[collection]})])}),before=JSON.stringify(initial);
 const invalid=[s=>s.characters[0].traits.bigFive.openness=-1,s=>s.characters[0].traits.bigFive.openness=101,s=>s.characters[0].traits.bigFive.openness='50',s=>s.characters[0].traits.myersBriggs.ei=NaN,s=>s.characters.push({...s.characters[0]}),s=>s.activeCharacterId='missing',s=>s.activeSpace='diagnosis',s=>s.version=2,s=>s.characters[0].collections[0].kind='invented',s=>s.characters[0].collections[0].items[0].url='javascript:alert(1)',s=>s.characters[0].collections[0].items[0].imageURL='https://user:pass@example.test/p.png',s=>s.characters[0].collections[0].items.push({...s.characters[0].collections[0].items[0]})];
 for(const mutate of invalid){const draft=structuredClone(initial.creatorProfile.studio);mutate(draft);assert.throws(()=>saveCreatorProfile(initial,{name:'Do not save',studio:draft}));assert.equal(JSON.stringify(initial),before);}
 assert.throws(()=>saveCreatorProfile({...initial,creatorProfile:{...initial.creatorProfile,studio:{...initial.creatorProfile.studio,version:2}}},{studio:studio()}));
});
test('authored characters and collection captions render escaped in every optional space',()=>{
 const unsafe='<img src=x onerror=alert(1)>',c=newCreativeCharacter('one',{name:unsafe,bio:unsafe,shadow:unsafe,collections:[{...collection,title:unsafe,items:[{...collection.items[0],title:unsafe,note:unsafe}]}]});
 const state=saveCreatorProfile(emptyState(),{step:'voice',studio:studio([c],'shadow')});const view=creatorView(state),preview=creatorView(state,true);
 for(const html of [view,preview]){assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));}
 assert.ok(view.includes('data-character-space-nav="shadow" aria-pressed="true"'));assert.ok(view.includes('Every space is optional'));assert.ok(view.includes('Bookshelf'));
 const traits=creatorView(saveCreatorProfile(state,{studio:{...state.creatorProfile.studio,activeSpace:'personality'}}));assert.ok(traits.includes('Big Five'));assert.ok(traits.includes('Myers–Briggs'));assert.equal((traits.match(/data-trait-set="false"/g)||[]).length,9);assert.ok(!traits.includes('ENFP'));
});

test('optional archetype starting points belong to a character and never replace authored prose or other spaces',()=>{
 const a=newCreativeCharacter('one',{archetype:'My own particular role',bio:'A biography',shadow:'A hidden need',archetypeSeeds:['explorer','storyteller']}),b=newCreativeCharacter('two');
 const initial=saveCreatorProfile(emptyState(),{studio:studio([a,b])}),draft=getCreatorStudio(getCreatorProfile(initial));
 draft.characters[0].archetypeSeeds=['trickster','host','trickster'];const next=saveCreatorProfile(initial,{studio:draft});
 assert.deepEqual(next.creatorProfile.studio.characters[0].archetypeSeeds,['trickster','host']);assert.equal(next.creatorProfile.studio.characters[0].archetype,'My own particular role');assert.equal(next.creatorProfile.studio.characters[0].shadow,'A hidden need');assert.deepEqual(next.creatorProfile.studio.characters[1].archetypeSeeds,[]);assert.deepEqual(initial.creatorProfile.studio.characters[0].archetypeSeeds,['explorer','storyteller']);
 const packet=creatorProfileExport(next);assert.deepEqual(packet.profile.studio.characters[0].archetypeSeeds,['trickster','host']);assert.ok(packet.semanticDocument.characterText.includes('The Trickster'));assert.ok(packet.semanticDocument.characterText.includes('My own particular role'));
 const before=JSON.stringify(next);draft.characters[0].archetypeSeeds=['invented'];assert.throws(()=>saveCreatorProfile(next,{studio:draft}));assert.equal(JSON.stringify(next),before);
 draft.characters[0].archetypeSeeds=[];assert.deepEqual(saveCreatorProfile(next,{studio:draft}).creatorProfile.studio.characters[0].archetypeSeeds,[]);
});
