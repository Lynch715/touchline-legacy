// 用显式指定的修复前源码构造旧世界，不读取个人存档。
const fs=require('node:fs'),path=require('node:path');
if(!process.env.FMFILE)throw Error('请通过 FMFILE 指定修复前 index.html');
const dir=path.resolve(process.env.COMPETITION_FIXTURE_DIR||'/private/tmp/fm-competition-fixtures-20261024');fs.mkdirSync(dir,{recursive:true});require('./shim.cjs');
newWorld(4242,'Dalian Yingbo');SAVE_PAUSED=true;clearTimeout(SAVE_TIMER);
fs.writeFileSync(path.join(dir,'raw.json'),JSON.stringify(WORLD));adoptWorld(JSON.parse(JSON.stringify(WORLD)));fs.writeFileSync(path.join(dir,'normalized.json'),JSON.stringify(WORLD));
const day=WORLD.clubCups.AFC.gdays[0];WORLD.day=day;
for(const f of WORLD.fixtures.filter(f=>f.comp==='AFC'&&f.day===day)){autoPickLineup(C(f.home));autoPickLineup(C(f.away));const m=runMatch(createMatch(f.home,f.away,{comp:'AFC',record:false,...knockoutOpts(f)}));applyResult(f,m);}
clubCupsDayEnd(day);WORLD.day++;adoptWorld(JSON.parse(JSON.stringify(WORLD)));fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify(WORLD));clearTimeout(SAVE_TIMER);console.log('构造旧世界夹具完成：'+dir);
