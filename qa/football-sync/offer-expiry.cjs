const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');require('./shim.cjs');
newWorld(20261019,'Dalian Yingbo');const base=JSON.stringify(WORLD),results=[];
function reset(){adoptWorld(JSON.parse(base));clearTimeout(SAVE_TIMER);global.toast=()=>{};global.closeModal=()=>{};return UC()}
function test(name,fn){try{reset();fn();results.push({name,pass:true});console.log('PASS',name)}catch(e){results.push({name,pass:false,error:e.stack});console.log('FAIL',name,e.message)}finally{clearTimeout(SAVE_TIMER)}}
function legalOffer(extra={}){const u=UC(),b=WORLD.clubs.find(c=>c.id!==u.id),p=u.squad.map(P).find(p=>p.pos==='ST');while(b.squad.length>=30)toFreeAgent(P(b.squad.at(-1)),b);b.finance.balance=1e12;b.finance.locked=0;b.finance.cap0=1e12;const cover=makePlayer(50,'ST',24,u.id);WORLD.players[cover.id]=cover;u.squad.push(cover.id);p.listed=true;p.autoSell=true;WORLD.offers=[{pid:p.id,club:b.id,fee:Math.max(sellPrice(p),saleTerms(u,p).fee||0)*2,wage:p.wage,day:0,until:7,atAsk:true,...extra}];return {u,b,p,of:WORLD.offers[0]}}
test('明确到期日与默认七天：到期当天可成交，次日失效',()=>{
 for(const fallback of [false,true])for(const day of [7,8]){reset();const {p,b,of}=legalOffer();if(fallback)delete of.until;WORLD.day=day;assert.equal(offerExpiryDay(of),7);assert.equal(offerDateError(of),day===7?'':'报价已过期');assert.equal(acceptOffer(0),day===7);assert.equal(p.clubId===b.id,day===7)}
});
test('过期及关窗的转会/租借还价入口与提交均不修改报价',()=>{
 for(const day of [8,60])for(const type of ['transfer','loan']){reset();legalOffer({type,wageShare:1,minApps:0});WORLD.day=day;const raw=JSON.stringify(WORLD.offers);let opened=0;const original=global.openModal;global.openModal=()=>opened++;
 try{counterOffer(0);submitCounter(0);loanCounterDialog(0);submitLoanCounter(0);assert.equal(opened,0);assert.equal(JSON.stringify(WORLD.offers),raw);assert.equal(acceptOffer(0),false)}finally{global.openModal=original}}
});
test('到期当天可打开转会还价与租借条款，提交转会还价可延长有效期',()=>{
 const {of}=legalOffer();WORLD.day=7;let opened=0;const original=global.openModal,query=document.querySelector;global.openModal=()=>opened++;
 try{counterOffer(0);assert.equal(opened,1);document.querySelector=()=>({value:of.fee*1.1});submitCounter(0);assert(of.countered);assert.equal(of.until,14);of.type='loan';of.wageShare=1;of.minApps=0;loanCounterDialog(0);assert.equal(opened,2)}finally{global.openModal=original;document.querySelector=query}
});
test('自动成交排除过期高价，允许到期日合法报价，不产生虚假成交新闻',()=>{
 const {of,p,b}=legalOffer();WORLD.day=7;WORLD.inbox=[];WORLD.offers.unshift({...of,fee:of.fee*2,until:6});autoSellRound();assert.equal(p.clubId,b.id);assert.equal(WORLD.inbox.filter(m=>m.title==='按挂牌条件自动成交').length,1);
 reset();const second=legalOffer();WORLD.day=8;WORLD.inbox=[];autoSellRound();assert.equal(second.p.clubId,UC().id);assert(!WORLD.inbox.some(m=>m.title==='按挂牌条件自动成交'));
});
test('日结先执行到期日自动成交，再清理当天到期的剩余报价',()=>{
 const {p,b}=legalOffer();WORLD.day=7;const names=['dailyTick','marketDaily','faSigningRound','weeklyTick'],old={};for(const n of names){old[n]=global[n];global[n]=()=>{}};
 try{processDayEnd(7);assert.equal(p.clubId,b.id);assert.equal(WORLD.offers.length,0)}finally{for(const n of names)global[n]=old[n]}
});
test('收到报价页面统一禁用过期接受/还价/租借改条款，保留解约金等独有分支',()=>{
 const s=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');const f=s.slice(s.indexOf('function vTransfer('),s.indexOf('function vFinance('));assert(f.includes('const expiryText=dateError'));assert.equal((f.match(/acc.disabled=!!dateError/g)||[]).length,2);assert.equal((f.match(/co.disabled=!!dateError/g)||[]).length,2);assert(f.includes('if(of.release)'));assert(f.includes('解约金触发，只能接受'));
});
fs.writeFileSync(path.resolve(__dirname,'../../output/football-sync-round2/offer-expiry.json'),JSON.stringify({passed:results.filter(r=>r.pass).length,total:results.length,results},null,2));process.exit(results.some(r=>!r.pass)?1:0);
