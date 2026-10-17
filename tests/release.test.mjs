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

test('social previews have a traced, fetchable PNG and page-specific alpha metadata',async()=>{
 const source=path.join(project,'src'),origin='https://juiced.zenith-research.ca';
 const png=await readFile(path.join(source,'social-card-v1.png'));
 assert.equal(png.subarray(1,4).toString(),'PNG');
 assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
 assert.ok(png.length<1024*1024,'Keep the share image under 1 MB.');
 for(const [name,url] of [['index.html',origin+'/'],['workspace.html',origin+'/workspace.html']]){
  const html=await readFile(path.join(source,name),'utf8');
  const metas=Object.fromEntries([...html.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)">/g)].map(m=>[m[1],m[2]]));
  assert.equal(metas['og:type'],'website');assert.equal(metas['og:url'],url);
  assert.equal(metas['og:image'],origin+'/social-card-v1.png');
  assert.equal(metas['og:image:type'],'image/png');assert.equal(metas['og:image:width'],'1200');assert.equal(metas['og:image:height'],'630');
  assert.ok(metas['og:image:alt']);assert.match(metas['og:title'],/Alpha/);
  assert.match(metas['og:description'],/not ready for production|Alpha testing only/);
  assert.equal(metas['twitter:card'],'summary_large_image');assert.equal(metas['twitter:image'],metas['og:image']);
  assert.ok(references(html,name).includes('social-card-v1.png'));
 }
 const root=path.join(project,'.qa/social-test-dist'),manifest=await build({out:root});
 assert.ok(manifest.files.includes('social-card-v1.png'));assert.ok(!manifest.files.some(name=>name.startsWith('design/')));
 const server=await createStaticServer({root,files:manifest.files});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/social-card-v1.png`);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
test('social discovery only traces declared same-origin images',()=>{
 assert.deepEqual(references('<meta content="https://juiced.zenith-research.ca/social-card-v1.png" property="og:image">','index.html'),['social-card-v1.png']);
 assert.deepEqual(references('<meta name="twitter:image" content="/social-card-v1.png">','workspace.html'),['social-card-v1.png']);
 assert.deepEqual(references('<meta property="og:image" content="https://example.com/other.png"><meta property="og:title" content="not-an-image.png">','index.html'),[]);
 assert.deepEqual(references('<meta property="og:image" content="https://user:pass@juiced.zenith-research.ca/private.png">','index.html'),[]);
});
