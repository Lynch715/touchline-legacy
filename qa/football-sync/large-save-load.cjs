const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');require('./shim.cjs');
const out=path.resolve(__dirname,'../../output/large-save-load-20261031');fs.mkdirSync(out,{recursive:true});const results=[];
async function* chunks(text,size){for(let i=0;i<text.length;i+=size)yield text.slice(i,i+size);}
async function test(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL',name,e.stack);}finally{SAVE_PAUSED=true;clearTimeout(SAVE_TIMER);}}
(async()=>{
 await test('分块边界、转义、Unicode、空集合、重复键及 __proto__ 与原生解析一致',async()=>{
  const inputs=[String.raw`{"empty":{},"list":[],"values":[true,false,null,-1.2e+3,{"s":"引号\"反斜杠\\换行\n\uD83D\uDE00"}],"players":{"__proto__":{"x":1},"12":{"a":2}},"__proto__":{"y":1},"repeat":0,"repeat":1}`];
  let seed=17;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const value=depth=>depth>3?Math.round(rand()*100):[()=>null,()=>rand()<.5,()=>rand()*1e8,()=>['中文','😀','"\\\n\t','{}[], :'][Math.floor(rand()*4)],()=>Array.from({length:Math.floor(rand()*4)},()=>value(depth+1)),()=>Object.fromEntries(Array.from({length:Math.floor(rand()*4)},(_,i)=>['k'+i,value(depth+1)]))][Math.floor(rand()*6)]();
  for(let i=0;i<100;i++)inputs.push(JSON.stringify({players:{1:value(0),2:value(0)},fixtures:[value(0)],extra:value(0)}));
  for(const text of inputs)for(const size of [1,2,7,31,65536]){const r=await parseSaveJSON(chunks(text,size));assert.deepEqual(r.obj,JSON.parse(text));assert.equal(r.chars,text.length);}
 });
 await test('截断、尾逗号、非法转义、缺分隔符和额外正文均拒绝',async()=>{
  const bad=['','{}x','{}{}','[]','{"x":1,}','{"x":[1,]}','{"x":{"a":1,}}','{"x":tru}','{"x":01}','{"x":NaN}','{"x":"\\q"}','{"x":"line\nbreak"}','{"x":[1 2]}','{"x":1 "y":2}','{"x":','{"x":"unterminated}','{"x":1]','{"x":{"a":2]}}'];
  for(const text of bad)for(const size of [1,7])await assert.rejects(()=>parseSaveJSON(chunks(text,size)),text);
 });
 await test('旧正文校验分片计算与原算法逐字节一致',async()=>{
  for(const obj of [{a:'中文\n"\\😀',list:[null,1.2e-10,true],players:{1:{x:1}},_saveStamp:{at:1}},{_saveStamp:{checksum:0},'12':1,'1':2,empty:{},undef:undefined}]){const clean={...obj};delete clean._saveStamp;assert.equal(hashWorldSnapshot(obj),hashStr(JSON.stringify(clean)));}
 });
 const raw=fs.readFileSync(path.resolve(__dirname,'../../output/player-feedback-20261022/release/线上原存档备份.json'),'utf8');
 let stores;const reset=()=>{stores=[new Map(),new Map(),new Map()];global.idbGet=async k=>stores[0].get(k)||null;global.idbSet=async(k,v)=>stores[0].set(k,v);global.cacheGet=async k=>stores[1].get(k)||null;global.cacheSet=async(k,v)=>stores[1].set(k,v);global.localStorage={getItem:k=>stores[2].get(k)||null,setItem:(k,v)=>stores[2].set(k,v)};SAVE_PAUSED=false;};
 await test('三份不同代次只在候选阶段返回小索引，最终采用最新有效副本',async()=>{
  reset();const w=JSON.parse(raw);const payload=at=>'S1:'+JSON.stringify({at,season:w.season,day:w.day,checksum:hashStr('Z0:'+raw)})+'\nZ0:'+raw;
  stores[0].set(SAVEKEY,payload(100));stores[1].set(SAVEKEY,payload(300));stores[2].set(SAVEKEY,payload(200));
  const original=global.runSaveTask,modes=[];global.runSaveTask=async task=>{modes.push(task.mode);const r=await original(task);assert(!r.obj&&!r.str,'候选不可保留完整世界或正文');return r;};
  try{const record=await readSaveRecord('adopt');assert.equal(record.at,300);assert.equal(record.name,'Cache');assert(record.prepared);assert.deepEqual(modes,['inspect','inspect','inspect']);validateWorld(record.obj);}finally{global.runSaveTask=original;}
 });
 await test('较新的损坏副本和较旧的有效副本混存，仍回退且不写盘',async()=>{
  reset();const w=JSON.parse(raw),bad=JSON.parse(raw);bad.players[Object.keys(bad.players)[0]].pos2={};const text='Z0:'+JSON.stringify(bad);
  stores[0].set(SAVEKEY,'S1:'+JSON.stringify({at:999,day:w.day,season:w.season,checksum:hashStr(text)})+'\n'+text);stores[1].set(SAVEKEY,'Z0:'+raw);const before=stores.map(s=>[...s]);
  const r=await readSaveRecord('adopt');assert.equal(r.name,'Cache');assert.deepEqual(stores.map(s=>[...s]),before);
 });
 await test('独占文件对象直接迁移与原复制迁移一致，失败保留当前世界和随机状态',async()=>{
  const initial={rng:RNGSTATE,pid:PID,clk:FIN_CLK};adoptWorld(JSON.parse(raw));SAVE_PAUSED=true;const expected=JSON.stringify(WORLD);RNGSTATE=initial.rng;PID=initial.pid;FIN_CLK=initial.clk;adoptOwnedWorld(JSON.parse(raw));assert(JSON.stringify(WORLD)===expected,'相同随机状态下两条迁移路径结果不一致');
  const world=WORLD,rng=RNGSTATE,pid=PID,clk=FIN_CLK,bad=JSON.parse(raw);bad.clubs[bad.userClub].finance.balance=null;assert.throws(()=>adoptOwnedWorld(bad));assert.equal(WORLD,world);assert.equal(RNGSTATE,rng);assert.equal(PID,pid);assert.equal(FIN_CLK,clk);
 });
 await test('所有可用旧压缩格式按块读取与原正文一致',async()=>{
  const text=JSON.stringify({note:'中文😀',players:{1:{name:'转义"\\'}},fixtures:[{x:1}],_saveStamp:{at:42}});
  for(const [header,format]of [['Z0:',null],...Z_USABLE]){
   let packed=header+text;if(format){const bytes=new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream(format))).arrayBuffer());packed=header+String.fromCharCode(...bytes);}
   const r=await parseSaveJSON(saveTextChunks(packed));assert.deepEqual(r.obj,JSON.parse(text));assert.equal(r.chars,text.length);
  }
 });
 const report={passed:results.every(r=>r.pass),checks:results.length,results};fs.writeFileSync(path.join(out,'large-save-load.json'),JSON.stringify(report,null,2));process.exit(report.passed?0:1);
})().catch(e=>{console.error(e);process.exit(1);});
