import {api} from './api.js';

export async function renderMyLots(root) {
  const lots=await api('/me/lots');
  root.replaceChildren();
  const heading=document.createElement('div');heading.className='section-title';
  const title=document.createElement('h1');title.textContent='Мои предложения';
  const create=document.createElement('a');create.href='/sell';create.className='button';create.textContent='Создать';heading.append(title,create);root.append(heading);
  if(!lots.length){const empty=document.createElement('p');empty.className='card muted';empty.textContent='У вас пока нет предложений';root.append(empty);return;}
  for(const lot of lots){
    const details=document.createElement('details');details.className='card edit-lot';
    const summary=document.createElement('summary');
    const name=document.createElement('strong');name.textContent=lot.title;
    const info=document.createElement('span');info.className='muted';info.textContent=lot.category+' · '+(lot.status==='active'?'Опубликовано':'Скрыто')+' · '+lot.price+' USDT';summary.append(name,info);details.append(summary);
    const form=document.createElement('form');form.className='edit-lot-form';
    const fields=[['Название','title','text',lot.title],['Описание','description','textarea',lot.description],['Цена USDT','price','text',lot.price],['Количество','quantity','number',lot.quantity]];
    for(const [caption,key,type,value] of fields){const label=document.createElement('label');label.textContent=caption;const input=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.name=key;input.value=value;input.required=true;if(key==='quantity'){input.min='0';input.max='100000';input.step='1'}label.append(input);form.append(label)}
    const label=document.createElement('label');label.textContent='Видимость';const select=document.createElement('select');select.name='status';for(const [value,text] of [['active','Опубликовано'],['hidden','Скрыто']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option)}select.value=lot.status;label.append(select);form.append(label);
    const save=document.createElement('button');save.className='button';save.textContent='Сохранить';const remove=document.createElement('button');remove.type='button';remove.className='button button-secondary';remove.textContent='Удалить';const message=document.createElement('p');message.setAttribute('role','status');const actions=document.createElement('div');actions.className='sales-actions';actions.append(save,remove);form.append(actions,message);details.append(form);root.append(details);
    form.onsubmit=async event=>{event.preventDefault();save.disabled=true;const values=Object.fromEntries(new FormData(form));values.quantity=Number(values.quantity);try{await api('/me/lots/'+lot.id,{method:'PATCH',body:JSON.stringify(values)});location.reload()}catch(error){message.textContent=error.message;save.disabled=false}};
    remove.onclick=async()=>{if(!confirm('Удалить это предложение?'))return;remove.disabled=true;try{await api('/me/lots/'+lot.id,{method:'DELETE'});details.remove();if(!root.querySelector('.edit-lot'))await renderMyLots(root)}catch(error){message.textContent=error.message;remove.disabled=false}};
  }
}
