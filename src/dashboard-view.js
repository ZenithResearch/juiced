import {dashboardData} from './dashboard-model.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=paths=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const plus=svg('<path d="M12 5v14M5 12h14"/>');
const chevron=svg('<path d="m9 5 7 7-7 7"/>');
const icons={
 'brand-book':svg('<path d="M12 5v15M12 6C9 4 5 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-2-1-6-1-9 1Z"/>'),
 characters:svg('<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>'),
 voice:svg('<path d="M4 5h16v11H9l-5 4V5ZM8 9h8M8 12h5"/>'),
 identity:svg('<circle cx="8" cy="8" r="4"/><path d="m16 11 6 10H10l6-10Z"/>'),
 'design-system':svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
 'creative-assets':svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 6-5 4 3 4-5 4 5"/>')
};
export const assetDescriptions={
 'brand-book':'Positioning, values and brand guidelines.',
 characters:'Audience profiles, motivations and personality.',
 voice:'Tone of voice, key messages and writing guidelines.',
 identity:'Logo, colours, typography and image guidelines.',
 'design-system':'Design tokens, components and interface standards.',
 'creative-assets':'Selected photography, video, templates and exports.'
};
export function dashboardView(state){
 const d=dashboardData(state),mark=d.assets.find(a=>a.id===d.brand.logoAssetId&&a.type?.startsWith('image/'));
 const section=(label,action='')=>`<div class="dashboard-section-title"><h2>${label}</h2>${action}</div>`;
 const match=`<button type="button" class="app-button" data-find-teammates>Find teammates</button>`;
 const invite=`<button type="button" class="app-button" data-invite-team>${plus}Invite teammates</button>`;
 const drafts=d.invitationDrafts.length?`<button type="button" class="invitation-drafts-link" data-invite-team>${d.invitationDrafts.length} invitation ${d.invitationDrafts.length===1?'draft':'drafts'} · not sent</button>`:'';
 return `<div class="dashboard"><h1 class="sr-only" tabindex="-1">Brand assets and team</h1>
 <div class="dashboard-overview">
  <section class="brand-overview" aria-labelledby="brand-overview-title"><div class="brand-mark ${mark?'has-image':''}" ${mark?`data-brand-mark="${mark.id}"`:''}>${mark?'':`${icons.identity}<small>No logo</small>`}</div><div class="brand-overview-copy"><h2 id="brand-overview-title">${escape(d.brand.name||'Brand details')}</h2><p>${escape(d.brand.description||'Add a name, description and logo.')}</p>${d.brand.website?`<span class="brand-website">${escape(d.brand.website)}</span>`:''}<button type="button" class="app-button app-button-quiet" id="edit-brand">Edit details</button></div></section>
  <section class="dashboard-panel team-panel">${section('Creative team',d.team.length?invite:'')}
   ${d.team.length?`<ul class="team-list">${d.team.map(member=>`<li><span class="member-initial" aria-hidden="true">${escape(member.name?.slice(0,1)||'·')}</span><span>${escape(member.name)}<small>${escape(member.role||'Collaborator')}</small></span></li>`).join('')}</ul><div class="team-options">${match}</div>`:`<div class="team-empty"><p>No teammates yet.</p><p class="section-description">Bring your own team, or find a creative partner.</p><div class="team-options">${invite}${match}</div><p class="questionnaire-entry-note">Start with you or your brand.</p></div>`}${drafts}
  </section>
 </div>
 <section class="dashboard-panel dashboard-voices" aria-labelledby="voices-heading"><div><h2 id="voices-heading">Voices</h2><p class="section-description">Creators who reach your audience, online and in the real world.</p></div><a class="app-button" href="#network">Find the right voices <span aria-hidden="true">↗</span></a></section>
 <section class="dashboard-brand-system">${section('Brand assets',`<div class="brand-asset-tools"><button type="button" class="app-button app-button-quiet" data-open-questionnaire="assets">Brand questionnaire</button><span class="system-count">${d.available} of ${d.definitionCount} defined</span></div>`)}
  <div class="brand-asset-list">${d.pieces.map(piece=>`<a class="brand-asset-row" href="#piece/${piece.id}" data-piece-status="${piece.status}" aria-label="Open ${escape(piece.title.toLowerCase())}"><span class="asset-row-icon">${icons[piece.id]}</span><span class="asset-row-copy"><strong>${piece.title}</strong><small>${piece.current?escape(piece.current.name):piece.kind==='collection'&&piece.references.length?`${piece.references.length} selected ${piece.references.length===1?'asset':'assets'}`:escape(assetDescriptions[piece.id])}</small></span><span class="asset-status ${piece.current||piece.kind==='collection'&&piece.references.length?'available':''}">${piece.status}</span><span class="row-chevron">${chevron}</span></a>`).join('')}</div>
 </section>
 <div class="dashboard-bottom"><section class="dashboard-panel files-panel">${section('Files & links',`<button type="button" class="app-button" data-open-upload="files">${plus}Add files or links</button>`)}<p class="section-description">Source files and references for your brand.</p>
  ${d.assets.length?`<ul class="recent-material">${d.assets.slice(-4).reverse().map(a=>`<li><button type="button" data-asset="${a.id}"><span class="file-symbol" aria-hidden="true">${a.kind==='link'?'↗':'≡'}</span><span>${escape(a.name)}<small>${escape(a.capturePath||a.kind||'Capture')}</small></span><span class="row-chevron">${chevron}</span></button></li>`).join('')}</ul><a href="#capture" class="app-button app-button-quiet">View all files</a>`:'<div class="files-empty"><p>No files or links added.</p><small>Drop in what you have. Organise it when you’re ready.</small></div>'}
 </section><section class="dashboard-panel">${section('Requests')}${d.requests.length?`<ul class="request-list">${d.requests.map(r=>`<li><strong>${escape(r.title)}</strong><small>${escape(r.requestedBy||'Creative partner')}</small><a href="${d.pieces.some(p=>p.id===r.pieceId)?'#piece/'+r.pieceId:'#capture'}">Connect material</a></li>`).join('')}</ul>`:'<div class="dashboard-empty"><p>No requests.</p><small>File requests from your team will appear here.</small></div>'}</section></div></div>`;
}
