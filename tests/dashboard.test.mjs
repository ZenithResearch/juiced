import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../src/model.js';
import {connectPiece} from '../src/brand-pieces.js';
import {dashboardData,setCurrentPiece} from '../src/dashboard-model.js';
import {dashboardView} from '../src/dashboard-view.js';

test('source references alone do not make a brand deliverable available',()=>{
 const initial=emptyState();initial.assets=[{id:'source',name:'Research.pdf'}];
 const state=connectPiece(initial,'brand-book',['source']);
 const book=dashboardData(state).pieces.find(p=>p.id==='brand-book');
 assert.equal(book.status,'Missing');assert.equal(book.references.length,1);assert.equal(dashboardData(state).available,0);
});
test('an explicitly selected current asset is available and becomes missing if its source disappears',()=>{
 const initial=emptyState();initial.assets=[{id:'book',name:'Brand book.pdf'}];
 const selected=setCurrentPiece(initial,'brand-book','book');
 assert.equal(dashboardData(selected).available,1);assert.equal(dashboardData({...selected,assets:[]}).available,0);
 assert.equal(dashboardData(setCurrentPiece(selected,'brand-book','')).available,0);
 assert.throws(()=>setCurrentPiece(initial,'brand-book','missing'));
});
test('dashboard renders the saved brand without seeding or mutating it',()=>{
 const live=emptyState(),before=JSON.stringify(live);
 dashboardView(live);
 assert.equal(JSON.stringify(live),before);
 assert.ok(!dashboardView(live).includes('Example collaborator'));
 assert.equal(dashboardData(live).team.length,0);
});
test('dashboard escapes brand and asset content',()=>{
 const state=emptyState();state.brand.name='<img src=x onerror=alert(1)>';
 assert.ok(dashboardView(state).includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert.ok(!dashboardView(state).includes('<img src=x onerror'));
});

test('creative assets are a selected collection, separate from raw uploads and required definitions',()=>{
 const state=emptyState();state.assets=[{id:'photo',name:'Photo.jpg'},{id:'video',name:'Film.mp4'}];
 const empty=dashboardData(state);assert.equal(empty.definitionCount,5);
 assert.equal(empty.pieces.find(p=>p.id==='creative-assets').status,'Empty');
 const selected=connectPiece(state,'creative-assets',['photo','video']);
 // An old saved current ID can coexist with the collection without changing the source record.
 selected.world.pieces['creative-assets'].currentAssetId='photo';
 const collection=dashboardData(selected).pieces.find(p=>p.id==='creative-assets');
 assert.equal(collection.status,'2 assets');assert.equal(collection.current,null);assert.equal(collection.path,undefined);
 assert.equal(dashboardData(selected).available,0);assert.equal(selected.world.pieces['creative-assets'].currentAssetId,'photo');
 assert.equal(dashboardData({...selected,assets:[]}).pieces.find(p=>p.id==='creative-assets').status,'Empty');
});
test('older records without invitation drafts retain an empty team and invitation list',()=>{
 const state=emptyState(),before=JSON.stringify(state),d=dashboardData(state);
 assert.deepEqual(d.invitationDrafts,[]);assert.deepEqual(d.team,[]);assert.equal(JSON.stringify(state),before);
});
