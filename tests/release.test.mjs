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
  assert.match(first.headers.get('content-security-policy'),/worker-src 'none'/);assert.match(first.headers.get('permissions-policy'),/microphone=\(\)/);assert.match(first.headers.get('x-robots-tag'),/noindex/);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
test('local dependency references stay within their source root',()=>{
 assert.deepEqual(references("import './model.js';",'app.js'),['model.js']);
 assert.deepEqual(references("@import url('./tokens.css'); .font{src:url('../fonts/a.ttf')}",'styles/site.css'),['styles/tokens.css','fonts/a.ttf']);
 assert.throws(()=>references("import '../../outside.js';",'app.js'),/Unsafe source reference/);
 assert.deepEqual(references('<a href="https://example.com">Example</a><a href="#top">Top</a>','index.html'),[]);
});

test('alpha notice and no-index status survive every direct HTML entry point',async()=>{
 const pkg=JSON.parse(await readFile(path.join(project,'package.json'),'utf8'));
 for(const name of ['index.html','workspace.html','404.html']){
  const html=await readFile(path.join(project,'src',name),'utf8');
  assert.match(html,/<aside class="alpha-notice" aria-label="Alpha testing notice">/);
  assert.match(html,/Alpha testing — not ready for production\./);
  assert.match(html,/Do not use for real work or add sensitive information\./);
  assert.ok(html.includes('v'+pkg.version));
  assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive">/);
 }
 assert.equal(await readFile(path.join(project,'src/robots.txt'),'utf8'),'User-agent: *\nDisallow: /\n');
});
test('hosted alpha exposes only dist with the same security and no-index headers',async()=>{
 const config=JSON.parse(await readFile(path.join(project,'vercel.json'),'utf8'));
 assert.equal(config.outputDirectory,'dist');assert.equal(config.buildCommand,'npm run build');
 const {securityHeaders}=await import('../scripts/build.mjs');
 const hosted=Object.fromEntries(config.headers[0].headers.map(row=>[row.key,row.value]));
 for(const [key,value] of Object.entries(securityHeaders))assert.equal(hosted[key],value,key);
 assert.ok(!config.rewrites,'Unknown paths must not be rewritten into a success page.');
});
