import {api} from './api.js';

export async function authForm(mode) {
  const root = document.querySelector('#app');
  const isLogin = mode === 'login';
  root.innerHTML = `<h1>${isLogin ? 'Вход' : 'Регистрация'}</h1><form class="card form-card">
    ${isLogin ? '' : '<label>Ник<input name="nickname" required minlength="3" autocomplete="username"></label>'}
    <label>Email<input name="email" type="email" required autocomplete="email"></label>
    <label>Пароль<input name="password" type="password" required minlength="10" autocomplete="${isLogin ? 'current-password' : 'new-password'}"></label>
    <button class="button">${isLogin ? 'Войти' : 'Создать аккаунт'}</button><p id="status" role="status"></p>
    <div class="auth-switch">${isLogin ? 'Нет аккаунта? <a href="/register.html">Зарегистрироваться</a>' : 'Уже есть аккаунт? <a href="/login.html">Войти</a>'}</div>
  </form>`;
  root.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target));
    try {
      const data = await api('/auth/' + mode, {method: 'POST', body: JSON.stringify(body)});
      if (isLogin) location.href = '/users/' + data.id;
      else root.querySelector('#status').textContent = 'Регистрация завершена. Теперь войдите.';
    } catch (error) { root.querySelector('#status').textContent = error.message; }
  };
  if (isLogin && location.hash.length === 65) {
    await api('/auth/verify', {method:'POST', body:JSON.stringify({token:location.hash.slice(1)})});
    history.replaceState(null, '', location.pathname);
    root.querySelector('#status').textContent = 'Email подтверждён';
  }
}
