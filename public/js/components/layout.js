import {setTheme} from '../theme.js';

export function layout() {
  const header = document.querySelector('#header');
  header.innerHTML = `<header class="topbar"><div class="shell">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16l-1 11H5L4 9Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/></svg></span>Market Yard</a>
    <nav aria-label="Основная навигация"><a href="/">Каталог</a><a href="/sell">Продажи</a><a href="/orders">Покупки</a><a href="/messages">Сообщения</a><a href="/wallet">Финансы</a></nav>
    <div class="header-actions"><select id="theme" aria-label="Тема оформления"><option value="light">Белая</option><option value="gray">Серая</option><option value="black">Чёрная</option></select><a class="header-login" href="/login.html">Вход</a></div>
  </div></header>`;
  document.querySelector('#footer').innerHTML = '<footer class="footer"><div class="shell">Market Yard</div></footer>';
  const select = header.querySelector('#theme');
  select.value = document.documentElement.dataset.theme;
  select.onchange = () => setTheme(select.value);
  const activePath = location.pathname.startsWith('/category/') || location.pathname.startsWith('/lots/') ? '/' : location.pathname;
  const active = [...header.querySelectorAll('nav a')].find(item => item.getAttribute('href') === activePath);
  if (active) { active.classList.add('active'); active.setAttribute('aria-current', 'page'); }
}
