// Uses real calendar advance, match simulation, daily settlement and AI offer generation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');require('./shim.cjs');
newWorld(20261019,'Dalian Yingbo');const baseline=JSON.stringify(WORLD),results=[],coverage=[];
const originals={aiOffersToUser,marketDaily,dailyTick};
function reset(){adoptWorld(JSON.parse(baseline));SAVE_PAUSED=true;clearTimeout(SAVE_TIMER);for(const [n,f] of Object.entries(originals))global[n]=f;global.closeModal=()=>{};global.toast=()=>{};return UC()}
function setup(winter,previousMatch=false,deadlineMatch=false,type='transfer'){
 const u=reset(),dt=new Date(WORLD.season+(winter?1:0),winter?0:7,31),end=Math.round((dt-dateOf(0))/864e5);WORLD.day=end-1;WORLD.inbox=[];
 // Isolate both calendar days while retaining the season's future fixtures.
 const fx=WORLD.fixtures.find(f=>f.comp==='L'&&(f.home===u.id||f.away===u.id));
 WORLD.fixtures=WORLD.fixtures.filter(f=>f.day!==end-1&&f.day!==end);
 if(previousMatch)WORLD.fixtures.push({...fx,day:end-1,played:false});
 if(deadlineMatch)WORLD.fixtures.push({...fx,day:end,played:false});
 const b=WORLD.clubs.find(c=>c.id!==u.id),p=u.squad.map(P).find(p=>p.pos==='ST');while(b.squad.length>=29)toFreeAgent(P(b.squad.at(-1)),b);
 b.finance.balance=1e12;b.finance.locked=0;b.finance.cap0=1e12;
 const cover=makePlayer(60,'ST',24,u.id);WORLD.players[cover.id]=cover;u.squad.push(cover.id);
 p.age=24;p.listed=true;p.autoSell=false;p.askPrice=1000;p.releaseClause=0;p.injury=0;p.susp=0;
 WORLD.offers=[];WORLD.interest=[{pid:p.id,club:b.id,heat:1}];
 const ticks=[],markets=[];
 global.dailyTick=()=>{ticks.push(WORLD.day);originals.dailyTick()};
 global.marketDaily=()=>{markets.push(WORLD.day);originals.marketDaily()};
 global.aiOffersToUser=()=>{
  if(WORLD.day!==end)return;
  const rnd0=global.rnd;global.rnd=()=>0;try{originals.aiOffersToUser()}finally{global.rnd=rnd0}
  const of=WORLD.offers.find(o=>o.pid===p.id&&o.club===b.id);assert(of,'真实 AI 应生成指定报价');
  if(type==='loan')Object.assign(of,{type:'loan',wageShare:1,minApps:0,half:false,fee:0});
 };
 return {end,u:u.id,b:b.id,p:p.id,ticks,markets,winter,previousMatch,deadlineMatch};
}
function step(){const before=WORLD.day,r=advance();if(r.t==='match'){const f=r.fx;CURMATCH=runMatch(createMatch(f.home,f.away,{record:false,userSide:f.home===WORLD.userClub?0:1,...knockoutOpts(f)}));assert(CURMATCH.done);assert.equal(finishUserMatch(),'ok');}else assert.equal(r.t,'day');assert.equal(WORLD.day,before+1);return r.t}
function arrival(c){const route=step();assert.equal(route,c.previousMatch?'match':'day');assert.equal(WORLD.day,c.end);const of=WORLD.offers.find(o=>o.pid===c.p&&o.club===c.b);assert(of);assert.equal(of.day,c.end,'报价必须在截止日生成');assert.equal(of.until,c.end);assert.equal(offerDateError(of),'');assert(!WORLD.inbox.some(m=>m.title===(c.winter?'冬窗':'夏窗')+'关闭'));return of}
function finish(c){const route=step();assert.equal(route,c.deadlineMatch?'match':'day');assert.equal(WORLD.day,c.end+1);assert(!inTransferWindow());assert.equal(WORLD.offers.length,0);assert.equal(WORLD.inbox.filter(m=>m.title===(c.winter?'冬窗':'夏窗')+'关闭').length,1);assert.deepEqual(c.ticks,[c.end-1,c.end]);assert.deepEqual(c.markets,[c.end-1,c.end]);}
function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name)}catch(e){results.push({name,pass:false,error:e.stack});console.log('FAIL',name,e.message)}finally{clearTimeout(SAVE_TIMER)}}
for(const winter of [false,true])for(const previousMatch of [false,true])for(const deadlineMatch of [false,true])test(`${winter?'冬窗':'夏窗'}：前一天${previousMatch?'有':'无'}比赛、截止日${deadlineMatch?'有':'无'}比赛，真实新报价可成交并正常关窗`,()=>{
 const c=setup(winter,previousMatch,deadlineMatch);arrival(c);
 const raw=JSON.stringify(WORLD.offers),money=JSON.stringify(WORLD.clubs.map(c=>c.finance));
 assert.equal(prepareDeadlineMarket(),false);adoptWorld(JSON.parse(JSON.stringify(WORLD)));SAVE_PAUSED=true;assert.equal(prepareDeadlineMarket(),false);assert.equal(JSON.stringify(WORLD.offers),raw);assert.equal(JSON.stringify(WORLD.clubs.map(c=>c.finance)),money);
 assert.equal(acceptOffer(WORLD.offers.findIndex(o=>o.pid===c.p)),true);assert.equal(P(c.p).clubId,c.b);
 assert(WORLD.transferLog.some(t=>t.d===c.end&&t.to===c.b));finish(c);
 coverage.push({window:winter?'winter':'summer',previousMatch,deadlineMatch,offeredDay:c.end,acceptedDay:c.end,closedDay:WORLD.day});
});
for(const winter of [false,true])test(`${winter?'冬窗':'夏窗'}：截止日还价后可成交，租借改条款后可外租`,()=>{
 for(const loan of [false,true]){const c=setup(winter,false,false,loan?'loan':'transfer');const of=arrival(c),query=document.querySelector,index=WORLD.offers.indexOf(of);
  let opens=0;global.openModal=()=>opens++;
  try{if(loan){loanCounterDialog(index);assert.equal(opens,1);document.querySelector=s=>({value:({'#lc-share':'1','#lc-half':'0','#lc-min':'0','#lc-fee':'0'})[s]});const r=global.rnd;global.rnd=()=>.99;try{submitLoanCounter(index)}finally{global.rnd=r}}else{counterOffer(index);assert.equal(opens,1);of.max=of.fee+20000;document.querySelector=()=>({value:String(of.fee+10000)});submitCounter(index)}}finally{document.querySelector=query}
  assert.equal(of.until,c.end);assert(of.countered);assert.equal(acceptOffer(WORLD.offers.indexOf(of)),true);assert.equal(P(c.p).clubId,c.b);if(loan)assert.equal(P(c.p).loan.owner,c.u);finish(c);
 }
});
for(const winter of [false,true])test(`${winter?'冬窗':'夏窗'}：最后一天新到价报价可自动成交，剩余报价关窗清理`,()=>{
 const c=setup(winter);arrival(c);const p=P(c.p);p.autoSell=true;const of=WORLD.offers.find(o=>o.pid===c.p);of.atAsk=true;assert(of.fee>=sellPrice(p));finish(c);assert.equal(P(c.p).clubId,c.b);assert.equal(WORLD.inbox.filter(m=>m.title==='按挂牌条件自动成交').length,1);
});
for(const winter of [false,true])test(`${winter?'冬窗':'夏窗'}：旧档直接停在31日先补报价、不跳日期，读回不重复刷`,()=>{
 const c=setup(winter);WORLD.day=c.end;delete WORLD.deadlineMarketKey;const r=advance();assert.equal(r.t,'deadline');assert.equal(WORLD.day,c.end);assert(WORLD.offers.some(o=>o.pid===c.p));const offers=JSON.stringify(WORLD.offers);adoptWorld(JSON.parse(JSON.stringify(WORLD)));SAVE_PAUSED=true;assert.equal(prepareDeadlineMarket(),false);assert.equal(JSON.stringify(WORLD.offers),offers);
});
const file=process.env.FMFILE||path.resolve(__dirname,'../../index.html'),out=process.env.QA_REPORT||path.resolve(__dirname,'../../output/deadline-20261019/regression.json');fs.writeFileSync(out,JSON.stringify({passed:results.every(r=>r.pass),checks:results.length,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),results,coverage},null,2));process.exit(results.some(r=>!r.pass)?1:0);
