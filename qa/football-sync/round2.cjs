const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');require('./shim.cjs');
newWorld(20261019,'Dalian Yingbo');const base=JSON.stringify(WORLD),results=[];
function reset(){adoptWorld(JSON.parse(base));seedRng(20261019);clearTimeout(SAVE_TIMER);global.closeModal=()=>{};global.toast=()=>{};return UC()}
async function test(name,fn){try{reset();await fn();results.push({name,pass:true});console.log('PASS',name)}catch(e){results.push({name,pass:false,error:e.stack});console.log('FAIL',name,e.message)}finally{clearTimeout(SAVE_TIMER)}}
const html=fs.readFileSync(process.env.FMFILE||path.resolve(__dirname,'../../index.html'),'utf8');
(async()=>{
 await test('普通青训每批至少80%本国球员，覆盖21国且姓名池与国籍一致',()=>{
  const clubs=NATIONS.map((n,i)=>WORLD.clubs.find(c=>c.nation===i)),stats=[];
  for(const original of clubs){const local=NATIONS[original.nation].name,c={...original,id:0,squad:[],lineup:[],subs:[]};WORLD.clubs=[c];WORLD.userClub=0;WORLD.players={};let total=0,localTotal=0,min=1;
   for(let seed=0;seed<30;seed++){seedRng(9000+seed);c.squad=[];youthIntake();const cohort=c.squad.map(P).filter(p=>!p.legend&&!p.wonderkid),locals=cohort.filter(p=>p.nat===local);assert(cohort.length>=3&&cohort.length<=6);total+=cohort.length;localTotal+=locals.length;min=Math.min(min,locals.length/cohort.length);assert(locals.length>=Math.ceil(cohort.length*.8),local+' '+locals.length+'/'+cohort.length);for(const p of locals)assert.equal(p.rg,academyHomeOrigin(c).rg)}stats.push({nation:local,total,local:localTotal,min});
  }fs.writeFileSync(path.resolve(__dirname,'../../output/football-sync-round2/youth-distribution.json'),JSON.stringify(stats,null,2));
 });
 await test('非青训生成与现役国籍不被重写，特殊传奇保留本国身份',()=>{
  const names=WORLD.clubs.map(c=>c.cn),nat=Object.values(WORLD.players).map(p=>[p.id,p.nat]);adoptWorld(JSON.parse(JSON.stringify(WORLD)));assert.deepEqual(WORLD.clubs.map(c=>c.cn),names);assert.deepEqual(Object.values(WORLD.players).map(p=>[p.id,p.nat]),nat);
  const legendary=makeLegendYouth(UC().id,16,17);if(legendary){const record=LEGENDS.find(l=>l[0]===legendary.name);assert(record);assert.equal(legendary.nat,record[2])}
 });
 await test('三项欧战主/客胜及双方点球胜：冠军、奖金、奖杯、历史和新闻一致',()=>{
  for(const code of ['CL','EL','ECL'])for(const [hg,ag,pens] of [[2,0,null],[0,2,null],[1,1,[5,4]],[1,1,[3,4]]]){
   reset();const home=WORLD.clubs[0],away=WORLD.clubs[1],E={code,...EURO_COMPS[code],results:[],stage:'K'};WORLD.userClub=2;
   const fx={home:home.id,away:away.id,hg,ag,pens,played:true,day:280},w=winnerOf(fx),loser=w===home.id?away.id:home.id,wb=C(w).finance.balance,lb=C(loser).finance.balance,pz=EURO_COMPS[code].prize;
   euroFinish(E,fx);assert.equal(E.winner,w);assert.equal(E.results.at(-1).ties[0].winner,w);assert.equal(C(w).finance.balance-wb,pz.fin+pz.champ);assert.equal(C(loser).finance.balance-lb,pz.fin);assert(C(w).trophies.includes(WORLD.season+' '+E.name));assert(!C(loser).trophies.includes(WORLD.season+' '+E.name));assert(WORLD.inbox[0].body.includes(finalLine(fx)));assert(WORLD.inbox[0].body.endsWith(C(w).cn+' 夺冠。'));
  }
 });
 await test('决赛经赛事日结颁奖给真正胜者，重复日结不重复发奖',()=>{
  const porto=WORLD.clubs.find(c=>c.cn==='波尔图'),city=WORLD.clubs.find(c=>c.en==='Manchester City'),E=WORLD.euro.CL;
  E.stage='K';E.ko={round:3,ties:[{a:porto.id,b:city.id}]};E.results=[];E.winner=null;
  WORLD.fixtures=WORLD.fixtures.filter(f=>f.comp!=='CL');const fx={day:E.finalDay,home:porto.id,away:city.id,comp:'CL',stage:'K',round:4,leg:1,tie:0,played:true,hg:0,ag:2,pens:null,neutral:true};WORLD.fixtures.push(fx);
  const cb=city.finance.balance,pb=porto.finance.balance;competitionsDayEnd(E.finalDay);assert.equal(E.winner,city.id);assert(city.trophies.includes(WORLD.season+' '+E.name));assert(!porto.trophies.includes(WORLD.season+' '+E.name));assert.equal(city.finance.balance-cb,EURO_COMPS.CL.prize.fin+EURO_COMPS.CL.prize.champ);assert.equal(porto.finance.balance-pb,EURO_COMPS.CL.prize.fin);const balances=WORLD.clubs.map(c=>c.finance.balance);competitionsDayEnd(E.finalDay);assert.deepEqual(WORLD.clubs.map(c=>c.finance.balance),balances);assert.equal(JSON.parse(JSON.stringify(E)).results.at(-1).ties[0].winner,city.id);
 });
 await test('修复截图所示旧决赛文案和点球顺序，旧奖金/冠军不改，反复读档幂等',()=>{
  const porto=WORLD.clubs.find(c=>c.cn==='波尔图'),city=WORLD.clubs.find(c=>c.en==='Manchester City');assert(porto&&city);
  const bad={d:280,title:EURO_COMPS.CL.name+'决赛',body:`${porto.cn} 0-2 ${city.cn}，${porto.cn} 夺冠。`,cat:'info',read:false};
  const pens={...bad,title:EURO_COMPS.EL.name+'决赛',body:`${porto.cn} 1-1 ${city.cn}（点球 3-4），${porto.cn} 夺冠。`};
  const correct={...bad,body:`${city.cn} 0-2 ${porto.cn}，${porto.cn} 夺冠。`};const unknown={...bad,body:'无法核实的旧消息'};
  WORLD.inbox=[bad,pens,correct,unknown];const finance=JSON.stringify(WORLD.clubs.map(c=>c.finance)),trophies=JSON.stringify(WORLD.clubs.map(c=>c.trophies));
  assert.equal(repairLegacyFinalNews(),2);assert.equal(bad.body,correct.body);assert.equal(pens.body,`${city.cn} 1-1 ${porto.cn}（点球 3-4），${porto.cn} 夺冠。`);assert.equal(unknown.body,'无法核实的旧消息');assert.equal(repairLegacyFinalNews(),0);assert.equal(JSON.stringify(WORLD.clubs.map(c=>c.finance)),finance);assert.equal(JSON.stringify(WORLD.clubs.map(c=>c.trophies)),trophies);
  const exported=JSON.stringify(WORLD);adoptWorld(JSON.parse(exported));assert.equal(JSON.stringify(WORLD.inbox),JSON.stringify([bad,pens,correct,unknown]));
 });
 await test('受伤离场者可从手动换人列表选择，队列能执行且不能重复替换',()=>{
  const u=UC(),op=WORLD.clubs.find(c=>c.id!==u.id),m=createMatch(u.id,op.id,{userSide:0}),T=m.teams[0];CURMATCH=m;const out=T.men.find(m=>m.pos!=='GK');out.off=true;out.injured=true;
  assert(subOuts(T).includes(out));const replacement=T.bench.find(id=>P(id).pos!=='GK');assert(replacement);SUBQ=[{out,in:replacement}];global.closeSubDialog=()=>{};applySubs();assert(T.men.some(m=>m.id===replacement&&!m.off));assert(!subOuts(T).includes(out));assert.equal(m.subsMade[0],1);applySubs();assert.equal(m.subsMade[0],1);
 });
 await test('助教找不到替补时不提前锁死伤员，补位条件恢复后可重试',()=>{
  const u=UC(),op=WORLD.clubs.find(c=>c.id!==u.id),m=createMatch(u.id,op.id,{userSide:0}),T=m.teams[0];m.t=10;const out=T.men[1];out.off=true;out.injured=true;const bench=[...T.bench];T.bench=[];aiSubs(m);assert(!out.subDone);T.bench=bench;aiSubs(m);assert.equal(out.subDone,2);assert.equal(m.subsMade[0],1);
 });
 await test('合同提醒独立保存、待业不催原队、最后提醒使用本队联赛末轮',()=>{
  const u=UC(),p=P(u.squad[1]);p.contract=WORLD.season;WORLD.inbox=[];contractReminder('start');assert(WORLD.inbox.some(m=>m.title.includes('合同到期')));const count=WORLD.inbox.length;contractReminder('start');assert.equal(WORLD.inbox.length,count);adoptWorld(JSON.parse(JSON.stringify(WORLD)));contractReminder('start');assert.equal(WORLD.inbox.length,count);
  const games=WORLD.fixtures.filter(f=>f.comp==='L'&&(f.home===u.id||f.away===u.id));assert.equal(lastFixtureDay(),Math.max(...games.map(f=>f.day)));WORLD.needJob=true;contractReminder('winter');assert.equal(WORLD.inbox.length,count);
 });
 await test('外围欧洲俱乐部营收预测与实际转播/门票一致，欧战资格只进入整季预测',()=>{
  const c=WORLD.clubs.find(c=>c.nation===EURO_NATION);assert(c);assert.equal(endPrize(c),Math.pow(c.rep,3)*EURO_TV_K);
  const R={m:new Map(),mon:0,tv:1,home:new Map(),allGames:false};assert.equal(revOf(c,R),Math.round((Math.pow(c.rep,3)*EURO_TV_K+euroDomesticGate(c))/10+endPrize(c)));
  const u=UC();u.euro='CL';const expect=EURO_COMPS.CL.prize;assert.equal(euroExpected(u),Math.round((expect.enter+2*expect.win+expect.draw)*.85));
 });
 await test('球队档案名单可以直接打开球员',()=>{let modal;global.openModal=(t,h)=>modal=h;showClub(UC().id);const rows=[...modal.matchAll(/<tr class="clickable" onclick="showPlayer\((\d+)\)">/g)];assert.equal(rows.length,UC().squad.length)});
 await test('压缩构造不支持/运行失败可逐项回退，旧Z1/Z2/Z3均能解压',async()=>{
  const formatStart=html.indexOf('const Z_FMTS='),begin=formatStart>=0?formatStart:html.indexOf('const CAN_Z='),end=html.indexOf('/* ---------- 存档指纹',begin);assert(begin>=0);const block=html.slice(begin,end);
  for(const [allowed,runtimeFail,header] of [[[],[], 'Z0:'],[['deflate'],[],'Z2:'],[['gzip'],[],'Z3:'],[['deflate-raw','deflate','gzip'],['deflate-raw'],'Z2:'],[['deflate-raw','deflate','gzip'],['deflate-raw','deflate','gzip'],'Z0:']]){
   class Zip{constructor(f){if(!allowed.includes(f))throw Error('unsupported');return new TransformStream({transform(chunk,c){if(runtimeFail.includes(f))throw Error('runtime failure');c.enqueue(chunk)}})}}
   const ctx={CompressionStream:Zip,DecompressionStream:Zip,TransformStream,Response,Blob,Uint8Array,Error};vm.createContext(ctx);vm.runInContext(block,ctx);const payload=await vm.runInContext('zipSave("test-save")',ctx);assert(payload.startsWith(header));assert.equal(await vm.runInContext('unzipSave('+JSON.stringify(payload)+')',ctx),'test-save');
  }
  for(const [h,f] of [['Z1:','deflate-raw'],['Z2:','deflate'],['Z3:','gzip']]){if(!zFmtOK(f))continue;const raw='旧格式'+h;const bytes=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream(f))).arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);assert.equal(await unzipSave(h+binary),raw)}
 });
 await test('一层读取永不返回仍可读取其他有效副本，不向坏层自愈传播',async()=>{
  const raw=JSON.stringify(WORLD),original={idbGet,cacheGet,within};global.idbGet=()=>new Promise(()=>{});global.cacheGet=async k=>k===SAVEKEY?raw:null;const limits=[];global.within=(p,ms)=>{limits.push(ms);return original.within(p,15)};
  try{const value=await Promise.race([readSave(),new Promise((_,reject)=>setTimeout(()=>reject(Error('hung storage read')),500))]);assert.equal(JSON.parse(value).day,WORLD.day);assert(limits.length>=4&&limits.every(x=>x===4000))}finally{Object.assign(global,original)}
 });
 const out={passed:results.every(x=>x.pass),checks:results.length,results};fs.writeFileSync(process.env.QA_REPORT||path.resolve(__dirname,'../../output/football-sync-round2/regression.json'),JSON.stringify(out,null,2));process.exit(out.passed?0:1);
})().catch(e=>{console.error(e);process.exit(1)});
