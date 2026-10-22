const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
require('./shim.cjs');newWorld(4222,'Manchester City');SAVE_PAUSED=true;
const report={sha256:crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),checks:[],cupNames:WORLD.cups.map(c=>c.name)};
for(const cup of WORLD.cups){
 const f=WORLD.fixtures.find(f=>f.comp==='C'&&f.nation===cup.nation&&!f.played);assert(f,cup.name);resetMatchSession(true);WORLD.userClub=f.home;WORLD.needJob=false;WORLD.day=f.day;
 const before=JSON.stringify(f),day=WORLD.day,r=advance();assert.equal(r.t,'match',cup.name);assert.equal(r.fx,f);assert.equal(JSON.stringify(f),before);assert.equal(WORLD.day,day);assert(startUserMatch(f));pauseMatchPlayback();assert.equal(CURMATCH.comp,'C');assert.equal(CURMATCH.userSide,0);assert(!f.played);assert.equal(currentMatchFixture(),f);assert(canSub(CURMATCH,0));report.checks.push({name:cup.name,nation:cup.nation,day,manual:true});
}
resetMatchSession(true);
// 截图中的情境：近期输过联赛、射手赛季12球，不能据此编造杯赛淘汰或单场12球。
WORLD.userClub=WORLD.clubs.find(c=>c.en==='Newcastle United').id;WORLD.day=37;WORLD.inbox=[];const u=UC();u.form=['W','D','L'];
u.squad.map(P).forEach((p,i)=>{p.injury=0;p.susp=0;p.goals=i===0?12:0;});
const league=WORLD.fixtures.find(f=>f.comp==='L'&&f.home===u.id);league.day=36;league.played=true;league.hg=0;league.ag=1;
for(let i=0;i<40;i++)processNewsEvents();
assert(WORLD.inbox.length>0);assert(WORLD.inbox.every(m=>m.title==='每周球队报告'));assert(!WORLD.inbox.some(m=>m.title==='杯赛出局'||m.body.includes('贡献了 12 个进球')));assert(WORLD.inbox.every(m=>m.body.includes('0-1')));
report.screenshotMail={checks:3,passes:true,weeklyReports:WORLD.inbox.length,falseCupExit:false,falseSingleMatch12Goals:false,actualScoreIncluded:true};
clearTimeout(SAVE_TIMER);fs.mkdirSync('output/cup-followup-20261022',{recursive:true});fs.writeFileSync('output/cup-followup-20261022/audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:report.checks.length+report.screenshotMail.checks,cupNames:report.cupNames}));
