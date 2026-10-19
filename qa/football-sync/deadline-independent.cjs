// Run real advance -> simDay -> processDayEnd -> marketDaily -> AI generation.
// Spies call the original functions; no market, daily/weekly tick or AI stub is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
require('./shim.cjs');
newWorld(20261019,'Real Madrid');const base=JSON.stringify(WORLD),results=[];
const names=['dailyTick','weeklyTick','faSigningRound','marketDaily','simDay','aiOffersToUser','aiLoanOffersToUser','pitchReplies'];
const original=Object.fromEntries(names.map(n=>[n,global[n]]));let calls={};
for(const n of names)global[n]=function(...args){calls[n]=(calls[n]||0)+1;return original[n](...args)};
const query=document.querySelector;
function reset(winter=false,kind='ai',dayBefore=false){
 adoptWorld(JSON.parse(base));seedRng(5002);clearTimeout(SAVE_TIMER);global.toast=()=>{};global.closeModal=()=>{};global.openModal=()=>{};document.querySelector=query;
 WORLD.day=winter?winterDay():0;const end=windowEndDay();WORLD.day=end-(dayBefore?1:0);WORLD.inbox=[];WORLD.offers=[];WORLD.interest=[];WORLD.pitches=[];
 const u=UC(),p=u.squad.map(P).find(p=>p.pos==='ST'&&!p.loan);p.autoSell=false;p.untouchable=false;p.releaseClause=0;p.wantsLoan=false;p.injury=0;
 for(let k=0;k<2;k++){const cover=makePlayer(100,p.pos,24,u.id);WORLD.players[cover.id]=cover;u.squad.push(cover.id)}
 const buyers=WORLD.clubs.filter(c=>c.id!==u.id&&c.squad.length<27&&pitchNeed(c,p)>=1).slice(0,8);assert(buyers.length>=2);
 for(const b of buyers){b.finance.balance=1e12;b.finance.locked=0;b.finance.cap0=1e12;}
 p.listed=true;p.askPrice=Math.max(5000,Math.floor(askingPrice(p)*.45/1000)*1000);
 if(kind==='ai')WORLD.interest=buyers.map(b=>({pid:p.id,club:b.id,heat:1,since:absDay()-10}));
 if(kind==='pitch')WORLD.pitches=[{pid:p.id,club:buyers[0].id,price:p.askPrice,day:end-1,due:end}];
 if(kind==='loan'){
  p.age=22;p.ca=150;p.listed=false;p.wantsLoan=true;
  // Add eligible solvent borrowers to the QA world; retain real loan generation/terms.
  for(const b of WORLD.clubs.filter(c=>c.id!==u.id&&c.rep>=55&&c.rep<=70&&c.squad.length<27)){
   b.finance.balance=1e12;b.finance.locked=0;b.finance.cap0=1e12;
  }
 }
 WORLD.fixtures=WORLD.fixtures.filter(f=>f.day!==end&&f.day!==end-1);calls={};return {u,p,end,kind};
}

function fixture(winter,kind,match){
 for(let seed=5001;seed<5021;seed++){
  const x=reset(winter,kind);seedRng(seed);
  if(match){const f=WORLD.fixtures.find(f=>!f.played&&f.comp==='L'&&(f.home===x.u.id||f.away===x.u.id)&&f.day>WORLD.day);assert(f);f.day=WORLD.day;}
  const input=JSON.stringify(WORLD);const r=advance();assert.equal(r.t,'deadline');assert.equal(WORLD.day,x.end);
  const o=WORLD.offers.find(o=>o.pid===x.p.id&&(kind==='loan'?o.type==='loan':kind==='pitch'?o.pitched:!o.pitched&&o.type!=='loan'));
  if(o){x.o=o;x.seed=seed;x.input=input;return x;}
 }
 throw Error('No deterministic AI fixture generated an offer');
}
function test(name,fn){try{fn();results.push({name,pass:true});console.log('PASS',name)}catch(e){results.push({name,pass:false,error:e.stack});console.log('FAIL',name,e.message)}finally{clearTimeout(SAVE_TIMER)}}
for(const winter of [false,true])for(const match of [false,true])for(const kind of ['ai','pitch','loan'])test(`${winter?'1/31':'8/31'} ${match?'有比赛':'无比赛'} ${kind}真实市场→玩家处理→完整日结关窗`,()=>{
 const x=fixture(winter,kind,match),o=x.o,pid=x.p.id,bid=o.club,fee=o.fee;
 assert.equal(o.day,x.end);assert.equal(o.until,x.end);assert.equal(offerDateError(o),'');assert.equal(calls.marketDaily,1);assert(!calls.dailyTick);assert(!calls.simDay);
 assert(!WORLD.inbox.some(m=>m.title===(winter?'冬窗':'夏窗')+'关闭'));
 const saved=JSON.parse(JSON.stringify(WORLD)),input=JSON.stringify(saved);assertLoadable(saved);adoptWorld(saved);assert.equal(JSON.stringify(saved),input);assert.equal(prepareDeadlineMarket(),false);
 assert.equal(calls.marketDaily,1);const cash=UC().finance.balance,buyer=C(bid).finance.balance,logs=WORLD.transferLog.length;
 assert.equal(acceptOffer(WORLD.offers.findIndex(v=>v.pid===pid&&v.club===bid)),true);assert.equal(P(pid).clubId,bid);assert.equal(UC().finance.balance-cash,fee);assert.equal(buyer-C(bid).finance.balance,fee);assert.equal(WORLD.transferLog.length-logs,1);
 const r=advance();if(match){assert.equal(r.t,'match');CURMATCH=runMatch(createMatch(r.fx.home,r.fx.away,{record:false,userSide:r.fx.home===WORLD.userClub?0:1,...knockoutOpts(r.fx)}));assert.equal(finishUserMatch(),'ok');assert.equal(CURMATCH,null);}else assert.equal(r.t,'day');
 assert.equal(WORLD.day,x.end+1);assert(!inTransferWindow());assert.equal(WORLD.offers.length,0);assert.equal(calls.marketDaily,1);assert.equal(calls.dailyTick,1);assert.equal(calls.simDay,1);
 assert.equal(WORLD.transferLog.filter(t=>t.pid===pid).length,1);const summaries=WORLD.inbox.filter(m=>m.title===(winter?'冬窗':'夏窗')+'关闭');assert.equal(summaries.length,1);
 const L=WORLD.transferLog.filter(t=>t.s===WORLD.season&&t.d>x.end-31&&t.d<=x.end);assert(summaries[0].body.includes(`共完成 ${L.length} 笔转会`));assert(summaries[0].body.includes(money(L.filter(t=>t.fee>0).reduce((n,t)=>n+t.fee,0))));
 if(kind==='loan')assert(!WORLD.inbox.some(m=>m.title===P(pid).cn+' 对没被外租感到失望'));
 if(process.env.EXPORT_BROWSER&&!match){const dir=path.resolve(__dirname,'../../output/deadline-independent/scenes');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`${winter?'winter':'summer'}-${kind}.json`),JSON.stringify({world:JSON.parse(x.input),seed:x.seed}));}
});
const file=process.env.FMFILE||path.resolve(__dirname,'../../index.html'),dir=path.resolve(__dirname,'../../output/deadline-independent');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'regression.json'),JSON.stringify({sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),passed:results.every(r=>r.pass),checks:results.length,realLoanAndPitchGeneration:true,results},null,2));process.exit(results.some(r=>!r.pass)?1:0);
