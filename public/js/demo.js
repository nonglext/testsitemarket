import {api} from './api.js';
import {table} from './components/table.js';

const textLink=(text,href)=>{const item=document.createElement('a');item.textContent=text;item.href=href;return item};
const date=value=>new Date(value).toLocaleString('ru-RU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const status={paid:'Ожидает передачи',delivered:'Ожидает подтверждения',completed:'Завершён'};
function notice(){const note=document.createElement('p');note.className='notice';note.textContent='Тестовый режим: оплата и баланс виртуальные. Реальные деньги не используются.';return note}
function showError(place,error){place.textContent=error.status===401?'Войдите в аккаунт, чтобы продолжить.':error.message;if(error.status===401){place.append(' ',textLink('Войти','/login.html'));}}

export function purchaseControl(container,lot){
  const note=notice();container.append(note);
  const form=document.createElement('form');form.className='purchase-form';
  const label=document.createElement('label');label.textContent='Количество';
  const quantity=document.createElement('input');quantity.type='number';quantity.min='1';quantity.max=String(lot.quantity);quantity.step='1';quantity.value='1';quantity.required=true;quantity.readOnly=lot.quantity===1;label.append(quantity);
  const buy=document.createElement('button');buy.className='button';buy.type='submit';buy.textContent=lot.quantity>0?'Купить за тестовый баланс':'Нет в наличии';buy.disabled=lot.quantity<1;
  const result=document.createElement('p');result.setAttribute('role','status');
  form.append(label);
  if(lot.quantity===1){const hint=document.createElement('p');hint.className='muted purchase-hint';hint.textContent='Доступна 1 штука';form.append(hint)}
  form.append(buy,result);container.append(form);
  let key=crypto.randomUUID();
  function validateQuantity(){
    const value=Number(quantity.value);
    quantity.setCustomValidity(!quantity.value||!Number.isInteger(value)||value<1?'Введите целое количество от 1':value>lot.quantity?'Доступно не больше '+lot.quantity+' шт.':'');
  }
  quantity.addEventListener('input',()=>{key=crypto.randomUUID();result.replaceChildren();validateQuantity()});
  quantity.addEventListener('invalid',validateQuantity);
  form.addEventListener('submit',async event=>{event.preventDefault();buy.disabled=true;result.textContent='Оформляем покупку…';try{const order=await api('/demo/orders',{method:'POST',body:JSON.stringify({lotId:Number(lot.id),quantity:Number(quantity.value),requestKey:key})});location.href='/orders/'+order.id}catch(error){showError(result,error);if(error.message.includes('Недостаточно тестовых средств'))result.append(' ',textLink('Пополнить баланс','/wallet'));buy.disabled=false;}});
}

export async function renderDemo(root,page){
  root.replaceChildren();
  if(page==='finance')return wallet(root);
  if(page==='messages')return conversations(root);
  const match=location.pathname.match(/^\/orders\/(\d+)\/?$/);
  if(match)return orderDetails(root,match[1]);
  const seller=location.pathname.replace(/\/$/,'')==='/sales';
  const heading=document.createElement('div');heading.className='section-title';
  const title=document.createElement('h1');title.textContent=seller?'Мои продажи':'Мои покупки';heading.append(title);
  if(seller){const links=document.createElement('div');links.className='sales-actions';const manage=textLink('Мои предложения','/my-lots');manage.className='button button-secondary';const create=textLink('Создать предложение','/sell');create.className='button';links.append(manage,create);heading.append(links)}
  root.append(heading,notice());
  const orders=await api('/demo/orders?role='+(seller?'seller':'buyer'));
  const result=table(['Дата','Заказ','Описание',seller?'Покупатель':'Продавец','Статус','Сумма'],orders.map(order=>[date(order.created_at),textLink('#'+order.id,'/orders/'+order.id),textLink(order.lot_title,'/orders/'+order.id),order.counterparty,status[order.status],order.total+' тест. USDT']));
  if(!orders.length)result.querySelector('tbody td').textContent=seller?'У вас пока нет продаж':'У вас пока нет покупок';root.append(result);
}

async function wallet(root){
  const wallet=await api('/demo/wallet');
  const title=document.createElement('h1');title.textContent='Финансы';root.append(title,notice());
  const balance=document.createElement('section');balance.className='card wallet-card';
  const label=document.createElement('span');label.className='stat-label';label.textContent='Тестовый баланс';
  const value=document.createElement('strong');value.className='wallet-balance';value.textContent=wallet.balance+' тест. USDT';balance.append(label,value);
  const form=document.createElement('form');form.className='wallet-form';
  const amountLabel=document.createElement('label');amountLabel.textContent='Сумма пополнения';
  const amount=document.createElement('input');amount.name='amount';amount.type='number';amount.min='0.000001';amount.max='9999999';amount.step='0.000001';amount.value='100';amount.required=true;amountLabel.append(amount);
  const button=document.createElement('button');button.className='button';button.textContent='Пополнить тестовый баланс';
  const result=document.createElement('p');result.setAttribute('role','status');form.append(amountLabel,button,result);balance.append(form);root.append(balance);
  let key=crypto.randomUUID();amount.addEventListener('input',()=>{key=crypto.randomUUID()});
  form.onsubmit=async event=>{event.preventDefault();button.disabled=true;result.textContent='Пополняем…';try{await api('/demo/wallet/topup',{method:'POST',body:JSON.stringify({amount:amount.value,requestKey:key})});location.reload()}catch(error){showError(result,error);button.disabled=false}};
  const heading=document.createElement('h2');heading.textContent='История операций';root.append(heading);
  const names={topup:'Тестовое пополнение',purchase:'Покупка',sale:'Продажа'};
  const list=table(['Дата','Операция','Сумма'],wallet.history.map(row=>[date(row.created_at),row.order_id?textLink(names[row.kind]+' №'+row.order_id,'/orders/'+row.order_id):names[row.kind],row.amount+' тест. USDT']));if(!wallet.history.length)list.querySelector('tbody td').textContent='Операций пока нет';root.append(list);
}

async function orderDetails(root,id){
  const order=await api('/demo/orders/'+id);
  const back=textLink(order.buyer_id===order.viewer_id?'Мои покупки':'Мои продажи',order.buyer_id===order.viewer_id?'/orders':'/sales');back.className='breadcrumbs';root.append(back);
  const heading=document.createElement('h1');heading.textContent='Заказ №'+order.id;root.append(heading,notice());
  const box=document.createElement('section');box.className='card order-card';
  const columns=document.createElement('div');columns.className='order-layout';columns.append(box);root.append(columns);
  function drawOrder(current){
    box.replaceChildren();
    const title=document.createElement('h2');title.textContent=current.lot_title;box.append(title);
    const list=document.createElement('dl');list.className='order-details';
    for(const [label,value] of [['Статус',status[current.status]],['Покупатель',current.buyer_name],['Продавец',current.seller_name],['Количество',String(current.quantity)],['Сумма',current.total+' тест. USDT'],['Дата',date(current.created_at)]]){const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=value;list.append(dt,dd)}box.append(list);
    const message=document.createElement('p');message.className='muted';
    if(current.status==='paid')message.textContent='Тестовые средства удерживаются до подтверждения покупателем. Обсудите передачу в переписке.';
    if(current.status==='delivered')message.textContent='Продавец отметил передачу. После получения покупатель может подтвердить заказ.';
    if(current.status==='completed')message.textContent='Заказ подтверждён. Тестовые средства зачислены продавцу.';
    box.append(message);
    const action=current.status==='paid'&&current.viewer_id===current.seller_id?['Отметить передачу','deliver']:['paid','delivered'].includes(current.status)&&current.viewer_id===current.buyer_id?['Подтвердить получение','confirm']:null;
    if(action){const button=document.createElement('button');button.className='button';button.textContent=action[0];const result=document.createElement('p');result.setAttribute('role','status');button.onclick=async()=>{button.disabled=true;try{await api('/demo/orders/'+id+'/'+action[1],{method:'POST'});await refreshOrder()}catch(error){showError(result,error);button.disabled=false}};box.append(button,result)}
  }
  let version=0;
  async function refreshOrder(){const current=++version;const fresh=await api('/demo/orders/'+id);if(current===version)drawOrder(fresh)}
  drawOrder(order);
  await chat(columns,id,order.viewer_id,refreshOrder);
}

async function conversations(root){
  const title=document.createElement('h1');title.textContent='Сообщения';root.append(title,notice());
  const [purchases,sales]=await Promise.all([api('/demo/orders?role=buyer'),api('/demo/orders?role=seller')]);
  const orders=[...purchases,...sales].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const layout=document.createElement('div');layout.className='inbox-layout card';
  const list=document.createElement('div');list.className='inbox-list';
  if(!orders.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Сообщения появятся после создания заказа';list.append(empty)}
  for(const order of orders){const item=textLink('', '/orders/'+order.id);item.className='inbox-item';const avatar=document.createElement('span');avatar.className='account-avatar';avatar.textContent=order.counterparty.slice(0,1).toUpperCase();const content=document.createElement('span');content.className='inbox-content';const name=document.createElement('strong');name.textContent=order.counterparty;const detail=document.createElement('span');detail.textContent='Заказ №'+order.id+' · '+order.lot_title;content.append(name,detail);item.append(avatar,content);list.append(item)}
  const prompt=document.createElement('div');prompt.className='inbox-prompt';prompt.textContent=orders.length?'Выберите заказ, чтобы открыть переписку':'Пока нет переписок';layout.append(list,prompt);root.append(layout);
}
async function chat(root,orderId,viewerId,refreshOrder){
  const section=document.createElement('section');section.className='card order-chat';
  const title=document.createElement('h2');title.textContent='Переписка по заказу';
  const messages=document.createElement('div');messages.className='chat-messages';messages.setAttribute('aria-live','polite');
  const form=document.createElement('form');const input=document.createElement('textarea');input.required=true;input.maxLength=4000;input.placeholder='Напишите сообщение';input.setAttribute('aria-label','Сообщение');
  const hint=document.createElement('p');hint.className='form-hint';hint.textContent='Enter — отправить, Shift + Enter — новая строка';
  const button=document.createElement('button');button.className='button';button.textContent='Отправить';const result=document.createElement('p');result.setAttribute('role','status');form.append(input,hint,button,result);section.append(title,messages,form);root.append(section);
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing && event.keyCode!==229){
      event.preventDefault();
      if(!button.disabled && input.value.trim()) form.requestSubmit();
    }
  });
  let last='';let inFlight=null;let refreshAgain=false;
  async function refresh(){
    if(inFlight){refreshAgain=true;return inFlight}
    inFlight=(async()=>{
      do {
        refreshAgain=false;
        const rows=await api('/demo/orders/'+orderId+'/messages');
        const signature=JSON.stringify(rows);if(signature===last)continue;
        const nearBottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<80;
        last=signature;messages.replaceChildren();
        if(!rows.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Сообщений пока нет';messages.append(empty)}
        for(const row of rows){const item=document.createElement('div');item.className='chat-message';const meta=document.createElement('div');meta.className='chat-meta';meta.textContent=(row.sender_id===viewerId?'Вы':row.nickname)+' · '+date(row.created_at);const body=document.createElement('p');body.textContent=row.body;item.append(meta,body);messages.append(item)}
        if(nearBottom)messages.scrollTop=messages.scrollHeight;
      } while(refreshAgain);
    })();
    try{return await inFlight}finally{inFlight=null}
  }
  let key=crypto.randomUUID();input.addEventListener('input',()=>{key=crypto.randomUUID()});
  form.onsubmit=async event=>{event.preventDefault();button.disabled=true;input.readOnly=true;result.textContent='';try{await api('/demo/orders/'+orderId+'/messages',{method:'POST',body:JSON.stringify({body:input.value,clientKey:key})});input.value='';key=crypto.randomUUID();refresh().catch(()=>{})}catch(error){showError(result,error)}finally{button.disabled=false;input.readOnly=false}};
  let socket;let retryDelay=1000;let stopped=false;let retryTimer;
  async function connect(){
    if(stopped)return;
    try{
      await api('/me');
      if(stopped)return;
      socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');
      socket.onopen=()=>{retryDelay=1000;refresh().catch(()=>{});refreshOrder().catch(()=>{})};
      socket.onmessage=event=>{try{const eventData=JSON.parse(event.data);if(eventData.orderId!==String(orderId))return;if(eventData.type==='message')refresh().catch(()=>{});if(eventData.type==='order')refreshOrder().catch(()=>{})}catch{}};
      socket.onerror=()=>socket.close();
      socket.onclose=()=>{if(stopped)return;retryTimer=setTimeout(connect,retryDelay);retryDelay=Math.min(retryDelay*2,30000)};
    }catch{if(!stopped){retryTimer=setTimeout(connect,retryDelay);retryDelay=Math.min(retryDelay*2,30000)}}
  }
  window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(retryTimer);if(socket)socket.close()},{once:true});
  window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;connect()}});
  await refresh();connect();
  setInterval(()=>{if(!socket||socket.readyState!==WebSocket.OPEN){refresh().catch(()=>{});refreshOrder().catch(()=>{})}},10000);
}
