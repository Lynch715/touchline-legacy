const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');require('./shim.cjs');
const file='output/promotion-rules-fix-20261025/before-season-new.json';adoptOwnedWorld(JSON.parse(fs.readFileSync(file,'utf8')));SAVE_PAUSED=true;
const c=UC(),endDay=WORLD.day,keep=new Set([...c.lineup,...c.subs,...c.squad].filter(x=>x!=null).slice(0,17));
for(const id of [...c.squad])if(!keep.has(id))toFreeAgent(P(id),c);
for(const p of c.squad.map(P)){p.age=24;p.contract=WORLD.season+5;}
Object.assign(c.finance,{balance:1e10,locked:0,rev0:1e9,cap0:1e9});FIN_CLK++;
WORLD.day=0;const p=WORLD.freeAgents.map(P).find(p=>p&&emergencySigningCheck(c,p,emergencyWageDemand(p)).ok);assert(p);p.age=24;
assert(transferPlayer(p.id,c.id,0,emergencyWageDemand(p),1,{emergency:true}));assert.equal(p.contract,WORLD.season);
const year=WORLD.season,expected=new Set(c.squad.filter(id=>id!==p.id));WORLD.day=endDay;assert.equal(WORLD.fixtures.filter(f=>!f.played).length,0);assert.equal(nationalFixtures().filter(f=>!f.played).length,0);
assert.notEqual(endSeason(),false,'完整已完赛旧档应能正常跨季');SAVE_PAUSED=true;clearTimeout(SAVE_TIMER);
assert.equal(WORLD.season,year+1);assert(!UC().squad.includes(p.id));assert.deepEqual(new Set(UC().squad),expected,'不自动补人、续约或裁掉原球员');assert(WORLD.inbox.some(m=>m.title===p.cn+' 合同到期离队'));validateWorld(WORLD);
const report={passed:true,checks:1,yearBefore:year,yearAfter:WORLD.season,emergencyPlayer:p.id,remainingSquad:UC().squad.length,manualRosterPreserved:true};fs.writeFileSync(path.resolve(__dirname,'../../output/squad-rebuild-20261031/season-expiry.json'),JSON.stringify(report,null,2));console.log('PASS 应急合同真实赛季交接到期离队，原阵容保留且不自动补人');process.exit(0);
