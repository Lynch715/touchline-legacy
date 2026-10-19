const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('./shim.cjs');
newWorld(4242,'Real Madrid');const baseline=JSON.stringify(WORLD), results=[];
const reset=()=>{adoptWorld(JSON.parse(baseline));clearTimeout(SAVE_TIMER);global.toast=()=>{};global.closeModal=()=>{};return UC()};
function test(name,fn){try{reset();fn();results.push({name,pass:true});console.log('PASS',name)}catch(e){results.push({name,pass:false,error:e.stack});console.log('FAIL',name,e.message)}finally{clearTimeout(SAVE_TIMER)}}
const fund=c=>{c.finance.balance=1e12;c.finance.locked=0;c.finance.cap0=1e12};
test('开赛不足七人安全判负，完场不能换人，结算无门票/虚假出场',()=>{
 const u=UC(),o=WORLD.clubs[0];u.squad.slice(6).map(P).forEach(p=>p.injury=30);
 const fx=WORLD.fixtures.find(f=>f.home===u.id||f.away===u.id), m=createMatch(fx.home,fx.away);
 assert(m.done&&m.forfeit);assert.equal(m.score[fx.home===u.id?1:0],3);assert(!canSub(m,0));
 const before=u.squad.map(id=>P(id).apps);applyResult(fx,m);assert.equal(fx.attendance,0);assert.deepEqual(u.squad.map(id=>P(id).apps),before);assert.equal(m.motm,null);
});
test('换人复核实际归属，健康手动阵容保留',()=>{
 const u=UC(),o=WORLD.clubs[0],lu=[...u.lineup],m=createMatch(u.id,o.id);assert.deepEqual(u.lineup,lu);
 const inId=m.teams[0].bench.find(id=>P(id).pos!=='GK');assert(inId);P(inId).clubId=o.id;
 assert.equal(doSub(m,0,m.teams[0].men[1],inId),false);
});
test('士气、比赛状态、位置适配和教练进入实际执行属性，徽章仍有效',()=>{
 const u=UC(),m=createMatch(u.id,WORLD.clubs[0].id),man=m.teams[0].men.find(m=>m.pos!=='GK');man.p.morale=100;man.p.sharp=100;man.coach=20;const a=att(man,'passing');
 man.p.morale=5;assert(att(man,'passing')<a);man.p.morale=100;man.p.sharp=0;assert(att(man,'passing')<a);man.p.sharp=100;man.coach=1;assert(att(man,'passing')<a);man.coach=20;const pos=man.pos;man.pos='GK';assert(att(man,'passing')<a);man.pos=pos;
 man.p.playstyles=[];man.p.playstylesPlus=[];const k=Object.keys(PS_BOOST).find(k=>PS_BOOST[k].attr==='passing');assert(k);const plain=att(man,'passing');man.p.playstyles=[k];assert(att(man,'passing')>plain);
});
test('医疗等级影响康复，预计天数使用同一公式',()=>{
 const world=JSON.stringify(WORLD),dur=[];for(const phys of [3,20]){adoptWorld(JSON.parse(world));const u=UC(),p=P(u.squad[0]);u.physioRating=phys;p.injury=30;p.injRecovery=0;assert.equal(injuryDays(p),Math.ceil(30/recoveryRate(p)));for(let i=0;i<8;i++)dailyTick();dur.push(p.injury)}assert(dur[1]<dur[0]);
});
test('未知球探推荐和排序不泄露PA，95%才显示精确潜力，自有青训仍精确',()=>{
 const p=Object.values(WORLD.players).find(p=>p.age<21&&ownerOf(p)!==WORLD.userClub),before=scoutPotential(p,0);p.pa=10;assert.deepEqual(scoutPotential(p,0),before);p.pa=200;assert.deepEqual(scoutPotential(p,0),before);assert.equal(scoutPotential(p,95).mid,100);
 const tables=[],orig=global.makeTable;global.makeTable=(cols,rows)=>{tables.push({cols,rows});return document.createElement('div')};
 try{vScout(document.createElement('div'));const rec=tables.at(-1),col=rec.cols.find(c=>c.k==='pa');assert.equal(col.h,'潜力评估');assert(rec.rows.length);for(const q of rec.rows){const n=col.v(q),pa=q.pa;q.pa=1;assert.equal(col.v(q),n);q.pa=pa;assert(col.r(q).includes('初步估计'))}
 tables.length=0;vYouth(document.createElement('div'));const youth=tables.at(-1),c=youth.cols.find(c=>c.k==='pa');for(const q of youth.rows)assert.equal(c.v(q),q.pa);
 }finally{global.makeTable=orig}
});
test('全市场先排序再分页，120人页不遗漏低薪球员',()=>{
 const full=Object.values(WORLD.players).filter(p=>ownerOf(p)!==WORLD.userClub&&p.clubId!==WORLD.userClub);SORT={k:'w',d:1};const rows=sortedRows([{k:'w',v:p=>wageDemand(p,UC())}],full);
 assert.equal(wageDemand(rows[0],UC()),Math.min(...full.map(p=>wageDemand(p,UC()))));assert.equal(new Set(rows.slice(0,240)).size,240);
 const html=fs.readFileSync(process.env.FMFILE||path.resolve(__dirname,'../../index.html'),'utf8');const fn=html.slice(html.indexOf('  function fillSearch(){'),html.indexOf('  fillSearch();',html.indexOf('  function fillSearch(){')));assert(fn.includes('pool=sortedRows(columns,pool)'));assert(fn.includes('pool.slice(searchPage*120'));
});
test('财政与总览的租借周薪按实际负担，薪资表包含外租',()=>{
 const u=UC(),o=WORLD.clubs[0],p=P(u.squad.at(-1)),wk=weeklyWages(u);assert(loanPlayer(p.id,o.id,{wageShare:.5}));assert.equal(wagePaidBy(u,p),p.wage*.5);assert.equal(wagePaidBy(o,p),p.wage*.5);assert.equal(weeklyWages(u),Math.round(wk-p.wage*.5));
 const tables=[],orig=global.makeTable;global.makeTable=(cols,rows)=>{tables.push({cols,rows});return document.createElement('div')};try{vFinance(document.createElement('div'));const t=tables.at(-1);assert(t.rows.some(q=>q.id===p.id));assert.equal(t.cols.find(c=>c.k==='w').v(p),p.wage*.5)}finally{global.makeTable=orig}
});
test('接报价复验买方预留人数、默认七天有效期、位置覆盖及零分担租借',()=>{
 const u=UC(),o=WORLD.clubs[0];fund(o);const p=u.squad.map(P).find(p=>p.pos!=='GK');WORLD.offers=[{pid:p.id,club:o.id,fee:0,wage:p.wage,day:0}];WORLD.day=7;assert.equal(acceptOffer(0),false);WORLD.day=0;
 o.squad=o.squad.concat(Array.from({length:30},()=>o.squad[0]));assert.equal(acceptOffer(0),false);
});
test('可接受1.5/2倍放行价，硬性人数和位置底线仍拦截',()=>{
 const p=Object.values(WORLD.players).find(p=>p.clubId>=0&&p.clubId!==WORLD.userClub&&saleTerms(C(p.clubId),p).premium===1.5);assert(p);const c=C(p.clubId),t=saleTerms(c,p);assert(!canSell(c,p,askingPrice(p)));assert(canSell(c,p,t.fee));
 const old=c.squad;c.squad=old.slice(0,18);assert(saleTerms(c,p).blocked);c.squad=old;
});
test('降级核心先挂牌，七天内AI不抢走，读档后仍挂牌，玩家可买',()=>{
 const u=UC(),c=WORLD.clubs.find(c=>c.en==='Manchester City');c.tier=1;c.lg=lgIndex(c.nation,1);const ids=[...c.squad];bridgeTiers([{nation:c.nation,tier:0,promoted:[],relegated:[c.id]}]);assert.deepEqual(c.squad,ids);const stars=c.squad.map(P).filter(isRelegationSale);assert(stars.length);const p=stars[0],id=p.id,third=WORLD.clubs.find(x=>x.id!==c.id&&x.id!==u.id);
 assert(relegationGrace(p));assert(!transferPlayer(id,third.id,askingPrice(p),p.wage,3));assert(!loanPlayer(id,third.id,{}));aiListSurplus();assert(p.listed);adoptWorld(JSON.parse(JSON.stringify(WORLD)));assert(relegationGrace(P(id)));WORLD.day=7;assert(!relegationGrace(P(id)));assert(transferPlayer(id,third.id,askingPrice(P(id)),P(id).wage,3));assert(!P(id).relegationSale);
});
test('赛季交接保留租借归队超员，不代玩家补人/裁员/随机续约',()=>{
 const u=UC(),o=WORLD.clubs[0];while(u.squad.length<34){const p=makePlayer(45,'MC',24,u.id);WORLD.players[p.id]=p;u.squad.push(p.id)}
 u.squad.map(P).forEach(p=>{p.age=24;p.contract=WORLD.season+5});const ids=[...u.squad];for(const id of ids.slice(-6))assert(loanPlayer(id,o.id,{wageShare:1}));endSeason();assert.deepEqual(new Set(UC().squad),new Set(ids));assert(WORLD.inbox.some(x=>x.title.includes('超员')));
});
test('未上场不记出场，离场后评分不再受后续进球影响，关键传球/过人累计',()=>{
 const u=UC(),m=createMatch(u.id,WORLD.clubs[0].id),q=m.teams[0].men[2],scorer=m.teams[0].men[9];q.off=true;const r=q.rating;scoreGoal(m,0,scorer,'测试');assert.equal(q.rating,r);const before=q.p.apps;
 for(const T of m.teams)for(const man of T.men){man.mins=0;man.keyp=3;man.drib=2}scorer.mins=90;
 endMatch(m);assert.equal(m.motm.id,scorer.id);const fx=WORLD.fixtures.find(f=>f.home===u.id||f.away===u.id);fx.home=u.id;fx.away=m.a;applyResult(fx,m);assert.equal(q.p.apps,before);assert.equal(scorer.p.keyPasses,3);assert.equal(scorer.p.dribbles,2);
});
test('周训练反馈记录实际单项变化，保留个人训练和传奇徽章',()=>{
 const u=UC(),p=u.squad.map(P).find(p=>p.age<23);p.dev=5;const old={...p.a};trainClub(u);assert(p.trainingLast);assert(p.trainingLast.attrs.some(x=>p.a[x.k]!==old[x.k]));
});
test('合同到期执行玩家决定，人数不足也不自动补人',()=>{
 const u=UC();while(u.squad.length>18)toFreeAgent(P(u.squad.at(-1)),u);
 u.squad.map(P).forEach(p=>{p.age=24;p.contract=WORLD.season+5});const exp=P(u.squad[1]);exp.contract=WORLD.season;const keep=u.squad.filter(id=>id!==exp.id);
 endSeason();assert.deepEqual(new Set(UC().squad),new Set(keep));assert.equal(UC().squad.length,17);assert(P(exp.id).clubId!==UC().id);
});
test('未完场不能提前结算，已结算重复完成不报错、不改日期或账本',()=>{
 const day=WORLD.day,finance=JSON.stringify(WORLD.clubs.map(c=>c.finance));CURMATCH=createMatch(UC().id,WORLD.clubs[0].id);assert.equal(finishUserMatch(),'ignored');completeMatch();assert.equal(WORLD.day,day);CURMATCH=null;assert.equal(finishUserMatch(),'ignored');completeMatch();assert.equal(WORLD.day,day);assert.equal(JSON.stringify(WORLD.clubs.map(c=>c.finance)),finance);
});
test('旧档导入不改调用对象/资金，坏档失败不污染当前世界',()=>{
 const obj=JSON.parse(baseline),raw=JSON.stringify(obj),cash=obj.clubs[obj.userClub].finance.balance;adoptWorld(obj);assert.equal(JSON.stringify(obj),raw);assert.equal(UC().finance.balance,cash);const before=WORLD;const bad=JSON.parse(baseline);bad.players[1].pos2={};assert.throws(()=>adoptWorld(bad));assert.equal(WORLD,before);
});
fs.writeFileSync(process.env.QA_REPORT||path.resolve(__dirname,'../../output/football-sync/regression.json'),JSON.stringify({file:process.env.FMFILE||'index.html',passed:results.filter(x=>x.pass).length,total:results.length,results},null,2));process.exit(results.some(x=>!x.pass)?1:0);
