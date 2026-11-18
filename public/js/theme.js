import {api} from './api.js';
const system=matchMedia('(prefers-color-scheme:dark)').matches?'gray':'light';
export function setTheme(value,persist=true){if(!['light','gray','black'].includes(value))return;document.documentElement.dataset.theme=value;try{localStorage.setItem('theme',value)}catch{}if(persist)api('/me/theme',{method:'PATCH',body:JSON.stringify({theme:value})}).catch(()=>{});}
let savedTheme;try{savedTheme=localStorage.getItem('theme')}catch{}
setTheme(['light','gray','black'].includes(savedTheme)?savedTheme:system,false);
