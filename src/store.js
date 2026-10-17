const database=new Promise((resolve,reject)=>{
 const request=indexedDB.open('juiced-brand-workspace',1);
 request.onupgradeneeded=()=>{request.result.createObjectStore('state');request.result.createObjectStore('files');};
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error);
});
export async function transaction(store,mode,action){
 const db=await database;
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,mode),request=action(tx.objectStore(store));
  tx.oncomplete=()=>resolve(request?.result);
  tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage cancelled'));
 });
}
export const load=()=>transaction('state','readonly',s=>s.get('current'));
export const save=state=>transaction('state','readwrite',s=>s.put(state,'current'));
export async function addFiles(state,files){
 const db=await database;
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['state','files'],'readwrite');
  for(const [id,file] of files)tx.objectStore('files').put(file,id);
  tx.objectStore('state').put(state,'current');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Files could not be saved'));
 });
}
export const file=id=>transaction('files','readonly',s=>s.get(id));
export async function deleteAsset(state,id){
 const db=await database;
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['state','files'],'readwrite');tx.objectStore('files').delete(id);tx.objectStore('state').put(state,'current');
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Asset could not be removed'));
 });
}

