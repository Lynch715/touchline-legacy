const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');require('./shim.cjs');
newWorld(4242,'Coventry City');const legacy=JSON.stringify(WORLD),maps=[new Map(),new Map(),new Map()],results=[];
global.idbGet=async k=>maps[0].get(k);global.idbSet=async(k,v)=>maps[0].set(k,v);global.cacheGet=async k=>maps[1].get(k);global.cacheSet=async(k,v)=>maps[1].set(k,v);
global.localStorage={getItem:k=>maps[2].get(k),setItem:(k,v)=>maps[2].set(k,v)};
function ok(name){results.push(name);console.log('PASS',name)}
(async()=>{
 await storeSave(legacy,{club:UC().cn,season:WORLD.season,day:0});const good=maps[0].get(SAVEKEY),body=JSON.parse(await unzipSave(good));assert(Number.isInteger(body._saveStamp.checksum));ok('新正文随时间戳保存校验值');
 const bad=structuredClone(body);bad.players[1].age++;bad._saveStamp.at+=1000;const broken=await zipSave(JSON.stringify(bad));maps[0].set(SAVEKEY,broken);assert.equal(JSON.parse(await readSave()).players[1].age,body.players[1].age);ok('合法JSON内的字段损坏不能击败旧的完整副本');
 await healSave();assert.equal(maps[0].get(SAVEKEY),good);ok('自愈不会传播校验失败的正文');
 for(const payload of [legacy,'Z0:'+legacy,await zipSave(legacy)]){for(const m of maps)m.clear();maps[1].set(SAVEKEY,payload);assert.equal(JSON.parse(await readSave()).day,0)}ok('不带校验值的旧裸JSON、Z0和原压缩存档仍可恢复');
 const snapshot=JSON.stringify(body);for(const m of maps)m.clear();await storeSave(snapshot,{club:UC().cn,season:WORLD.season,day:0});assert.equal(JSON.parse(await readSave()).day,0);ok('再次保存已含时间戳的正文不会产生自引用校验值');
 fs.writeFileSync(process.env.QA_REPORT||path.resolve(__dirname,'../../output/football-sync/checksum.json'),JSON.stringify({passed:true,checks:results.length,results},null,2));clearTimeout(SAVE_TIMER);process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
