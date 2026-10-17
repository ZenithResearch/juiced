import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {build,project,references} from '../scripts/build.mjs';
import {createStaticServer} from '../scripts/server.mjs';

test('release traces approved entries and dependencies rather than copying the source root',async()=>{
 const root=path.join(project,'.qa/build-fixture');await mkdir(path.join(root,'src'),{recursive:true});
 await writeFile(path.join(root,'src/index.html'),'<script type="module" src="app.js"></script>');
 await writeFile(path.join(root,'src/app.js'),"import './dep.js';");await writeFile(path.join(root,'src/dep.js'),'export const value=1;');
 await writeFile(path.join(root,'src/workshop.html'),'Never ship this.');await writeFile(path.join(root,'src/.env'),'not a credential');
 const result=await build({source:path.join(root,'src'),out:path.join(root,'dist'),roots:['index.html']});
 assert.deepEqual(result.files,['app.js','dep.js','index.html']);assert.deepEqual((await readdir(path.join(root,'dist'))).sort(),['_headers','app.js','dep.js','index.html']);
 await assert.rejects(build({source:path.join(root,'src'),out:path.join(root,'src'),roots:['index.html']}),/Unsafe build output/);
 await rm(root,{recursive:true,force:true});
});
test('the complete artifact excludes studies, AI proxies, hand tracking and runtime review switches',async()=>{
 const root=path.join(project,'.qa/release-test-dist'),manifest=await build({out:root});
 assert.ok(manifest.files.includes('index.html'));assert.ok(manifest.files.includes('workspace.html'));
 assert.ok(manifest.files.includes('fonts/manrope-OFL.txt'));assert.ok(manifest.files.includes('ui/dialog.js'));
 assert.ok(!manifest.files.some(name=>/workshop|review|opening-|name-study|component-library|hand-|autocomplete|^ui\/components/.test(name)));
 assert.doesNotMatch(await readFile(path.join(root,'art/scene.js'),'utf8'),/URLSearchParams|syntheticCamera|review===/);
 assert.doesNotMatch(await readFile(path.join(root,'art/camera-reflection.js'),'utf8'),/handCamera|syntheticCamera|makeTracker|HandTracker/);
 assert.doesNotMatch(await readFile(path.join(root,'art/optical-renderer.js'),'utf8'),/PointingCalibration|setHandSample|hand-tracker/);
 const server=await createStaticServer({root,files:manifest.files});server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const route of ['/','/workspace.html','/styles/site.css','/art/scene.js']){const response=await fetch(origin+route);assert.equal(response.status,200);assert.equal(response.headers.get('x-content-type-options'),'nosniff');}
  for(const route of ['/review.html','/component-library.html','/opening-comparison.html','/.env','/README.md','/MIGRATION.json','/scripts/build.mjs','/api/autocomplete/status','/docs/production-handoff.json'])assert.equal((await fetch(origin+route)).status,404,route);
  assert.equal((await fetch(origin+'/workspace.html',{method:'POST',body:'nothing'})).status,405);
  const first=await fetch(origin+'/styles/site.css');const etag=first.headers.get('etag');assert.ok(etag);assert.equal((await fetch(origin+'/styles/site.css',{headers:{'If-None-Match':etag}})).status,304);
  assert.match(first.headers.get('content-security-policy'),/worker-src 'none'/);assert.match(first.headers.get('permissions-policy'),/microphone=\(\)/);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
test('local dependency references stay within their source root',()=>{
 assert.deepEqual(references("import './model.js';",'app.js'),['model.js']);
 assert.deepEqual(references("@import url('./tokens.css'); .font{src:url('../fonts/a.ttf')}",'styles/site.css'),['styles/tokens.css','fonts/a.ttf']);
 assert.throws(()=>references("import '../../outside.js';",'app.js'),/Unsafe source reference/);
 assert.deepEqual(references('<a href="https://example.com">Example</a><a href="#top">Top</a>','index.html'),[]);
});
