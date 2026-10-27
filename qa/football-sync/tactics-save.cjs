const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');require('./shim.cjs');global.closeModal=()=>{};
(async()=>{
 newWorld(4242,'Manchester City');adoptWorld(structuredClone(WORLD));SAVE_PAUSED=true;
 for(const [i,form]of ['4-4-2','4-3-3','3-5-2'].entries()){remapLineup(UC(),form);presetSave(i);}
 const before=JSON.stringify(UC().presets),maps=[new Map(),new Map(),new Map()];
 global.idbGet=async k=>maps[0].get(k)||null;global.idbSet=async(k,v)=>maps[0].set(k,v);global.cacheGet=async k=>maps[1].get(k)||null;global.cacheSet=async(k,v)=>maps[1].set(k,v);global.localStorage={getItem:k=>maps[2].get(k)||null,setItem:(k,v)=>maps[2].set(k,v)};
 SAVE_PAUSED=false;await storeSave(JSON.stringify(WORLD),{club:UC().cn,season:WORLD.season,day:WORLD.day});
 assert(maps.every(m=>m.get(SAVEKEY)===maps[0].get(SAVEKEY)));const decoded=JSON.parse(await unzipSave(maps[0].get(SAVEKEY)));assert(Number.isInteger(decoded._saveStamp.checksum));const saved=await readSaveRecord();assert(saved);adoptWorld(saved.obj);SAVE_PAUSED=true;assert.equal(JSON.stringify(UC().presets),before);
 for(const [i,form]of ['4-4-2','4-3-3','3-5-2'].entries()){assert(presetApply(i));assert.equal(UC().tactic.formation,form);assert.equal(JSON.stringify(UC().presets),before);}
 const results=['三套方案经过真实压缩及正文校验保存到三层存储','读取、校验、导入后方案逐字保留','导入后各方案仍可切换且互不覆盖'];const report={passed:true,checks:results.length,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),results};fs.writeFileSync('output/tactics-presets-20261027/compressed-save.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));clearTimeout(SAVE_TIMER);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
