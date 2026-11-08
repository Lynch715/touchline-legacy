// 年龄固定的连续培养、普通青训边界，以及可选的真实旧档只读验证。
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
require('./shim.cjs');
newWorld(4242,'Manchester City');SAVE_PAUSED=true;clearTimeout(SAVE_TIMER);
const baseline=JSON.stringify(WORLD),results=[],metrics={};
const out=process.env.LEGEND_REPORT||'output/legend-growth-20261108/regression.json';
function reset(){adoptWorld(JSON.parse(baseline));SAVE_PAUSED=true;seedRng(4242);return UC();}
async function test(name,fn){try{reset();await fn();results.push({name,pass:true});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.stack});console.error('FAIL',name,e.stack);}finally{clearTimeout(SAVE_TIMER);}}
function prospect(pos='MR',age=20){
 const c=UC(),p=P(c.squad[0]);
 Object.assign(p,{pos,age,legend:true,pa:200,ca0:70,dev:1,injury:0,loan:null,prof:17,ambition:10,trainPlan:[],a:Object.fromEntries(ATTR_KEYS.map(k=>[k,k in POS_WEIGHTS[pos]?20:5]))});
 p.ca=calcCA(p.a,pos);p.development={season:WORLD.season,games:40,apps:40,weeks:26,startCA:p.ca};
 c.squad=[p.id];c.trainFocus='balanced';c.trainIntensity=2;c.coachRating=15;
 return p;
}
function train(p,weeks){for(let n=0;n<weeks;n++){trainClub(UC());assert(p.ca<=p.pa);assert(Object.values(p.a).every(v=>v>=1&&v<=20));}}
(async()=>{
for(const pos of ['MR','ST','MC','DC','GK'])await test(pos+'年轻传奇核心满值后不因年龄停滞',()=>{
 const p=prospect(pos),before=p.ca;train(p,26);assert(p.ca>before+2);assert.equal(p.age,20);metrics[pos]={before:before/2,after:p.ca/2};
});
await test('超过同龄参考水平后连续两个13周均有能力增长',()=>{
 const p=prospect(),start=p.ca;train(p,13);const mid=p.ca;train(p,13);assert(mid>start);assert(p.ca>mid);
});
await test('传奇超前培养平滑减速，接近参考水平不会突然断崖',()=>{
 const p=prospect(),target=developmentAgeTarget(p);p.ca=Math.floor(target);const before=developmentAgeFactor(p);p.ca++;const after=developmentAgeFactor(p);
 assert(before>=after&&before-after<.05);const factors=[];for(let ca=Math.ceil(target);ca<=p.pa;ca++){p.ca=ca;factors.push(developmentAgeFactor(p));}
 assert(factors.every((f,i)=>f>=.35&&f<=1&&(!i||f<=factors[i-1])));
});
await test('普通年轻球员仍保留原年龄上限，不获得传奇的额外空间',()=>{
 const p=prospect();p.legend=false;const before=p.ca;train(p,26);assert.equal(p.ca,before);
});
await test('传奇达到潜力后停止，超额训练积累不能突破潜力',()=>{
 const p=prospect();p.pa=p.ca;p.dev=10000;train(p,26);assert.equal(p.ca,p.pa);assert.equal(calcCA(p.a,p.pos),p.pa);
});
await test('15岁传奇正常培养一年不会直接练满100潜力',()=>{
 const rows=[];for(let seed=1;seed<=20;seed++){
  const c=reset(),p=prospect('ST',15);for(const k of ATTR_KEYS)p.a[k]=8;p.ca=calcCA(p.a,p.pos);p.ca0=p.ca;p.development.startCA=p.ca;seedRng(seed);
  const start=p.ca;train(p,43);assert(p.ca>start&&p.ca<p.pa);rows.push(p.ca/2);
 }metrics.youngSeason={min:Math.min(...rows),max:Math.max(...rows)};
});
await test('正常出场比长期缺赛成长更快，重伤期间仍暂停训练',()=>{
 const totals=[];for(const apps of [0,40]){let gain=0;for(let seed=1;seed<=20;seed++){
  reset();const p=prospect();p.development.apps=apps;seedRng(seed);const before=p.ca;train(p,26);gain+=p.ca-before;
 }totals.push(gain);}assert(totals[1]>totals[0]);
 reset();const p=prospect();p.injury=30;const before=JSON.stringify(p.a);train(p,12);assert.equal(JSON.stringify(p.a),before);metrics.appearances=totals;
});
if(process.env.LEGEND_SAVE_FILE)await test('真实旧档保留全部进度、菲戈无需改年龄即可成长、压缩重读一致',async()=>{
 const file=process.env.LEGEND_SAVE_FILE,raw=fs.readFileSync(file),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),input=JSON.parse(raw);
 const oldWorld=JSON.stringify(input);adoptWorld(input);SAVE_PAUSED=true;
 assert.equal(JSON.stringify(input),oldWorld,'加载不能改写传入存档');
 assert.equal(JSON.stringify(WORLD),oldWorld,'加载不能补涨能力或改动其他进度');
 const pid=Object.values(WORLD.players).find(p=>p.cn==='菲戈').id,p=P(pid),loaded=JSON.stringify(p);
 assert.equal(loaded,JSON.stringify(input.players[pid]));
 const rawWorld=JSON.stringify(WORLD),c=UC();c.squad=[pid];seedRng(4242);const age=p.age,plan=JSON.stringify(p.trainPlan),trace=[];
 for(let n=1;n<=26;n++){train(p,1);if([1,4,8,12,26].includes(n))trace.push({week:n,ability:ovr(p),rawCA:p.ca});}
 assert.equal(p.age,age);assert(p.ca>JSON.parse(loaded).ca);assert.equal(JSON.stringify(p.trainPlan),plan);
 assert(p.ca>trace.find(t=>t.week===12).rawCA,'第二段训练仍有进步');
 // 恢复整队，再走实际保存压缩/解压与读取路径。
 adoptWorld(JSON.parse(rawWorld));SAVE_PAUSED=true;const q=P(pid),before=q.ca;trainClub(UC());assert(q.ca>before);
 const expected=JSON.stringify(WORLD),runtime={rng:RNGSTATE,pid:PID,clk:FIN_CLK};
 const packed=await processSaveTask({op:'pack',raw:expected,at:100,runtime});
 const restored=await processSaveTask({op:'decode',payload:packed.payload,mode:'adopt',runtime});
 assert.equal(JSON.stringify(restored.obj),expected);adoptPreparedSave(restored);SAVE_PAUSED=true;assert.equal(JSON.stringify(WORLD),expected);validateWorld(WORLD);
 assert.equal(hash(fs.readFileSync(file)),hash(raw));
 metrics.realSave={file:path.basename(file),sha256:hash(raw),loadUnchanged:true,inputUnchanged:true,compressedRoundtrip:true,age,trace};
});
const report={passed:results.every(r=>r.pass),checks:results.length,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(process.env.FMFILE||'index.html')).digest('hex'),results,metrics};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,metrics}));process.exit(report.passed?0:1);
})();
