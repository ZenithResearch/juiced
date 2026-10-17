import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {project,securityHeaders} from './build.mjs';
const mime={'.png':'image/png','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
export async function createStaticServer({root=path.join(project,'dist'),files}={}){
 const folder=await realpath(root);
 const names=new Set(files||(JSON.parse(await readFile(path.join(project,'.qa/build-manifest.json'),'utf8'))).files);
 return createServer(async(req,res)=>{
  const headers={...securityHeaders,'Cache-Control':'public, max-age=0, must-revalidate'};
  try{
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{...headers,Allow:'GET, HEAD'});res.end();return;}
   const route=decodeURIComponent(new URL(req.url,'http://release.local').pathname);
   const name=route==='/'?'index.html':route.slice(1);
   if(!names.has(name)||name.includes('\\')){const body=await readFile(path.join(folder,'404.html'));res.writeHead(404,{...headers,'Content-Type':mime['.html']});res.end(req.method==='HEAD'?undefined:body);return;}
   const filename=await realpath(path.join(folder,name));if(!filename.startsWith(folder+path.sep))throw Error('Invalid file');
   const body=await readFile(filename),etag='"'+createHash('sha256').update(body).digest('hex').slice(0,24)+'"';
   if(req.headers['if-none-match']===etag){res.writeHead(304,{...headers,ETag:etag});res.end();return;}
   res.writeHead(200,{...headers,'Content-Type':mime[path.extname(name)]||'application/octet-stream','Content-Length':body.length,ETag:etag});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404,{...headers,'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
 });
}
