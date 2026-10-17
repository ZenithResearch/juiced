import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../src/model.js';
import {connectPiece,pieceState,capturePath,worksheetPath} from '../src/brand-pieces.js';

test('brand pieces connect real Capture references without moving or duplicating source files',()=>{
 const state=emptyState();state.assets=[{id:'a',name:'Story.pdf'},{id:'b',name:'Identity.fig'}];
 const next=connectPiece(state,'brand-book',['a','missing','a']);
 assert.deepEqual(pieceState(next,'brand-book').assetIds,['a']);
 assert.equal(next.assets,state.assets);assert.equal(state.world,undefined);
 assert.throws(()=>connectPiece(state,'unknown',['a']));
});
test('Capture preserves nested relative source hierarchy and excludes traversal segments',()=>{
 assert.equal(capturePath('Brand/Identity/logo.svg'),'capture/Brand/Identity/logo.svg');
 assert.equal(capturePath('Brand\\Identity\\logo.svg'),'capture/Brand/Identity/logo.svg');
 assert.equal(capturePath('.././Brand/notes.md'),'capture/Brand/notes.md');
});
test('worksheet slots accept explicit local entries and reject external or executable URLs',()=>{
 assert.equal(worksheetPath('worksheets/brand/voice.html'),'worksheets/brand/voice.html');
 for(const value of ['https://example.com','javascript:alert(1)','worksheets/../secret.html','/worksheets/voice.html'])assert.equal(worksheetPath(value),null);
});
