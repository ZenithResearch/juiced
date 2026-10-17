import {containDialogFocus} from './dialog.js';
// Portable, escaped HTML patterns. No persistence, network or provider dependencies.
export const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=value=>{if(!/^[a-z][a-z0-9_-]*$/i.test(value||''))throw new TypeError('A stable, unique component id is required.');return value;};
export function safeHref(value){
 const href=String(value??'').trim();
 if(!href||/[\u0000-\u0020\u007f\\]/.test(href)||href.startsWith('//'))throw new TypeError('Use a relative link or an HTTP(S) URL.');
 const url=new URL(href,'https://component.invalid/');
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new TypeError('Unsupported link.');
 return escapeText(href);
}
export function action({label,href,variant='secondary',marketing=false,disabled=false,busy=false,id:identifier,arrow=false}={}){
 if(!['primary','secondary','quiet'].includes(variant))throw new TypeError('Unknown action variant.');
 const attrs=`class="ds-button ds-button--${variant}${marketing?' ds-button--marketing':''}"${identifier?` id="${id(identifier)}"`:''}`;
 const content=`${escapeText(label)}${arrow?'<span class="ds-arrow" aria-hidden="true">↗</span>':''}`;
 if(href!==undefined){if(busy)throw new TypeError('Busy is an action state, not navigation.');return `<a ${attrs}${disabled?' role="link" aria-disabled="true" tabindex="-1"':` href="${safeHref(href)}"`}>${content}</a>`;}
 return `<button type="button" ${attrs}${busy?' aria-busy="true"':''}${disabled||busy?' disabled':''}>${content}</button>`;
}
export function field({id:identifier,label,value='',hint='',error='',optional=false,type='text',multiline=false,rows=4,maxLength,disabled=false}={}){
 const key=id(identifier);if(!['text','url','email','search'].includes(type))throw new TypeError('Unsupported field type.');
 if(maxLength!==undefined&&(!Number.isInteger(maxLength)||maxLength<1))throw new TypeError('Use a positive maximum length.');
 const descriptions=[hint?`${key}-hint`:'',error?`${key}-error`:''].filter(Boolean).join(' ');
 const attrs=`class="ds-input" id="${key}" name="${key}"${descriptions?` aria-describedby="${descriptions}"`:''}${error?' aria-invalid="true"':''}${disabled?' disabled':''}${maxLength?` maxlength="${maxLength}"`:''}`;
 const control=multiline?`<textarea ${attrs} rows="${Math.max(2,Math.min(20,Number(rows)||4))}">${escapeText(value)}</textarea>`:`<input ${attrs} type="${type}" value="${escapeText(value)}">`;
 return `<div class="ds-field"><label class="ds-label" for="${key}">${escapeText(label)}${optional?'<span class="ds-optional">optional</span>':''}</label>${control}${hint?`<p class="ds-hint" id="${key}-hint">${escapeText(hint)}</p>`:''}${error?`<p class="ds-error" id="${key}-error">${escapeText(error)}</p>`:''}</div>`;
}
export function pill({label,selected=false,disabled=false,id:identifier}={}){return `<button type="button" class="ds-pill" aria-pressed="${Boolean(selected)}"${identifier?` id="${id(identifier)}"`:''}${disabled?' disabled':''}>${escapeText(label)}</button>`;}
export function badge({label,tone='neutral'}={}){if(!['neutral','ready','error','accent'].includes(tone))throw new TypeError('Unknown status tone.');return `<span class="ds-tag ds-tag--${tone}">${escapeText(label)}</span>`;}
export function assetRow({title,detail,status='Missing',href}={}){return `<a class="ds-row" href="${safeHref(href)}"><span class="ds-row-copy"><strong>${escapeText(title)}</strong><small>${escapeText(detail)}</small></span><span class="ds-row-end">${badge({label:status})}<span aria-hidden="true">↗</span></span></a>`;}
export function steps({items,current=0,label='Sections'}={}){if(!Array.isArray(items)||current<0||current>=items.length)throw new TypeError('Choose a current section.');return `<nav aria-label="${escapeText(label)}"><ol class="ds-steps">${items.map((item,index)=>`<li><a class="ds-step" href="${safeHref(item.href)}"${index===current?' aria-current="step"':''}><span class="ds-step-index" aria-hidden="true">${index+1}</span>${escapeText(item.label)}</a></li>`).join('')}</ol></nav>`;}
export function notice({text,tone='info',live=false}={}){if(!['info','success','error'].includes(tone))throw new TypeError('Unknown notice tone.');return `<p class="ds-notice ds-notice--${tone}"${live?` role="${tone==='error'?'alert':'status'}"`:''}>${escapeText(text)}</p>`;}
export function emptyState({title,description}={}){return `<div class="ds-empty"><h3>${escapeText(title)}</h3><p>${escapeText(description)}</p></div>`;}
export function checkbox({id:identifier,label,checked=false,disabled=false}={}){return `<label class="ds-checkbox" for="${id(identifier)}"><input type="checkbox" id="${id(identifier)}"${checked?' checked':''}${disabled?' disabled':''}>${escapeText(label)}</label>`;}
export function dropzone({id:identifier,label='Add files',description='Choose files or drop them here.'}={}){return `<label class="ds-dropzone" for="${id(identifier)}"><span aria-hidden="true">＋</span><strong>${escapeText(label)}</strong><small>${escapeText(description)}</small><input id="${id(identifier)}" type="file" multiple aria-label="${escapeText(label)}"></label>`;}
export function bindDialogs(root=document){
 const openers=new WeakMap();const controller=new AbortController();const options={signal:controller.signal};
 const releaseFocus=containDialogFocus(root,{selector:'dialog.ds-dialog'});
 root.addEventListener('click',event=>{
  const open=event.target.closest('[data-ds-open]'),close=event.target.closest('[data-ds-close]');
  if(open){const dialog=root.querySelector(`#${id(open.dataset.dsOpen)}`);if(dialog?.tagName==='DIALOG'&&!dialog.open){openers.set(dialog,open);dialog.showModal();}}
  if(close)close.closest('dialog')?.close('cancel');
 },options);
 root.querySelectorAll('dialog.ds-dialog').forEach(dialog=>{
  dialog.addEventListener('close',()=>{const opener=openers.get(dialog);if(opener?.isConnected)opener.focus();},options);

 });
 return ()=>{controller.abort();releaseFocus();};
}
