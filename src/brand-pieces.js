// Output definitions, not questionnaires or claims of connected generation.
// A worksheet can be added with {id,title,href}; no worksheet is installed here.
export const brandPieces=[
 {id:'brand-book',title:'Brand book',description:'The character, beliefs and point of view that hold the world together.',path:'notes/brand-book',contains:['Positioning and beliefs','The emotional and sensory character','Guidance for people extending the brand'],roles:['Brand strategist','Creative director'],worksheets:[]},
 {id:'characters',title:'People & characters',description:'The people drawn into your world: their motives, personality and part in the story.',path:'notes/people-and-characters',contains:['Desires, tensions and personality','Relationships with the brand','Protagonists, antagonists and the people in between'],roles:['Customer researcher','Narrative director','Writers'],worksheets:[]},
 {id:'voice',title:'Voice & story',description:'A language of your own. The story and the way it is told.',path:'notes/voice-and-story',contains:['Narrative, voice and vocabulary','Messages and copy examples','What the brand would and would never say'],roles:['Narrative director','Copywriter'],worksheets:[]},
 {id:'identity',title:'Visual identity',description:'Colour, type and imagery that make the character felt.',path:'notes/visual-identity',contains:['Art direction and references','Palette, typography and image language','Logo and identity assets'],roles:['Art director','Graphic designer','Visual researcher'],worksheets:[]},
 {id:'design-system',title:'Design system',description:'The foundations for consistent websites, interfaces and creative work.',path:'notes/design-system',contains:['Semantic colours, type and spacing','Components and interaction states','Accessibility and implementation guidance'],roles:['Visual systems designer','Component designer','UX/UI designer'],worksheets:[]},
 {id:'creative-assets',kind:'collection',title:'Creative assets',description:'The working pieces other people can pick up and make something with.',contains:['Photography, illustration and film','Templates and reusable brand material','Production-ready exports'],roles:['Graphic designer','Filmmaker','Studio team'],worksheets:[]}
];
export function pieceState(state,pieceId){return state.world?.pieces?.[pieceId]||{assetIds:[]};}
export function connectPiece(state,pieceId,assetIds){
 if(!brandPieces.some(p=>p.id===pieceId))throw new Error('Unknown brand piece');
 const available=new Set(state.assets.map(a=>a.id));
 const ids=[...new Set(assetIds)].filter(id=>available.has(id));
 return {...state,world:{...state.world,pieces:{...state.world?.pieces,[pieceId]:{...pieceState(state,pieceId),assetIds:ids}}}};
}
export function capturePath(relativeName){
 const parts=relativeName.replaceAll('\\','/').split('/').filter(p=>p&&p!=='.'&&p!=='..');
 return 'capture/'+(parts.join('/')||'untitled');
}
export function worksheetPath(value){
 return typeof value==='string'&&/^worksheets\/[\w/-]+\.html$/.test(value)?value:null;
}
