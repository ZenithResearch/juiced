import {createStaticServer} from './server.mjs';
const server=await createStaticServer();
const port=Number(process.env.PORT||4323),host=process.env.HOST||'127.0.0.1';
server.listen(port,host,()=>console.log(`Juiced production build: http://${host}:${port}`));
