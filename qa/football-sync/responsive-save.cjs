const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('./shim.cjs');
const out=path.resolve(__dirname,'../../output/performance-fix-20261029');fs.mkdirSync(out,{recursive:true});
const results=[];let stores;
function resetStores(){stores=[new Map(),new Map(),new Map()];global.idbGet=async k=>stores[0].get(k)||null;global.idbSet=async(k,v)=>stores[0].set(k,v);global.cacheGet=async k=>stores[1].get(k)||null;global.cacheSet=async(k,v)=>stores[1].set(k,v);global.localStorage={getItem:k=>stores[2].get(k)||null,setItem:(k,v)=>stores[2].set(k,v),removeItem:k=>stores[2].delete(k)};SAVE_PAUSED=false;SAVE_DIRTY=false;clearTimeout(SAVE_TIMER);SAVE_TIMER=null;}
async function test(name,fn){resetStores();try{await fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL',name,e.message);}finally{SAVE_PAUSED=true;clearTimeout(SAVE_TIMER);}}
(async()=>{
 const file=path.resolve(__dirname,'../../output/player-feedback-20261022/release/线上原存档备份.json'),raw=fs.readFileSync(file,'utf8');adoptWorld(JSON.parse(raw));SAVE_PAUSED=true;
 const baseline=JSON.stringify(WORLD),obj=JSON.parse(baseline),meta={club:UC().cn,season:WORLD.season,day:WORLD.day};
 await test('分片JSON与原序列化逐字一致，正确处理转义、数组空项与旧时间戳',async()=>{
  assert.equal([...worldSnapshotParts(obj)].join(''),baseline);
  const sample={name:'引号" 换行\n中文\\',optional:undefined,list:[undefined,null,Infinity,-0],map:{x:undefined,y:'ok'},_saveStamp:{at:1}};const clean={...sample};delete clean._saveStamp;assert.equal([...worldSnapshotParts(sample)].join(''),JSON.stringify(clean));
 });
 await test('后台打包沿用校验正文，且不改变活跃世界或随机状态',async()=>{
  const world=WORLD,rng=RNGSTATE,pid=PID,clk=FIN_CLK;const packed=await processSaveTask({op:'pack',raw:baseline,at:77,runtime:{rng,pid,clk}});const decoded=JSON.parse(await unzipSave(packed.payload));assert.equal(decoded._saveStamp.at,77);assert.equal(decoded._saveStamp.checksum,hashStr(baseline));delete decoded._saveStamp;assert.equal(JSON.stringify(decoded),baseline);assert.equal(WORLD,world);assert.equal(RNGSTATE,rng);assert.equal(PID,pid);assert.equal(FIN_CLK,clk);
 });
 await test('带缩进和尾换行的外部JSON保存后仍通过正文校验',async()=>{await storeSave(JSON.stringify(obj,null,2)+'\n',meta);assert(await readSaveRecord());});
 await test('正常快照三层落盘并可恢复，保存不改资金、阵容或球员数据',async()=>{
  await storeSave(null,meta,WORLD);const r=await readSaveRecord();assert(r);delete r.obj._saveStamp;assert.deepEqual(r.obj,obj);assert(stores.every(m=>m.get(SAVEKEY)===stores[0].get(SAVEKEY)));assert.equal(JSON.stringify(WORLD),baseline);
 });
 await test('快照中途真实改动时丢弃半份快照，不覆盖已有好档',async()=>{
  await storeSave(baseline,meta);const previous=stores.map(m=>m.get(SAVEKEY));
  const work=storeSave(null,meta,WORLD);setTimeout(()=>{SAVE_CHANGE_SEQ++;SAVE_DIRTY=true;},1);assert.equal(await work,null);assert.deepEqual(stores.map(m=>m.get(SAVEKEY)),previous);assert(SAVE_DIRTY);
 });
 await test('快照中途导入或删除导致代次变化时，不写回旧进度',async()=>{
  const work=storeSave(null,meta,WORLD);setTimeout(()=>{SAVE_EPOCH++;},1);assert.equal(await work,null);assert(stores.every(m=>!m.has(SAVEKEY)));
 });
 await test('菜单读取有效小索引，不解压或迁移正文',async()=>{
  stores[0].set(METAKEY,JSON.stringify({...meta,at:9}));const previous=global.readSaveRecord;global.readSaveRecord=()=>{throw Error('不应读正文')};try{assert.equal((await readMeta()).at,9);}finally{global.readSaveRecord=previous;}
 });
 await test('独立索引全丢时，仍可由旧正文恢复启动入口',async()=>{stores[1].set(SAVEKEY,'Z0:'+raw);const m=await readMeta();assert.equal(m.day,JSON.parse(raw).day);assert(m.club);});
 await test('已验证副本直接接管世界，迁移结果与旧加载路径一致',async()=>{
  stores[0].set(SAVEKEY,'Z0:'+baseline);const r=await readSaveRecord('adopt');assert(r.prepared);assert.equal(r.str,undefined);const expected=JSON.stringify(r.obj);adoptPreparedSave(r);SAVE_PAUSED=false;assert.equal(JSON.stringify(WORLD),expected);assert.equal(WORLD.day,obj.day);assert.equal(JSON.stringify(WORLD),baseline);
 });
 await test('健康副本补写不重复解压，缺失层恢复相同正文',async()=>{
  await storeSave(baseline,meta);const r=await readSaveRecord('adopt');stores[1].delete(SAVEKEY);const previous=global.readSaveRecord;global.readSaveRecord=()=>{throw Error('不应重复读正文')};try{assert.deepEqual(await healSave(r),['Cache']);assert.equal(stores[1].get(SAVEKEY),r.payload);}finally{global.readSaveRecord=previous;}
 });
 await test('其他层出现更新正文时，补写不会用已读取的旧快照盖回',async()=>{
  await storeSave(baseline,meta);const old=await readSaveRecord('adopt');const newer=JSON.parse(baseline);newer.day++;const packed=await processSaveTask({op:'pack',raw:JSON.stringify(newer),at:old.at+100});stores[1].set(SAVEKEY,packed.payload);await healSave(old);const r=await readSaveRecord();assert.equal(r.obj.day,newer.day);assert(stores.every(m=>m.get(SAVEKEY)===packed.payload));
 });
 await test('畸形候选和正文校验损坏仍被拒绝，保留其他层好档',async()=>{
  await storeSave(baseline,meta);const good=stores[1].get(SAVEKEY),bad=JSON.parse(baseline);bad.players[Object.keys(bad.players)[0]].pos2={};await assert.rejects(()=>storeSave(JSON.stringify(bad),meta));assert.equal(stores[1].get(SAVEKEY),good);stores[0].set(SAVEKEY,'Z0:'+JSON.stringify({...obj,_saveStamp:{at:Date.now()+1000,checksum:1}}));assert(await readSaveRecord());
 });
 const report={passed:results.every(r=>r.pass),checks:results.length,results};fs.writeFileSync(path.join(out,'responsive-save.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks}));process.exit(report.passed?0:1);
})().catch(e=>{console.error(e);process.exit(1)});
