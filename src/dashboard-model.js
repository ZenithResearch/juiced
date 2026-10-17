import {brandPieces,pieceState,connectPiece} from './brand-pieces.js';

export function dashboardData(state){
 const assets=state.assets||[];
 const pieces=brandPieces.map(definition=>{
  const saved=pieceState(state,definition.id),references=assets.filter(a=>saved.assetIds.includes(a.id));
  const collection=definition.kind==='collection';
  const current=collection?null:references.find(a=>a.id===saved.currentAssetId)||null;
  return {...definition,references,current,status:collection?(references.length?references.length+' '+(references.length===1?'asset':'assets'):'Empty'):current?'Available':'Missing'};
 });
 return {brand:state.brand,pieces,available:pieces.filter(p=>p.current).length,definitionCount:pieces.filter(p=>p.kind!=='collection').length,assets,team:state.world?.team||[],invitationDrafts:state.world?.invitationDrafts||[],requests:state.world?.requests||[]};
}
export function setCurrentPiece(state,pieceId,assetId){
 if(assetId&&!state.assets.some(a=>a.id===assetId))throw new Error('Choose material from Capture');
 const old=pieceState(state,pieceId);
 const connected=connectPiece(state,pieceId,assetId?[...old.assetIds,assetId]:old.assetIds);
 return {...connected,world:{...connected.world,pieces:{...connected.world.pieces,[pieceId]:{...connected.world.pieces[pieceId],currentAssetId:assetId||null}}}};
}

