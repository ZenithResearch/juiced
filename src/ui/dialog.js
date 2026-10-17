// Native dialogs provide modality and Escape; this keeps Tab boundaries
// consistent in embedded browsers and when the initial heading is focused.
export function containDialogFocus(root=document,{selector='dialog'}={}){
 const controller=new AbortController();
 root.querySelectorAll(selector).forEach(dialog=>dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||!dialog.open)return;
  const stops=[...dialog.querySelectorAll('button,a[href],input,textarea,select,summary,[tabindex]')].filter(element=>element.tabIndex>=0&&!element.matches(':disabled')&&element.getClientRects().length&&!element.closest('[hidden],[inert]'));
  if(!stops.length){event.preventDefault();dialog.focus();return;}
  const active=dialog.ownerDocument.activeElement,first=stops[0],last=stops.at(-1);
  if(event.shiftKey&&(active===first||!stops.includes(active))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(active===last||!stops.includes(active))){event.preventDefault();first.focus();}
 },{signal:controller.signal}));
 return ()=>controller.abort();
}
