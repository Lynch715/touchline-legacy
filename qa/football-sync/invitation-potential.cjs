const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
require('./shim.cjs');
const out=path.resolve(__dirname,'../../output/invitation-potential-20261110');fs.mkdirSync(out,{recursive:true});
const original=require('./fixtures/invitation-potential-20261108.json');
const oldInvites=vm.runInThisContext('('+original.genNationalInvites+')'),oldFate=vm.runInThisContext('('+original.prospectFate+')');
newWorld(4242,'Manchester City');adoptWorld(JSON.parse(JSON.stringify(WORLD)));SAVE_PAUSED=true;clearTimeout(SAVE_TIMER);initNationalManager();
const results=[],stats={},originalRandom=Math.random,originalNews=global.news,originalStrength=global.natSquadStrength;
const strengths=Object.fromEntries(WC_NATIONS.map(n=>[n,natSquadStrength(n)]));
global.news=()=>{};global.natSquadStrength=n=>strengths[n];
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function test(name,fn){try{fn();results.push({name,passed:true});console.log('PASS',name);}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL',name,e.stack);}finally{Math.random=originalRandom;WORLD.userNation=null;WORLD.nationInvites=[];}}
function inviteSample(fn,rep,trials=6000){WORLD.coachRep=rep;WORLD.userNation=null;Math.random=random(20261110+rep);let china=0,other=0;
 for(let i=0;i<trials;i++){WORLD.nationInvites=[];fn();china+=WORLD.nationInvites.some(x=>x.nat==='中国');other+=WORLD.nationInvites.some(x=>x.nat!=='中国');assert.equal(new Set(WORLD.nationInvites.map(x=>x.nat)).size,WORLD.nationInvites.length);}
 return {trials,chinaRate:china/trials,otherRate:other/trials};}
test('不同声望下中国队邀请显著增加，高声望不再被实力区间排除',()=>{
 stats.invitations={chinaStrength:strengths['中国'],byReputation:{}};
 for(const rep of [15,30,60,90]){const before=inviteSample(oldInvites,rep),after=inviteSample(genNationalInvites,rep);stats.invitations.byReputation[rep]={before,after};assert(after.chinaRate>.46&&after.chinaRate<.65);assert(after.chinaRate>before.chinaRate+.3);assert(after.otherRate>0);}
 assert.equal(stats.invitations.byReputation[90].before.chinaRate,0);
});
test('已有中国队邀请时不重复，仍可生成其他国家邀请',()=>{WORLD.coachRep=90;WORLD.nationInvites=[{nat:'中国',str:143,season:WORLD.season-1}];Math.random=()=>0;genNationalInvites();assert.equal(WORLD.nationInvites.filter(x=>x.nat==='中国').length,1);assert(WORLD.nationInvites.some(x=>x.nat!=='中国'));});
test('正在执教其他国家队时不加邀请，不自动替换当前国家队',()=>{WORLD.userNation='法国';WORLD.nationInvites=[];Math.random=()=>0;genNationalInvites();assert.deepEqual(WORLD.nationInvites,[]);assert.equal(WORLD.userNation,'法国');});
test('低于15声望时不触发额外中国队邀请',()=>{WORLD.coachRep=14;WORLD.nationInvites=[];Math.random=()=>0;genNationalInvites();assert(!WORLD.nationInvites.some(x=>x.nat==='中国'));});
test('中国队邀请沿用既有结构，可接受并保持俱乐部阵容和财政',()=>{WORLD.coachRep=60;WORLD.nationInvites=[];Math.random=()=>0;const clubs=JSON.stringify(WORLD.clubs);genNationalInvites();const offer=WORLD.nationInvites.find(x=>x.nat==='中国');assert.deepEqual(Object.keys(offer),['nat','str','season']);assert(acceptNationalInvite('中国').ok);assert.equal(WORLD.userNation,'中国');assert.equal(WORLD.nationManagers['中国'].name,'你');assert.equal(JSON.stringify(WORLD.clubs),clubs);assert(!acceptNationalInvite('中国').ok);});

const template=structuredClone(UC().squad.map(P).filter(p=>p.pos!=='GK').sort((a,b)=>a.ca-b.ca)[0]);
function prospect(kind=0){const p=structuredClone(template);Object.assign(p,{age:21,ca:120,pa:170,prof:kind===2?5:15,createdAbs:WORLD.season*400});p.development={season:WORLD.season,games:38,apps:kind===2?0:30,weeks:44,startCA:p.ca-(kind===0?8:kind===1?3:0)};return p;}
function fateSample(fn,trials=12000){const roster=Array.from({length:28},(_,i)=>prospect(i<12?0:i<20?1:2));roster.slice(24).forEach(p=>{p.createdAbs=WORLD.season*400+232;});
 const counts={none:0,single:0,multiple:0},buckets={};let total=0,up=0,down=0;seedRng(20261110);
 for(let t=0;t<trials;t++){let changed=0;for(const p of roster){p.pa=170;fn(p);if(p.pa!==170){changed++;if(p.pa>170)up++;else down++;}assert(p.pa<=200&&p.pa>=p.ca);}
  total+=changed;buckets[changed]=(buckets[changed]||0)+1;counts[changed===0?'none':changed===1?'single':'multiple']++;}
 return {trials,roster:{total:28,progressing:12,stable:8,struggling:4,protected:4},meanChanged:total/trials,meanUp:up/trials,meanDown:down/trials,rates:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v/trials])),buckets};}
test('同样28人培养样本中，多人变动比原规则更常见',()=>{const before=fateSample(oldFate),after=fateSample(prospectFate);stats.potential={before,after};assert(after.rates.multiple>before.rates.multiple*2);assert(after.rates.multiple>after.rates.single);assert(after.meanChanged>before.meanChanged*1.8);assert(after.rates.none>0);assert(after.rates.single>0);assert(Math.abs(after.meanDown-before.meanDown)<.03);});
test('原来未触发的良好培养样本现在可以上调，潜力仍受200上限约束',()=>{const oldRnd=global.rnd;global.rnd=()=>.10;try{const p=prospect(),q=structuredClone(p);oldFate(p);prospectFate(q);assert.equal(p.pa,170);assert(q.pa>170);q.pa=199;prospectFate(q);assert.equal(q.pa,200);}finally{global.rnd=oldRnd;}});
test('新青训、观察周数和比赛不足继续保护，年龄29岁仍不触发年度升降',()=>{const oldRnd=global.rnd;global.rnd=()=>0;try{for(const patch of [{createdAbs:WORLD.season*400+232},{age:29},{weeks:25},{games:11}]){const p=prospect();if(patch.weeks!=null||patch.games!=null)Object.assign(p.development,patch);else Object.assign(p,patch);prospectFate(p);assert.equal(p.pa,170);}}finally{global.rnd=oldRnd;}});
test('负面评估和30岁以上年龄收窄规则不因上调概率改变',()=>{const oldRnd=global.rnd;global.rnd=()=>0;try{for(const age of [21,30,35]){const p=prospect(2);p.age=age;const q=structuredClone(p);oldFate(p);prospectFate(q);assert.equal(q.pa,p.pa);}}finally{global.rnd=oldRnd;}});
test('读取旧结构不补发邀请、不追溯改变球员潜力',()=>{const pending=[{nat:'中国',str:143,season:WORLD.season-1}];WORLD.nationInvites=pending;const raw=JSON.stringify(WORLD),input=JSON.parse(raw),players=JSON.stringify(WORLD.players);adoptWorld(input);SAVE_PAUSED=true;clearTimeout(SAVE_TIMER);assert.equal(JSON.stringify(input),raw);assert.deepEqual(WORLD.nationInvites,pending);assert.equal(JSON.stringify(WORLD.players),players);const normalized=JSON.stringify(WORLD);adoptWorld(JSON.parse(normalized));SAVE_PAUSED=true;assert.equal(JSON.stringify(WORLD),normalized);});
Math.random=originalRandom;global.news=originalNews;global.natSquadStrength=originalStrength;clearTimeout(SAVE_TIMER);
const report={passed:results.every(x=>x.passed),checks:results.length,stats,results};fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks,stats},null,2));process.exit(report.passed?0:1);
