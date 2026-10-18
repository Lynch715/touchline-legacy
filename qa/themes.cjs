const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const runtime=scripts.join('\n');
const setter=runtime.slice(runtime.indexOf('function setTheme(theme){'),runtime.indexOf('function appearanceCard(){'));
let passed=0;
function fixture(saved,readError=false,writeError=false){
  const attrs=[{dataset:{themeChoice:'dark'},setAttribute(k,v){this[k]=v}},{dataset:{themeChoice:'light'},setAttribute(k,v){this[k]=v}}];
  const root={dataset:{}},meta={content:'#0d1117'},writes=[];
  const ctx={document:{documentElement:root,querySelector:()=>meta,querySelectorAll:()=>attrs},localStorage:{
    getItem(k){assert.equal(k,'touchline-theme');if(readError)throw Error('disabled');return saved},
    setItem(k,v){if(writeError)throw Error('disabled');writes.push([k,v])}
  }};
  vm.createContext(ctx);vm.runInContext(scripts[0],ctx);vm.runInContext(setter,ctx);
  return {ctx,root,meta,attrs,writes};
}
for(const [saved,expected] of [[null,'dark'],['light','light'],['dark','dark'],['invalid','dark']]){
  const f=fixture(saved);assert.equal(f.root.dataset.theme,expected);passed++;
}
assert.equal(fixture(null,true).root.dataset.theme,'dark');passed++;
const f=fixture('dark');
vm.runInContext('setTheme("light")',f.ctx);
assert.equal(f.root.dataset.theme,'light');assert.equal(f.meta.content,'#f5f7f8');
assert.deepEqual(f.writes,[['touchline-theme','light']]);assert.equal(f.attrs[0]['aria-pressed'],'false');assert.equal(f.attrs[1]['aria-pressed'],'true');passed++;
vm.runInContext('setTheme("invalid")',f.ctx);assert.equal(f.root.dataset.theme,'light');assert.equal(f.writes.length,1);passed++;
const blocked=fixture('dark',false,true);vm.runInContext('setTheme("light")',blocked.ctx);assert.equal(blocked.root.dataset.theme,'light');passed++;
console.log(`${passed} theme checks passed; theme preference never uses game-save keys.`);
