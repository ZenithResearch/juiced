import test from 'node:test';
import assert from 'node:assert/strict';
import {action,field,pill,assetRow,steps,notice,safeHref} from '../src/ui/components.js';

test('component output preserves authored text without executable markup or unsafe navigation',()=>{
 const attack='<img src=x onerror="alert(1)">';
 for(const html of [action({label:attack}),field({id:'test-field',label:attack,value:'</textarea><script>x</script>',multiline:true}),pill({label:attack}),assetRow({title:attack,detail:attack,href:'#asset'})]){
  assert.doesNotMatch(html,/<img|<script/);assert.match(html,/&lt;/);
 }
 for(const href of ['javascript:alert(1)','data:text/html,x','//elsewhere.test','https://user:pass@example.com','https://example.com/\nfile','\\evil.test'])assert.throws(()=>safeHref(href));
 assert.equal(safeHref('workspace.html#world'),'workspace.html#world');
 assert.equal(safeHref('https://example.com/?q=a&b=c'),'https://example.com/?q=a&amp;b=c');
 assert.throws(()=>field({id:'bad" onclick="x',label:'Name'}));
});
test('navigation, busy actions, invalid fields and section selection expose their actual semantics',()=>{
 assert.match(action({label:'Open',href:'#world'}),/^<a[^>]*href="#world"/);
 const unavailable=action({label:'Open',href:'#world',disabled:true});assert.doesNotMatch(unavailable,/href=/);assert.match(unavailable,/aria-disabled="true"/);
 const busy=action({label:'Saving',busy:true});assert.match(busy,/aria-busy="true"/);assert.match(busy,/ disabled/);
 assert.throws(()=>action({label:'Open',href:'#world',busy:true}));
 const invalid=field({id:'link',label:'Link',hint:'Use https',error:'Check address',value:'keep this'});
 assert.match(invalid,/aria-describedby="link-hint link-error"/);assert.match(invalid,/aria-invalid="true"/);assert.match(invalid,/value="keep this"/);
 const sections=steps({items:[{label:'One',href:'#one'},{label:'Two',href:'#two'}],current:1});assert.equal((sections.match(/aria-current="step"/g)||[]).length,1);assert.doesNotMatch(sections,/role="tab/);
 assert.doesNotMatch(notice({text:'Saved'}),/role=/);assert.match(notice({text:'Failed',tone:'error',live:true}),/role="alert"/);
});
