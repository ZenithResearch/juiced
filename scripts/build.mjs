import {readFile,writeFile,mkdir,rm,copyFile,realpath,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const project=fileURLToPath(new URL('../',import.meta.url));
export const siteOrigin='https://juiced.zenith-research.ca';
export const entries=['index.html','workspace.html','404.html','robots.txt'];
export const securityHeaders={
 'X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex, nofollow, noarchive',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'X-Frame-Options':'DENY',
 'Permissions-Policy':'camera=(self), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
function localReference(value,owner){
 if(!value||value.startsWith('#')||/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)||value.includes('${')||value.startsWith('var('))return null;
 const clean=value.split(/[?#]/)[0];if(!clean)return null;
 const relative=clean.startsWith('/')?clean.slice(1):path.posix.join(path.posix.dirname(owner),clean);
 const name=path.posix.normalize(relative||'index.html');
 if(name.startsWith('../')||name.split('/').some(part=>part.startsWith('.'))||name.includes('\\'))throw new Error(`Unsafe source reference in ${owner}`);
 return name;
}
export function references(text,name){
 const values=[];
 if(name.endsWith('.html')){
  for(const match of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g))values.push(match[1]);
  // Social images live in meta content, outside normal href/src discovery.
  // Trace only our declared image fields; never fetch external URLs.
  for(const match of text.matchAll(/<meta\s+[^>]*>/gi)){
   const attrs=Object.fromEntries([...match[0].matchAll(/([\w:]+)=["']([^"']*)["']/g)].map(part=>[part[1].toLowerCase(),part[2]]));
   if(!['og:image','og:image:secure_url','twitter:image'].includes(attrs.property||attrs.name))continue;
   if(!attrs.content)continue;
   const image=new URL(attrs.content,siteOrigin);
   if(image.origin===siteOrigin&&!image.username&&!image.password)values.push(image.pathname);
  }
 }
 if(name.endsWith('.css')){for(const match of text.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g))values.push(match[1]);}
 if(name.endsWith('.js')){for(const match of text.matchAll(/^\s*import\s+(?:[^;\n]*?\sfrom\s+)?["']([^"']+)["']/gm))values.push(match[1]);}
 return values.map(value=>localReference(value,name)).filter(Boolean);
}
export async function build({source=path.join(project,'src'),out=path.join(project,'dist'),roots=entries}={}){
 const sourceRoot=await realpath(source),files=new Set(),queue=[...roots];
 while(queue.length){const name=queue.shift();if(files.has(name))continue;
  if(/(?:^|\/)(?:review|workshop|opening-|name-study|lucid-study|component-library|hand-|creator-autocomplete)/i.test(name))throw new Error(`Internal artifact referenced by the release: ${name}`);
  const target=await realpath(path.resolve(sourceRoot,name));if(!target.startsWith(sourceRoot+path.sep))throw new Error(`Source escapes release root: ${name}`);
  if(!(await stat(target)).isFile())throw new Error(`Expected a source file: ${name}`);
  files.add(name);
  if(/\.(?:html|css|js)$/.test(name))queue.push(...references(await readFile(target,'utf8'),name));
 }
 // out is an explicit generated artifact, never the source or repository root.
 const output=path.resolve(out);if(output===sourceRoot||output===path.resolve(project)||sourceRoot.startsWith(output+path.sep))throw new Error('Unsafe build output');
 await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
 let bytes=0;
 for(const name of [...files].sort()){const target=path.join(output,name);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(sourceRoot,name),target);bytes+=(await stat(target)).size;}
 // The font licence accompanies redistributed font files even though it is not a page resource.
 if([...files].some(name=>name.endsWith('.ttf'))){const licence='fonts/manrope-OFL.txt';await copyFile(path.join(sourceRoot,licence),path.join(output,licence));files.add(licence);}
 const headers='/*\n'+Object.entries(securityHeaders).map(([key,value])=>`  ${key}: ${value}`).join('\n')+'\n  Cache-Control: public, max-age=0, must-revalidate\n';
 await writeFile(path.join(output,'_headers'),headers);
 const manifest={files:[...files].sort(),bytes};
 await mkdir(path.join(project,'.qa'),{recursive:true});
 if(output===path.join(project,'dist'))await writeFile(path.join(project,'.qa/build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await build();console.log(`Built ${result.files.length} approved files (${(result.bytes/1024).toFixed(1)} KB) into dist/.`);
}
