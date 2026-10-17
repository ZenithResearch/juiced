import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,safeURL,removeAsset,handoff,briefText,addInvitationDrafts} from '../src/model.js';

test('only public HTTP references can be linked; credentials and executable schemes are rejected',()=>{
 assert.equal(safeURL('javascript:alert(1)'),null);
 assert.equal(safeURL('https://user:secret@example.com'),null);
 assert.equal(safeURL('file:///etc/passwd'),null);
 assert.equal(safeURL('https://example.com/brand'),'https://example.com/brand');
});
test('collaborator handoff only includes selected material and excludes stored file bodies',()=>{
 const state=emptyState();state.assets=[{id:'one',name:'Brand.pdf',kind:'file',blob:'private'},{id:'two',name:'Unused.pdf',kind:'file'}];state.campaign.assetIds=['one'];
 const brief=handoff(state);assert.equal(brief.assets.length,1);assert.equal(brief.assets[0].name,'Brand.pdf');assert.equal(brief.assets[0].blob,undefined);
});
test('removing a library asset also removes stale campaign references without altering original state',()=>{
 const state=emptyState();state.assets=[{id:'one'},{id:'two'}];state.campaign.assetIds=['one','two'];
 const next=removeAsset(state,'one');assert.deepEqual(next.campaign.assetIds,['two']);assert.deepEqual(next.assets,[{id:'two'}]);assert.equal(state.assets.length,2);
});
test('downloaded brief carries brand, campaign, collaborator roles and selected references',()=>{
 const state=emptyState();state.brand.name='Example brand';state.brand.audience='Independent bookshops';state.campaign.title='Opening night';state.campaign.objective='Bring readers together';state.collaboration.roles=['Creative direction'];state.assets=[{id:'one',name:'Reference',url:'https://example.com'}];state.campaign.assetIds=['one'];
 const text=briefText(state);for(const value of ['Example brand','Opening night','Independent bookshops','Bring readers together','Creative direction','https://example.com'])assert.ok(text.includes(value));
});

test('invitation drafts are normalized, deduplicated and never become team membership',()=>{
 const original=emptyState();original.world={pieces:{},team:[{name:'Existing teammate',email:'member@brand.test'}]};
 const next=addInvitationDrafts(original,['  Person@brand.test ','person@brand.test','member@brand.test']);
 assert.deepEqual(next.world.invitationDrafts,[{email:'person@brand.test'}]);
 assert.equal(next.world.team,original.world.team);assert.equal(next.world.pieces,original.world.pieces);
 assert.equal(original.world.invitationDrafts,undefined);
 assert.equal(addInvitationDrafts(next,['PERSON@brand.test']),next);
});
test('invalid invitation emails do not create a partially saved list',()=>{
 const original=emptyState();
 for(const emails of [[],[''],['a@@brand.test'],['a b@brand.test'],['person@brand.test','invalid']])assert.throws(()=>addInvitationDrafts(original,emails));
 assert.equal(original.world,undefined);
});
