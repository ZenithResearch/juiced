import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,getCreatorProfile,creatorSteps,saveCreatorProfile,creatorProfileExport,editCreatorInterest} from '../src/model.js';
import {creatorView} from '../src/creator-view.js';

test('About you is the new starting point while earlier saved sections remain stable',()=>{
 assert.equal(getCreatorProfile(emptyState()).step,'about');assert.deepEqual(creatorSteps.map(([id])=>id),['about','voice','people','work']);
 for(const step of ['voice','people','work'])assert.equal(getCreatorProfile({creatorProfile:{version:1,step}}).step,step);
 const state=saveCreatorProfile(emptyState(),{name:'A pseudonym',location:'London',step:'about',socialCircle:'My friends',about:'My existing work',linksText:'https://example.test/portfolio'});
 const about=creatorView(state),characters=creatorView(saveCreatorProfile(state,{step:'voice'})),community=creatorView(saveCreatorProfile(state,{step:'people'})),work=creatorView(saveCreatorProfile(state,{step:'work'}));
 assert.ok(about.includes('A pseudonym is welcome.'));assert.ok(about.includes('name="name"'));assert.ok(about.includes('name="location"'));assert.ok(about.includes('data-edit-interests'));assert.ok(!about.includes('Who do you spend your time with?'));
 assert.ok(characters.includes('profiles brands will be able to discover you through'));assert.ok(characters.includes('data-character-space-nav'));assert.ok(!characters.includes('name="name"'));assert.ok(community.includes('Who do you spend your time with?'));assert.ok(!community.includes('data-edit-interests'));assert.ok(work.includes('My existing work'));assert.ok(work.includes('https://example.test/portfolio'));
});
test('social channels are optional and independent, validated atomically and safely exported',()=>{
 const original=saveCreatorProfile(emptyState(),{name:'A pseudonym',linksText:'https://example.test/old',channels:['online'],formats:['video']});
 assert.deepEqual(getCreatorProfile(original).socialChannels,[]);const row={id:'social-one',platform:'Instagram',value:'@pseudonym'};
 const state=saveCreatorProfile(original,{socialChannels:[row]});state.creatorProfile.socialChannels[0].localNote='private';
 const next=saveCreatorProfile(state,{socialChannels:[{...row,value:'@newhandle'},{id:'social-two',platform:'Newsletter',value:'hello@example.test'}]});assert.equal(next.creatorProfile.socialChannels[0].localNote,'private');assert.equal(next.creatorProfile.linksText,original.creatorProfile.linksText);assert.deepEqual(next.creatorProfile.channels,['online']);assert.equal(next.creatorProfile.name,'A pseudonym');
 const packet=creatorProfileExport(next);assert.equal(packet.profile.socialChannels.length,2);assert.equal(packet.profile.socialChannels[0].localNote,undefined);assert.deepEqual(packet.semanticDocument.socialChannels,packet.profile.socialChannels);assert.ok(!packet.semanticDocument.characterText.includes('@newhandle'));
 const before=JSON.stringify(next);for(const socialChannels of [[row,row],[{...row,value:'javascript:alert(1)'}],[{...row,value:'https://user:password@example.test'}],[{...row,value:''}],[{...row,id:''}]]){assert.throws(()=>saveCreatorProfile(next,{name:'Do not save',socialChannels}));assert.equal(JSON.stringify(next),before);}
});
test('recursive interest edits retain hidden favourites, sources and unrelated profile data',()=>{
 const entity={name:'Alice Coltrane',kind:'artist',url:'https://example.org/alice',provider:'openai-web-search'};
 const saved=saveCreatorProfile(emptyState(),{communityDetails:{interests:['Music'],interestDetails:{Music:['Jazz']},interestReferences:[{interest:'Music',detail:'Jazz',items:['Alice Coltrane'],entities:[entity]}],favouriteSpots:['My café']}}).creatorProfile.communityDetails,before=JSON.stringify(saved);
 const hidden=editCreatorInterest(saved,{level:'interest',interest:'Music',selected:false});assert.deepEqual(hidden.interests,[]);assert.deepEqual(hidden.interestReferences[0].entities,[entity]);assert.deepEqual(hidden.favouriteSpots,['My café']);assert.equal(JSON.stringify(saved),before);
 const restored=editCreatorInterest(hidden,{level:'interest',interest:'Music'}),custom=editCreatorInterest(restored,{level:'detail',interest:'Music',detail:'Cosmic jazz'}),specific=editCreatorInterest(custom,{level:'reference',interest:'Music',detail:'Cosmic jazz',value:'My favourite local band'});
 assert.deepEqual(specific.interestDetails.Music,['Jazz','Cosmic jazz']);assert.equal(specific.interestReferences.length,2);
 const cuisine=editCreatorInterest(specific,{level:'detail',interest:'Food & drink',detail:'Italian'});assert.deepEqual(cuisine.cuisines,['Italian']);assert.deepEqual(cuisine.interestDetails.Music,['Jazz','Cosmic jazz']);
 assert.throws(()=>editCreatorInterest(saved,{level:'interest',interest:'__proto__'}));assert.equal(JSON.stringify(saved),before);
 const cleared=editCreatorInterest(saved,{level:'reference',interest:'Music',detail:'Jazz',value:'Alice Coltrane',selected:false});assert.deepEqual(cleared.interestReferences,[]);assert.deepEqual(saved.interestReferences[0].items,['Alice Coltrane']);
});
