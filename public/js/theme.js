import {api} from './api.js';
const system=matchMedia('(prefers-color-scheme:dark)').matches?'gray':'light';
export function setTheme(value,persist=true){document.documentElement.dataset.theme=value;localStorage.setItem('theme',value);if(persist)api('/me/theme',{method:'PATCH',body:JSON.stringify({theme:value})}).catch(()=>{});}
setTheme(localStorage.getItem('theme')||system,false);
