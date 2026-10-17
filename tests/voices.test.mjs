import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,audienceCharacters,saveAudienceCharacter,getVoicesSearch,saveVoicesSearch,prepareVoicesSearch,voicesSearchContext,voiceSearchIsCurrent,getCreatorProfile,saveCreatorProfile,creatorProfileExport} from '../src/model.js';
import {dashboardData} from '../src/dashboard-model.js';
import {voicesView,audienceEditor} from '../src/voices-view.js';
import {creatorView} from '../src/creator-view.js';
const character={id:'character-one',name:'A working portrait',situation:'They are opening a second shop.',desire:'Keep the feeling of the first one.',interests:'Small publications and local makers.',outlook:'Curious, careful with promises.',basis:'imagined'};

test('old workspaces load empty Voices and creator drafts without mutation or seeded profiles',()=>{
 const state=emptyState(),before=JSON.stringify(state);
 assert.deepEqual(audienceCharacters(state),[]);assert.equal(getVoicesSearch(state).mode,'character');assert.equal(getCreatorProfile(state).name,'');
 assert.equal(JSON.stringify(state),before);assert.throws(()=>prepareVoicesSearch(state));assert.equal(state.creatorProfile,undefined);
});
test('audience characters retain authored evidence and update independently of finished brand outputs',()=>{
 const state=emptyState();state.world={team:[{name:'Existing teammate'}],pieces:{voice:{assetIds:[]}},brandQuestionnaire:{version:2,answers:{firstPull:'Existing words'}}};
 const next=saveAudienceCharacter(state,character);assert.equal(audienceCharacters(next).length,1);assert.deepEqual(audienceCharacters(next)[0],{version:1,...character});assert.equal(dashboardData(next).available,0);
 assert.equal(next.world.team,state.world.team);assert.equal(next.world.pieces,state.world.pieces);assert.equal(next.world.brandQuestionnaire,state.world.brandQuestionnaire);assert.equal(next.brand,state.brand);
 const revised=saveAudienceCharacter(next,{id:character.id,desire:'A revised desire'});assert.equal(audienceCharacters(revised).length,1);assert.equal(audienceCharacters(revised)[0].situation,character.situation);assert.equal(audienceCharacters(next)[0].desire,character.desire);
 for(const patch of [{...character,id:''},{...character,situation:''},{...character,basis:'verified'},{...character,desire:'x'.repeat(4001)}])assert.throws(()=>saveAudienceCharacter(state,patch));assert.equal(state.world.audienceCharacters,undefined);
});
test('business and character routes produce distinct explicit semantic inputs, not invented matches',()=>{
 let state=saveAudienceCharacter(emptyState(),character);state.brand.description='Existing business description';
 state=saveVoicesSearch(state,{mode:'character',characterId:character.id,campaignContext:'An opening night.',channels:['irl','irl']});
 const prepared=prepareVoicesSearch(state),packet=prepared.world.voicesSearchHandoff;assert.equal(packet.context.source.kind,'audience-character');assert.equal(packet.context.source.character.desire,character.desire);assert.equal(packet.context.source.character.basis,'imagined');assert.ok(packet.context.semanticDocument.includes('An opening night.'));assert.deepEqual(packet.context.channels,['irl']);assert.deepEqual(packet.results,[]);assert.equal(packet.retrieval.status,'not-connected');assert.ok(voiceSearchIsCurrent(prepared));
 const edited=saveAudienceCharacter(prepared,{id:character.id,desire:'Another desire'});assert.equal(edited.world.voicesSearchHandoff.status,'needs-update');assert.equal(packet.context.source.character.desire,character.desire);
 const business=prepareVoicesSearch(saveVoicesSearch(state,{mode:'business',businessContext:'  We make things for curious shopkeepers.  '}));assert.deepEqual(business.world.voicesSearchHandoff.context.source,{kind:'business',name:'',description:'  We make things for curious shopkeepers.  '});assert.ok(!business.world.voicesSearchHandoff.context.semanticDocument.includes(character.desire));
 assert.equal(saveVoicesSearch(prepared,{campaignContext:'Changed'}).world.voicesSearchHandoff.status,'needs-update');assert.ok(!voiceSearchIsCurrent({...prepared,brand:{...prepared.brand,name:'Renamed'}}));
 assert.throws(()=>saveVoicesSearch(state,{characterId:'unknown'}));assert.throws(()=>saveVoicesSearch(state,{channels:['unsupported']}));assert.throws(()=>prepareVoicesSearch(saveVoicesSearch(state,{mode:'business',businessContext:''})));
 const missing={...prepared,world:{...prepared.world,audienceCharacters:[]}};assert.equal(getVoicesSearch(missing).characterId,'');assert.ok(!voiceSearchIsCurrent(missing));assert.throws(()=>prepareVoicesSearch(missing));
});
test('creator profile remains an unpublished independent draft and preserves earlier steps and raw descriptions',()=>{
 const state=saveAudienceCharacter(emptyState(),character),before=JSON.stringify(state);
 const first=saveCreatorProfile(state,{name:'A real input',about:'  A body of work.  ',perspective:'A point of view',step:'people',status:'published'});
 first.creatorProfile.internalNotes='Preserve locally, not part of this export';
 const second=saveCreatorProfile(first,{audience:'People who return for the work.',community:'A shared interest.',step:'work'});
 const final=saveCreatorProfile(second,{linksText:'https://example.test/work\nhttps://example.test/social',channels:['online'],formats:['video'],collaborations:'Make something with care.',boundaries:'Room for an honest voice.'});
 const packet=creatorProfileExport(final);assert.equal(packet.status,'draft');assert.equal(packet.publishing,'not-connected');assert.equal(packet.profile.status,'draft');assert.equal(packet.profile.about,'  A body of work.  ');assert.equal(packet.profile.links.length,2);assert.equal(final.creatorProfile.internalNotes,'Preserve locally, not part of this export');assert.equal(packet.profile.internalNotes,undefined);assert.equal(packet.semanticDocument.audienceBasis,'creator-described');assert.equal(packet.semanticDocument.embeddingStatus,'not-connected');assert.equal(packet.semanticDocument.audienceText,'People who return for the work.\n\nA shared interest.');
 assert.equal(final.brand,state.brand);assert.equal(final.world,state.world);assert.equal(final.assets,state.assets);assert.equal(JSON.stringify(state),before);assert.equal(final.creatorProfile.step,'work');
});
test('invalid links, IDs and newer versions cannot partially replace stored profile or search evidence',()=>{
 const state=saveCreatorProfile(emptyState(),{name:'Keep this',linksText:'https://example.test/work'}),before=JSON.stringify(state);
 for(const linksText of ['javascript:alert(1)','https://user:password@example.test','file:///tmp/image','https://example.test/work\nnot-a-url'])assert.throws(()=>saveCreatorProfile(state,{name:'Should not save',linksText}));
 assert.throws(()=>saveCreatorProfile(state,{formats:['invented']}));assert.throws(()=>saveCreatorProfile(state,{name:'x'.repeat(181)}));assert.equal(JSON.stringify(state),before);
 assert.throws(()=>saveCreatorProfile({...state,creatorProfile:{version:2}},{}));assert.throws(()=>saveVoicesSearch({...state,world:{voicesSearch:{version:2}}},{}));assert.throws(()=>saveAudienceCharacter({...state,world:{audienceCharacters:[{...character,version:2}]}},character));
});
test('new views escape authored material and present honest empty, draft and unconnected states',()=>{
 const dangerous='<img src=x onerror=alert(1)>',state=saveAudienceCharacter(emptyState(),{...character,name:dangerous,situation:dangerous});
 const network=voicesView(saveVoicesSearch(state,{mode:'description',description:dangerous}));assert.ok(network.includes('&lt;img'));assert.ok(!network.includes('<img src=x'));assert.ok(network.includes('aren’t connected'));assert.ok(!network.includes('Your business'));
 const empty=voicesView(emptyState());assert.ok(empty.includes('Character description'));assert.ok(!empty.includes('Create an audience character'));assert.ok(!empty.includes('Your business'));assert.ok(!empty.includes('98%'));
 const creator=saveCreatorProfile(state,{name:dangerous,about:dangerous,audience:dangerous});const preview=creatorView(creator,true);assert.ok(preview.includes('&lt;img'));assert.ok(!preview.includes('<img src=x'));assert.ok(preview.includes('Unpublished draft'));assert.ok(preview.includes('Community described by the creator'));
 assert.ok(audienceEditor({...character,name:'" onfocus="bad'}).includes('&quot; onfocus=&quot;bad'));
});

test('everyday social-circle descriptions stay distinct from earlier community and audience descriptions',()=>{
 const original=saveCreatorProfile(emptyState(),{community:'An existing community interest',returningPull:'An existing reason to return',audience:'People following the work',step:'people'});
 const next=saveCreatorProfile(original,{socialCircle:'Friends who make music and restore old bikes.',sharedLife:'We cook, swap records and ride out together.'});
 assert.equal(getCreatorProfile(original).socialCircle,'');assert.equal(getCreatorProfile(original).sharedLife,'');
 assert.equal(next.creatorProfile.community,original.creatorProfile.community);assert.equal(next.creatorProfile.returningPull,original.creatorProfile.returningPull);assert.equal(next.creatorProfile.audience,original.creatorProfile.audience);assert.equal(next.world,original.world);
 const packet=creatorProfileExport(next);assert.equal(packet.profile.socialCircle,next.creatorProfile.socialCircle);assert.equal(packet.profile.sharedLife,next.creatorProfile.sharedLife);assert.equal(packet.semanticDocument.socialContextBasis,'creator-described-social-circle');assert.ok(packet.semanticDocument.socialContextText.includes('restore old bikes'));assert.ok(!packet.semanticDocument.audienceText.includes('restore old bikes'));assert.ok(packet.semanticDocument.audienceText.includes('People following the work'));
 const empty=saveCreatorProfile(next,{socialCircle:'',sharedLife:''});assert.equal(empty.creatorProfile.socialCircle,'');assert.equal(empty.creatorProfile.community,'An existing community interest');assert.throws(()=>saveCreatorProfile(next,{socialCircle:'x'.repeat(4001)}));
});

test('local connection descriptions support small accounts without becoming verified audience claims',()=>{
 const original=saveCreatorProfile(emptyState(),{socialCircle:'Friends around campus',sharedLife:'Food and music',audience:'Existing followers',community:'Existing community note',step:'people'});
 assert.equal(getCreatorProfile(original).localArea,'');assert.equal(getCreatorProfile(original).localPull,'');
 const next=saveCreatorProfile(original,{localArea:'  A university town.  ',localPull:'I could invite friends to try a local pizza place.'});
 assert.equal(next.creatorProfile.socialCircle,original.creatorProfile.socialCircle);assert.equal(next.creatorProfile.audience,original.creatorProfile.audience);assert.equal(next.creatorProfile.community,original.creatorProfile.community);assert.equal(next.world,original.world);
 const packet=creatorProfileExport(next);assert.equal(packet.profile.localArea,'  A university town.  ');assert.equal(packet.profile.localPull,next.creatorProfile.localPull);assert.ok(packet.semanticDocument.localContextText.includes('local pizza place'));assert.equal(packet.semanticDocument.localContextBasis,'creator-described-local-connections');assert.ok(!packet.semanticDocument.audienceText.includes('local pizza place'));assert.equal(packet.semanticDocument.embeddingStatus,'not-connected');
 const cleared=saveCreatorProfile(next,{localArea:'',localPull:''});assert.equal(cleared.creatorProfile.localArea,'');assert.equal(cleared.creatorProfile.localPull,'');assert.equal(cleared.creatorProfile.audience,'Existing followers');assert.throws(()=>saveCreatorProfile(next,{localPull:'x'.repeat(4001)}));
});
