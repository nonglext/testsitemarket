import {api} from '../api.js';
import {setTheme} from '../theme.js';

export function layout() {
  const header = document.querySelector('#header');
  header.innerHTML = `<header class="topbar"><div class="shell">
    <a class="brand" href="/"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16l-1 11H5L4 9Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/></svg></span>Market Yard</a><span class="test-mode">Тестовый режим</span>
    <nav aria-label="Основная навигация"><a href="/">Каталог</a><a href="/sales">Продажи</a><a href="/orders">Покупки</a><a href="/messages">Сообщения</a><a href="/wallet">Финансы</a></nav>
    <div class="header-actions"><span class="account-loading" aria-live="polite">Загрузка…</span></div>
  </div></header>`;
  document.querySelector('#footer').innerHTML = '<footer class="footer"><div class="shell">Market Yard</div></footer>';
  const activePath = location.pathname.startsWith('/category/') || location.pathname.startsWith('/lots/') ? '/' : location.pathname;
  const active = [...header.querySelectorAll('nav a')].find(item => item.getAttribute('href') === activePath);
  if (active) { active.classList.add('active'); active.setAttribute('aria-current', 'page'); }

  const actions = header.querySelector('.header-actions');
  function themeSelect() {
    const label = document.createElement('label');
    label.className = 'account-theme';
    label.textContent = 'Тема';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Тема оформления');
    for (const [value, name] of [['light', 'Белая'], ['gray', 'Серая'], ['black', 'Чёрная']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = name;
      select.append(option);
    }
    select.value = document.documentElement.dataset.theme;
    select.addEventListener('change', () => setTheme(select.value));
    label.append(select);
    return label;
  }
  function showGuest() {
    actions.replaceChildren();
    const theme = themeSelect();
    theme.classList.add('guest-theme');
    const login = document.createElement('a');
    login.className = 'header-login';
    login.href = '/login.html';
    login.textContent = 'Вход';
    actions.append(theme, login);
  }
  api('/me').then(user => {
    if (user.theme) setTheme(user.theme, false);
    const menu = document.createElement('details');
    menu.className = 'account-menu';
    const summary = document.createElement('summary');
    summary.className = 'account-trigger';
    const avatar = document.createElement('span');
    avatar.className = 'account-avatar';
    avatar.textContent = user.nickname.slice(0, 1).toUpperCase();
    const name = document.createElement('span');
    name.className = 'account-name';
    name.textContent = user.nickname;
    summary.append(avatar, name);
    const panel = document.createElement('div');
    panel.className = 'account-panel';
    const profile = document.createElement('a');
    profile.href = '/users/' + encodeURIComponent(user.id);
    profile.textContent = 'Мой профиль';
    panel.append(profile);
    if (user.roles.includes('admin')) {
      const admin = document.createElement('a');
      admin.href = '/admin';
      admin.textContent = 'Админка';
      panel.append(admin);
    }
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.textContent = 'Выйти';
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      try {
        await api('/auth/logout', {method: 'POST'});
        location.href = '/';
      } catch {
        logout.disabled = false;
        logout.textContent = 'Не удалось выйти. Повторить';
      }
    });
    panel.append(themeSelect(), logout);
    menu.append(summary, panel);
    const balance = document.createElement('a');
    balance.href = '/wallet';
    balance.className = 'header-balance';
    balance.setAttribute('aria-label', 'Тестовый баланс');
    balance.textContent = 'Баланс…';
    actions.replaceChildren(balance, menu);
    api('/demo/wallet').then(wallet => {
      const amount = wallet.balance.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      balance.textContent = amount + ' тест. USDT';
      balance.title = 'Тестовый баланс';
    }).catch(() => { balance.textContent = 'Финансы'; });
    document.addEventListener('click', event => { if (!menu.contains(event.target)) menu.open = false; });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.open) { menu.open = false; summary.focus(); } });
  }).catch(error => {
    if (error.status === 401) return showGuest();
    actions.replaceChildren();
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'header-login account-retry';
    retry.textContent = 'Не удалось загрузить аккаунт. Обновить';
    retry.addEventListener('click', () => location.reload());
    actions.append(retry);
  });
}
