const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks'),crypto=require('node:crypto');
require('./shim.cjs');
newWorld(4242,'Manchester City');SAVE_PAUSED=true;
const baseline=JSON.stringify(WORLD),results=[],metrics={};
function reset(){adoptWorld(JSON.parse(baseline));SAVE_PAUSED=true;return UC();}
async function test(name,fn){try{reset();await fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL',name,e.stack);}finally{clearTimeout(SAVE_TIMER);}}
(async()=>{
await test('无赛果、无伤停时不凭空生成事件，周报仅引用实际状态与赛果',()=>{
 WORLD.inbox=[];for(let i=0;i<30;i++)processNewsEvents();assert.equal(WORLD.inbox.length,0);
 const c=UC(),p=P(c.lineup[1]);p.injury=12;const f=WORLD.fixtures.find(f=>f.home===c.id||f.away===c.id);WORLD.day=f.day;f.played=true;f.hg=2;f.ag=1;processNewsEvents();
 assert.equal(WORLD.inbox.length,1);assert(WORLD.inbox[0].body.includes('2-1'));assert(WORLD.inbox[0].body.includes(p.cn));assert.equal(WORLD.inbox[0].title,'每周球队报告');
});
for(const reason of ['injury','susp'])await test(reason+'临时补位、常用阵容逐字不变、恢复后自动回原位置',()=>{
 const c=UC(),opp=WORLD.clubs.find(x=>x.id!==c.id),saved=JSON.stringify([c.lineup,c.subs,c.tactic]),id=c.lineup[1];P(id)[reason]=3;
 const M=createMatch(c.id,opp.id);assert(!M.teams[0].men.some(m=>m.id===id));assert.equal(JSON.stringify([c.lineup,c.subs,c.tactic]),saved);
 repairLineup(c);assert.equal(JSON.stringify([c.lineup,c.subs,c.tactic]),saved);
 const copy=JSON.parse(JSON.stringify(WORLD));adoptWorld(copy);assert.deepEqual(UC().lineup,JSON.parse(saved)[0]);P(id)[reason]=0;
 const N=createMatch(c.id,opp.id);assert.equal(N.teams[0].men.find(m=>m.slot===1).id,id);
});
await test('离队才清理常用名单，转会修补仍保留其他伤停主力',()=>{const c=UC(),a=c.lineup[1],b=c.lineup[2];P(a).injury=9;c.squad=c.squad.filter(id=>id!==b);repairLineup(c);assert.equal(c.lineup[1],a);assert(!c.lineup.includes(b));assert.equal(new Set(c.lineup).size,11);});
await test('国家队伤停临时补位不改常用首发，手调其他位置也不抹掉伤停主力',()=>{
 WORLD.userNation='中国';const T=ensureNationalTeam('中国'),preview=nationalPreview('中国');T.lineup=[...preview.lineup];T.subs=[...preview.subs];const id=T.lineup[1],other=T.lineup[2];P(id).injury=10;const saved=JSON.stringify(T);
 const next=nationalPreview('中国');assert(!next.lineup.includes(id));assert.equal(JSON.stringify(T),saved);
 assert(setNationalStarter(2,next.subs.find(id=>P(id).pos!=='GK')));assert.equal(T.lineup[1],id);assert.notEqual(T.lineup[2],other);
 P(id).injury=0;assert.equal(nationalPreview('中国').lineup[1],id);
});
await test('国家队球员可见真实属性，但不获得俱乐部个人训练或续约权限',()=>{
 WORLD.userNation='中国';const p=natPlayerPool('中国').find(p=>ownerOf(p)!==WORLD.userClub);let body,footer;const modal=global.openModal;global.openModal=(t,b,f)=>{body=b;footer=f;};try{showPlayer(p.id);}finally{global.openModal=modal;}
 assert(!body.includes('球探了解程度 0%'));assert(!footer.includes('个人训练'));assert(!footer.includes('renewContract'));assert(body.includes('技术'));assert(nationalPlayerSummary(p).includes('能力 '+ovr(p)));
});
await test('自定义训练与均衡按能力贡献计费：多位置、多随机种子12周对照',()=>{
 const c=UC(),original=P(c.squad[0]),id=original.id;c.squad=[id];c.coachRating=15;c.trainIntensity=2;c.trainFocus='balanced';c.seasonStats.p=20;
 const rows=[];
 for(const pos of ['DC','MC','ST','GK']){
  const base={...structuredClone(original),pos,age:20,ca0:50,pa:195,prof:15,ambition:15,apps:20,injury:0,dev:0,loan:null,legend:false,a:Object.fromEntries(ATTR_KEYS.map(k=>[k,8]))};base.ca=calcCA(base.a,pos);
  const totals={balanced:0,custom:0};
  for(let seed=1;seed<=80;seed++)for(const mode of ['balanced','custom']){
   const p=structuredClone(base);p.trainPlan=mode==='custom'?[pos==='GK'?'reflex':pos==='ST'?'passing':'pace']:[];WORLD.players[id]=p;seedRng(seed);
   for(let week=0;week<12;week++){WORLD.day=week*7;trainClub(c);}
   totals[mode]+=p.ca-base.ca;
  }
  const ratio=totals.custom/Math.max(1,totals.balanced);rows.push({pos,...totals,ratio});assert(ratio>=0.90&&ratio<=1.35,JSON.stringify(rows.at(-1)));
 }
 metrics.training=rows;
});
await test('相同训练、出场、联赛条件下，自练和外租成长逐项相同',()=>{
 const c=UC(),id=c.squad[0],owner=WORLD.clubs.find(x=>x.id!==c.id);owner.nation=c.nation;owner.tier=c.tier;owner.rep=c.rep;c.squad=[id];
 const base=structuredClone(P(id));Object.assign(base,{age:20,ca0:40,pa:200,injury:0,dev:0,apps:20,trainPlan:['pace']});c.seasonStats.p=20;
 const states=[];for(const loan of [null,{owner:owner.id,wageShare:1}]){WORLD.players[id]=structuredClone(base);P(id).loan=loan;seedRng(100);for(let w=0;w<40;w++)trainClub(c);states.push([P(id).ca,P(id).dev,P(id).a]);}assert.deepEqual(states[0],states[1]);
});
await test('传奇1.8倍成长且22岁释放成长上限，已有传奇立即生效',()=>{
 const c=UC(),id=c.squad[0];c.squad=[id];const base=structuredClone(P(id));Object.assign(base,{age:20,ca0:45,pa:195,injury:0,dev:0,apps:20,legend:false,a:Object.fromEntries(ATTR_KEYS.map(k=>[k,8]))});base.ca=calcCA(base.a,base.pos);c.seasonStats.p=20;
 const states=[];for(const legend of [false,true]){WORLD.players[id]=structuredClone(base);P(id).legend=legend;seedRng(34);for(let w=0;w<40;w++)trainClub(c);states.push({ca:P(id).ca,gain:P(id).ca-base.ca,cap:devCap(P(id))});}
 assert(states[1].gain>states[0].gain);assert(states[1].cap>states[0].cap);P(id).age=22;assert(devCap(P(id))>=P(id).pa);metrics.legend=states;
});
await test('训练属性达到上限不吞掉已积累进度，不超过潜力/年龄上限',()=>{const c=UC(),id=c.squad[0];c.squad=[id];const p=P(id);p.a=Object.fromEntries(ATTR_KEYS.map(k=>[k,20]));p.ca=calcCA(p.a,p.pos);p.ca0=p.ca;p.pa=p.ca;p.age=26;p.dev=3;p.trainPlan=['pace'];p.injury=0;trainClub(c);assert(p.dev>=1);assert(p.ca<=p.pa);});
await test('100000次伤情抽样：轻伤为主，长伤仅少数，训练重伤最长35天',()=>{
 seedRng(822);const n=100000,counts={short:0,medium:0,long:0,total:0};for(let i=0;i<n;i++){const d=rollInjuryDays();counts.total+=d;if(d<=7)counts.short++;else if(d<=21)counts.medium++;else counts.long++;assert(d>=2&&d<=60);assert(rollInjuryDays(true)<=35);}
 counts.mean=counts.total/n;metrics.injuries=counts;assert(counts.short/n>0.77);assert(counts.long/n<0.032);assert(counts.mean<8);
});
await test('英甲600M余额即时支持额外年薪、董事会最多留存20%，负资产无现金加成',()=>{
 const c=WORLD.clubs.find(c=>c.nation===0&&c.tier===2)||UC();WORLD.userClub=c.id;c.finance.balance=600e6;c.finance.locked=390e6;c.finance.cap0=2e6;c.finance.rev0=3e6;const before=JSON.stringify(c.finance),cap=wageCap(c),support=cashWageSupport(c);
 assert.equal(boardReserve(c),120e6);assert(support>100e6);assert(cap>100e6);assert(avail(c)>400e6);assert.equal(JSON.stringify(c.finance),before);
 assert(canAfford(c,0,10e6).ok);c.finance.balance+=30e6;assert(wageCap(c)>cap);assert.equal(JSON.stringify(c.finance).includes('390000000'),true);
 metrics.finance={cap,support,reserve:120e6};c.finance.balance=-1;assert.equal(cashWageSupport(c),0);assert.equal(boardReserve(c),0);
});
await test('赛季初余额保留80%可用，未把留存当作实际现金扣款',()=>{const c=UC();c.finance.balance=600e6;c.finance.payables=[];resetSeasonFinance(c);assert.equal(c.finance.balance,600e6);assert.equal(c.finance.locked,120e6);assert(wageCap(c)>100e6);});
await test('同步/分批结算用同一个引擎，12场同日结果和财政逐字一致、日期不重复推进',async()=>{
 const c=UC();WORLD.day=105;WORLD.fixtures=WORLD.fixtures.filter(f=>f.day!==105||![f.home,f.away].includes(c.id));WORLD.fixtures=WORLD.fixtures.filter(f=>f.day!==105).concat(WORLD.fixtures.filter(f=>f.day===105).slice(0,12));
 adoptWorld(JSON.parse(JSON.stringify(WORLD)));SAVE_PAUSED=true;const sample=JSON.stringify(WORLD);seedRng(55);const r=advance(),sync=JSON.stringify(WORLD);adoptWorld(JSON.parse(sample));SAVE_PAUSED=true;seedRng(55);
 let ticks=0;const timer=setInterval(()=>ticks++,0);let asyncResult;try{asyncResult=await runSimulationUI(advanceSteps());}finally{clearInterval(timer);}
 assert.deepEqual(asyncResult,r);const actual=JSON.stringify(WORLD);if(actual!==sync){let i=0;while(actual[i]===sync[i])i++;throw new Error(JSON.stringify({offset:i,actual:actual.slice(i-100,i+150),expected:sync.slice(i-100,i+150)}));}assert(ticks>1);metrics.async={timerTicks:ticks};
});
await test('当前旧档导入逐字不变，保留个人训练、阵容、资金、已有伤病',()=>{const c=UC();P(c.lineup[1]).injury=40;P(c.lineup[2]).trainPlan=['pace'];const json=JSON.stringify(WORLD),input=JSON.parse(json);adoptWorld(input);assert.equal(JSON.stringify(input),json);assert.equal(JSON.stringify(WORLD),json);validateWorld(WORLD);});
const report={sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(process.env.FMFILE||path.resolve(__dirname,'../../index.html'))).digest('hex'),passed:results.every(x=>x.pass),checks:results.length,metrics,results};fs.mkdirSync(path.resolve('output/player-feedback-20261022'),{recursive:true});fs.writeFileSync('output/player-feedback-20261022/regression.json',JSON.stringify(report,null,2));console.log('METRICS',JSON.stringify(metrics));process.exit(report.passed?0:1);
})();
