import {api} from './api.js';
import {layout} from './components/layout.js';
import {table} from './components/table.js';
layout();
const page=document.body.dataset.page,root=document.querySelector('#app');
const link=(title,href)=>{const a=document.createElement('a');a.href=href;a.textContent=title;return a};
async function render(){
  if(page==='login'||page==='register'){const {authForm}=await import('./auth.js');return authForm(page)}
  root.innerHTML='<h1>'+document.title.split(' — ')[0]+'</h1>';
  if(page==='index') {
    const categories=await api('/categories');
    const heading=root.querySelector('h1');
    heading.textContent='Каталог';
    const intro=document.createElement('p');intro.className='page-intro';intro.textContent='Выберите раздел, чтобы посмотреть предложения';heading.after(intro);
    const list=document.createElement('div');list.className='category-list';
    for(const section of categories.filter(category=>!category.parent_id)) {
      const items=categories.filter(category=>category.parent_id===section.id);
      if(!items.length)continue;
      const group=document.createElement('section');group.className='category-group card';
      const title=document.createElement('h2');title.textContent=section.name;group.append(title);
      const links=document.createElement('div');links.className='category-links';
      for(const category of items) {const item=link(category.name,'/category/'+encodeURIComponent(category.slug));item.className='category-link';const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='→';item.append(arrow);links.append(item);}
      group.append(links);list.append(group);
    }
    if(!list.children.length){const empty=document.createElement('p');empty.className='card muted';empty.textContent='Категорий пока нет';list.append(empty)}
    root.append(list);
  }
  if(page==='category') {
    const slug=location.pathname.split('/').at(-1);
    const [category,lots]=await Promise.all([api('/categories/'+slug),api('/categories/'+slug+'/lots'+location.search)]);
    const breadcrumb=document.createElement('div');breadcrumb.className='breadcrumbs';breadcrumb.append(link('Каталог','/'));root.prepend(breadcrumb);
    root.querySelector('h1').textContent=category.name;
    if(category.settings?.disclaimer){const notice=document.createElement('p');notice.className='notice';notice.textContent=category.settings.disclaimer;root.append(notice)}
    const toolbar=document.createElement('div');toolbar.className='catalog-toolbar';
    const search=document.createElement('form');search.className='search-form';search.setAttribute('role','search');
    const input=document.createElement('input');input.type='search';input.name='q';input.placeholder='Поиск по названию';input.setAttribute('aria-label','Поиск предложений');input.value=new URLSearchParams(location.search).get('q')||'';
    const button=document.createElement('button');button.className='button';button.textContent='Найти';search.append(input,button);
    search.onsubmit=event=>{event.preventDefault();const query=input.value.trim();const params=new URLSearchParams(location.search);if(query)params.set('q',query);else params.delete('q');location.search=params.toString()};
    const sort=document.createElement('select');sort.className='catalog-sort';sort.setAttribute('aria-label','Сортировка предложений');
    for(const [value,label] of [['recent','Сначала новые'],['price_asc','Цена по возрастанию'],['price_desc','Цена по убыванию'],['quantity','Больше в наличии']]){const option=document.createElement('option');option.value=value;option.textContent=label;sort.append(option)}
    sort.value=new URLSearchParams(location.search).get('sort')||'recent';sort.onchange=()=>{const params=new URLSearchParams(location.search);if(sort.value==='recent')params.delete('sort');else params.set('sort',sort.value);location.search=params.toString()};
    const sell=link('Создать предложение','/sell');sell.className='button button-secondary';toolbar.append(search,sort,sell);root.append(toolbar);
    const subtitle=document.createElement('h2');subtitle.className='list-heading';subtitle.textContent='Предложения';root.append(subtitle);
    const result=table(['Описание','Продавец','Наличие','Цена'],lots.map(l=>{const seller=document.createElement('span');seller.className='seller-summary';seller.append(link(l.nickname,'/users/'+l.seller_id));if(l.reviews){const rating=document.createElement('small');rating.textContent=l.rating+' / 5 · '+l.reviews+' отз.';seller.append(rating)}return [link(l.title,'/lots/'+l.id),seller,l.quantity,l.price+' USDT']}));
    if(!lots.length)result.querySelector('tbody td').textContent=input.value?'По вашему запросу предложений не найдено':'В этой категории пока нет предложений';root.append(result);
  }
  if(page==='lot') {
    const [lot,{purchaseControl}]=await Promise.all([api('/lots/'+location.pathname.split('/').at(-1)),import('./demo.js')]);
    const breadcrumb=document.createElement('div');breadcrumb.className='breadcrumbs';breadcrumb.append(link('Каталог','/'),document.createTextNode(' / '),link('Категория','/category/'+encodeURIComponent(lot.category_slug)));root.prepend(breadcrumb);
    root.querySelector('h1').textContent=lot.title;
    const layout=document.createElement('div');layout.className='lot-layout';
    const box=document.createElement('section');box.className='card lot-description';const heading=document.createElement('h2');heading.textContent='Описание';const description=document.createElement('p');description.textContent=lot.description;box.append(heading,description);
    const details=document.createElement('aside');details.className='card lot-details';
    const price=document.createElement('div');price.className='lot-price';price.textContent=lot.price+' USDT';
    const availability=document.createElement('p');availability.className='muted';availability.textContent='В наличии: '+lot.quantity;
    const seller=document.createElement('div');seller.className='seller-line';const sellerLabel=document.createElement('span');sellerLabel.textContent='Продавец';seller.append(sellerLabel,link(lot.seller_name,'/users/'+lot.seller_id));details.append(price,availability,seller);if(lot.seller_reviews){const rating=document.createElement('p');rating.className='seller-rating';rating.textContent='Рейтинг '+lot.seller_rating+' / 5 · '+lot.seller_reviews+' отз.';details.append(rating)}purchaseControl(details,lot);layout.append(box,details);root.append(layout);
  }
  if(page==='user') {
    const userId=location.pathname.split('/').at(-1);const [user,lots,reviews]=await Promise.all([api('/users/'+userId),api('/users/'+userId+'/lots'),api('/users/'+userId+'/reviews')]);
    root.innerHTML='<div class="profile-banner"></div><div class="profile-head"><div class="avatar"></div><div><h1></h1><span class="profile-id"></span></div></div><div class="profile-stats"><div class="card"><span class="stat-label">Дата регистрации</span><strong id="joined"></strong></div><div class="card"><span class="stat-label">Рейтинг продавца</span><strong id="rating"></strong><span class="stat-detail" id="reviews"></span></div></div><div class="section-title"><h2>Предложения</h2></div>';
    root.querySelector('.avatar').textContent=user.nickname[0].toUpperCase();root.querySelector('h1').textContent=user.nickname;root.querySelector('.profile-id').textContent='Пользователь № '+user.id;
    root.querySelector('#joined').textContent=new Date(user.created_at).toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'});root.querySelector('#rating').textContent=user.reviews>0?user.rating+' / 5':'Пока нет оценок';root.querySelector('#reviews').textContent=user.reviews>0?'Отзывов: '+user.reviews:'Отзывы появятся после сделок';
    const result=table(['Описание','Категория','Наличие','Цена'],lots.map(l=>[link(l.title,'/lots/'+l.id),link(l.category,'/category/'+l.slug),l.quantity,l.price+' USDT']));if(!lots.length)result.querySelector('tbody td').textContent='У пользователя пока нет предложений';root.append(result);
    const reviewsTitle=document.createElement('h2');reviewsTitle.className='reviews-title';reviewsTitle.textContent='Отзывы покупателей';root.append(reviewsTitle);
    if(!reviews.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Отзывов о завершённых покупках пока нет';root.append(empty)}
    for(const review of reviews){const card=document.createElement('article');card.className='card review-card';const head=document.createElement('div');head.className='review-head';const author=document.createElement('strong');author.textContent=review.buyer_name;const stars=document.createElement('span');stars.className='review-stars';stars.textContent='★'.repeat(review.rating)+'☆'.repeat(5-review.rating);stars.setAttribute('aria-label',review.rating+' из 5');const time=document.createElement('time');time.textContent=new Date(review.created_at).toLocaleDateString('ru-RU');head.append(author,stars,time);card.append(head);if(review.body){const body=document.createElement('p');body.textContent=review.body;card.append(body)}root.append(card)}
  }
  if(page==='sales'&&location.pathname==='/my-lots'){const {renderMyLots}=await import('./my-lots.js');await renderMyLots(root);return;}
  if(page==='sales'){const categories=(await api('/categories')).filter(c=>c.parent_id);root.innerHTML='<h1>Новое предложение</h1><form class="card form-card"><label>Категория<select name="categoryId"></select></label><label>Название<input name="title" required minlength="5"></label><label>Описание<textarea name="description" required minlength="10"></textarea></label><label>Цена USDT<input name="price" required></label><label>Количество<input name="quantity" type="number" value="1" min="1"></label><button class="button">Опубликовать</button><p id="status"></p></form>';const select=root.querySelector('select');for(const c of categories){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;select.append(option)}const fieldsBox=document.createElement('div');select.closest('label').after(fieldsBox);let fieldRequest=0;async function loadFields(){const request=++fieldRequest;const button=root.querySelector('button');button.disabled=true;fieldsBox.replaceChildren();const category=categories.find(c=>String(c.id)===select.value);if(!category)return;const data=await api('/categories/'+category.slug);if(request!==fieldRequest)return;button.disabled=false;for(const field of data.fields){const label=document.createElement('label');label.textContent=field.label;const input=document.createElement('input');input.name='field_'+field.key;input.type=field.type==='checkbox'?'checkbox':field.type==='number'?'number':'text';input.required=field.required;label.append(input);fieldsBox.append(label)}}select.onchange=()=>loadFields().catch(error=>{root.querySelector('#status').textContent=error.message});await loadFields();root.querySelector('form').onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const fields={};for(const input of fieldsBox.querySelectorAll('input'))fields[input.name.slice(6)]=input.type==='checkbox'?input.checked:input.value;try{const result=await api('/lots',{method:'POST',body:JSON.stringify({...d,fields,categoryId:Number(d.categoryId),quantity:Number(d.quantity)})});location.href='/lots/'+result.id}catch(error){root.querySelector('#status').textContent=error.message}};}
  if(page==='admin'){const categories=await api('/admin/categories');root.append(table(['ID','Название','Slug','Статус'],categories.map(c=>[c.id,c.name,c.slug,c.status])));const form=document.createElement('form');form.className='card form-card';form.innerHTML='<h2>Добавить категорию</h2><label>Родитель<select name="parentId"><option value="">Раздел</option></select></label><label>Название<input name="name" required></label><label>Slug<input name="slug" required pattern="[a-z0-9-]+"></label><button class="button">Создать</button><p id="status"></p>';for(const category of categories.filter(c=>!c.parent_id)){const option=document.createElement('option');option.value=category.id;option.textContent=category.name;form.querySelector('select').append(option)}form.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(form));try{await api('/admin/categories',{method:'POST',body:JSON.stringify({name:d.name,slug:d.slug,parentId:d.parentId?Number(d.parentId):null})});location.reload()}catch(error){form.querySelector('#status').textContent=error.message}};root.append(form);}
  if(page==='purchases'||page==='finance'||page==='messages'){const {renderDemo}=await import('./demo.js');await renderDemo(root,page);return;}
}
render().catch(error=>{if(error.status===401){location.href='/login.html';return;}const box=document.createElement('p');box.className='error';box.textContent=error.message;root.append(box)});
