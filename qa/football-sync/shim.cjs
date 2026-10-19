// 离线跑数 shim：抠出 <script> 用 vm.runInThisContext 跑
const fs=require('fs'), vm=require('vm'), path=require('path');
const F=process.env.FMFILE || path.resolve(__dirname,'../../index.html');
const html=fs.readFileSync(F,'utf8');
const blocks=[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let src=blocks.join('\n;\n');
// 常量扫参：FMK="BAL=0.3,OPEX=0.1,CAP=0.8/0.9/0.95"
if(process.env.FMK){
  const kv=Object.fromEntries(process.env.FMK.split(',').map(x=>x.split('=')));
  if(kv.BAL)  src=src.replace(/const BAL_RELEASE = [0-9.]+;/, 'const BAL_RELEASE = '+kv.BAL+';');
  if(kv.OPEX) src=src.replace(/const OPEX_RATE   = [0-9.]+;/, 'const OPEX_RATE   = '+kv.OPEX+';');
  if(kv.CAP){ const c=kv.CAP.split('/');
    src=src.replace(/const WAGE_CAP    = \{[^}]*\};/, `const WAGE_CAP    = {0:${c[0]}, 1:${c[1]}, 2:${c[2]}};`); }
  if(kv.RANK) src=src.replace(/const REV_RANK = \d;/, 'const REV_RANK = '+kv.RANK+';');
  if(kv.CAPR) src=src.replace(/const CAP_RATCHET = [0-9.]+;/, 'const CAP_RATCHET = '+kv.CAPR+';');
  if(kv.BAL0) src=src.replace(/Math\.pow\(rep,[0-9.]+\)\*[0-9.]+ \+ ri\(-400000,2000000\)/,
      'Math.pow(rep,'+(kv.BALEXP||3)+')*'+kv.BAL0+' + ri(-400000,2000000)');
}
const noop=()=>{};
const mkEl=()=>({ style:{setProperty:noop}, classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
  dataset:{}, children:[], appendChild(x){this.children.push(x);return x;}, append:noop,
  addEventListener:noop, removeEventListener:noop, setAttribute:noop, getAttribute:()=>null,
  remove:noop, querySelector:()=>null, querySelectorAll:()=>[], insertAdjacentHTML:noop,
  focus:noop, blur:noop, click:noop, scrollTo:noop, getBoundingClientRect:()=>({width:0,height:0,top:0,left:0}),
  set innerHTML(v){this._html=v;}, get innerHTML(){return this._html||"";} });
global.window=global;
global.addEventListener=noop; global.removeEventListener=noop; global.dispatchEvent=noop;
global.document={ createElement:mkEl, createElementNS:mkEl, getElementById:()=>null,
  querySelector:()=>null, querySelectorAll:()=>[], body:mkEl(), documentElement:mkEl(),
  addEventListener:noop, removeEventListener:noop, head:mkEl(), createTextNode:()=>mkEl() };
global.localStorage={ getItem:()=>null, setItem:noop, removeItem:noop, clear:noop, key:()=>null, length:0 };
global.sessionStorage=global.localStorage;
global.navigator={ userAgent:"node", serviceWorker:{ register:()=>Promise.reject(new Error("no sw")) }, storage:{} };
global.location={ href:"file://x", protocol:"file:", search:"", hash:"" };
global.matchMedia=()=>({matches:false, addEventListener:noop, removeEventListener:noop, addListener:noop});
global.requestAnimationFrame=cb=>setTimeout(cb,0);
global.cancelAnimationFrame=noop;
global.alert=noop; global.confirm=()=>true; global.prompt=()=>null;
global.indexedDB={ open:()=>({ addEventListener:noop }) };
global.caches=undefined;
global.CustomEvent=function(){}; global.Event=function(){};
global.getComputedStyle=()=>({getPropertyValue:()=>""});
global.scrollTo=noop;
try{ vm.runInThisContext(src, {filename:'fm.js'}); }catch(e){ console.error("SRC ERROR", e.message); throw e; }
// UI 相关的全局覆盖，避免跑数时报错
global.render=noop; global.toast=noop; global.news=global.news||noop;
global.saveGame=noop; global.autosave=noop;
module.exports=global;
