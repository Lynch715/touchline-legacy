// 旧制小联赛的升级冠军与降级区重叠；不使用或保存浏览器存档。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
require('./shim.cjs');
const out=path.resolve(process.env.PROMOTION_OVERLAP_OUT||'output/promotion-overlap-20261025');fs.mkdirSync(out,{recursive:true});
const results=[],valid=promotionResultValid;
function test(name,fn){const detail=fn();results.push({name,passed:true,detail});console.log('PASS',name);}
function model(size=8){
  const nation=NATIONS.findIndex(n=>n.code==='BEL');WORLD={clubs:[],leagues:[],fixtures:[],playoffs:[]};
  for(const [tier,n]of [16,size,11].entries()){
    const lg=lgIndex(nation,tier),clubIds=[];
    for(let i=0;i<n;i++){const id=WORLD.clubs.length;clubIds.push(id);WORLD.clubs.push({id,cn:'test-'+tier+'-'+(i+1),nation,tier,lg,form:[],seasonStats:{pts:100-i,w:1,d:0,l:0,gf:1,ga:0,p:1}});}
    WORLD.leagues[lg]={lg,nation,tier,clubIds};
  }
  const mid=WORLD.leagues[lgIndex(nation,1)].clubIds,lo=WORLD.leagues[lgIndex(nation,2)].clubIds;
  WORLD.playoffs=[{nation,tier:0,fmt:'ENG',name:'旧制升级',winner:mid[Math.min(5,size-1)]},{nation,tier:1,fmt:'ENG',name:'旧制降级',winner:lo[2]}];
  global.promotionResultValid=()=>null;return {nation,mid,lo};
}
test('8队旧制：第6名升级，降级顺延第5名，双方名额和人数守恒',()=>{
  const {mid}=model(),before=JSON.stringify(WORLD),r=promotionSettlement();assert(r.ok,r.reason);
  assert(r.moves[0].promoted.includes(mid[5]));assert.deepEqual(r.moves[1].relegated,[mid[4],mid[6],mid[7]]);
  const changes=new Map();for(const m of r.moves){assert.equal(m.promoted.length,3);assert.equal(m.relegated.length,3);for(const [ids,tier]of [[m.promoted,m.tier],[m.relegated,m.tier+1]])for(const id of ids){assert(!changes.has(id));changes.set(id,tier);}}
  for(const tier of [0,1,2])assert.equal(WORLD.clubs.filter(c=>(changes.get(c.id)??c.tier)===tier).length,WORLD.clubs.filter(c=>c.tier===tier).length);
  assert.equal(JSON.stringify(WORLD),before);assert.deepEqual(promotionSettlement(),r);
});
test('正常20队旧制：原升降级名单不变',()=>{
  const {mid}=model(20),r=promotionSettlement();assert(r.ok,r.reason);assert.deepEqual(r.moves[1].relegated,mid.slice(-3));
});
test('新规则名单冲突仍拦截，并显示具体球队',()=>{
  const {mid,lo}=model(),p=WORLD.playoffs[1];Object.assign(p,{rules:{fmt:'direct'},direct:lo.slice(0,3),baseDown:mid.slice(-3),winners:[],upperSeeds:[]});
  const before=JSON.stringify(WORLD),r=promotionSettlement();assert.equal(r.ok,false);assert(r.reason.includes(C(mid[5]).cn));assert.equal(JSON.stringify(WORLD),before);
});
test('旧制球队重复升级仍拦截',()=>{
  model();WORLD.playoffs.push({...WORLD.playoffs[0]});assert.equal(promotionSettlement().ok,false);
});
test('旧制可降级球队不足仍拦截，不少降或多升',()=>{
  model(5);const before=JSON.stringify(WORLD),r=promotionSettlement();assert.equal(r.ok,false);assert(r.reason.includes('可降级球队不足'));assert.equal(JSON.stringify(WORLD),before);
});
global.promotionResultValid=valid;
if(process.env.PROMOTION_SAVE){
  const file=process.env.PROMOTION_SAVE,raw=fs.readFileSync(file),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),input=JSON.parse(raw);
  test('真实铜梁龙存档：读取及结算预检不改变比赛、球队、球员、历史',()=>{
    adoptWorld(input);SAVE_PAUSED=true;const before=JSON.stringify(WORLD);assert.equal(before,JSON.stringify(input));
    const r=promotionSettlement();assert(r.ok,r.reason);assert.equal(JSON.stringify(WORLD),before);assert.deepEqual(promotionSettlement(),r);validateWorld(WORLD);
    const bel=NATIONS.findIndex(n=>n.code==='BEL'),m=r.moves.find(m=>m.nation===bel&&m.tier===1),upper=r.moves.find(m=>m.nation===bel&&m.tier===0);
    assert(upper.promoted.includes(849));assert(!m.relegated.includes(849));assert.equal(m.relegated.length,3);
    return {originalSha:sha(raw),season:WORLD.season,day:WORLD.day,club:UC().cn,moves:r.moves.length,relegated:m.relegated.map(id=>C(id).cn)};
  });
  test('真实存档经正常继续进入2031季，76个级别人数守恒、旧赛果完整归档',()=>{
    const counts=WORLD.leagues.map(l=>l.clubIds.length),year=WORLD.season,table=leagueTable(UC().lg),trophies=UC().trophies.slice(),oldHistory=JSON.stringify(WORLD.history),played=JSON.stringify(WORLD.fixtures);
    const r=advance();assert.equal(r.t,'season');assert.equal(WORLD.season,year+1);assert.equal(WORLD.day,0);assert.equal(WORLD.promotionBlocked,undefined);
    assert.equal(UC().tier,0);assert(trophies.every(t=>UC().trophies.includes(t)));assert.equal(JSON.stringify(WORLD.history.slice(0,-1)),oldHistory);
    const summary=WORLD.history.at(-1),archived=summary.leagues.find(l=>l.lg===UC().lastLg);assert.deepEqual(archived.table,table.map(r=>({id:r.id,pts:r.pts,gd:r.gd,rank:r.rank})));
    for(const l of WORLD.leagues)assert.equal(l.clubIds.length,counts[l.lg]);validateWorld(WORLD);assertLoadable(WORLD);
    fs.writeFileSync(path.join(out,'足球经理_铜梁龙_2031_第0天_结算修复.json'),JSON.stringify(WORLD));
    // 单独保留上一季比赛，便于核对；此私有输出目录不得加入发布文件。
    fs.writeFileSync(path.join(out,'2030-played-fixtures.json'),played);
    assert.equal(sha(fs.readFileSync(file)),sha(raw));return {season:WORLD.season,day:WORLD.day,leagueCounts:counts.length,rank:UC().lastRank,balance:UC().finance.balance};
  });
  test('旧档已到第399天仍可恢复跨季，不额外结算当天收支',()=>{
    adoptWorld(input);SAVE_PAUSED=true;WORLD.day=399;
    const tick=processDayEnd;let ticks=0;global.processDayEnd=d=>{ticks++;return tick(d);};
    try{const r=advance();assert.equal(r.t,'season');assert.equal(WORLD.season,2031);assert.equal(WORLD.day,0);assert.equal(ticks,0);validateWorld(WORLD);}
    finally{global.processDayEnd=tick;}
  });
  test('第399天仍有未赛场次时停止，资金和日期不变',()=>{
    adoptWorld(input);SAVE_PAUSED=true;WORLD.day=399;WORLD.fixtures.find(f=>f.comp==='L').played=false;
    const before=JSON.stringify([WORLD.clubs,WORLD.players,WORLD.history]);const r=advance();assert.equal(r.t,'day');assert.equal(WORLD.day,399);assert.equal(WORLD.season,2030);assert.equal(JSON.stringify([WORLD.clubs,WORLD.players,WORLD.history]),before);
  });
  test('第399天非法冠军仍拦截，不绕过结算校验',()=>{
    adoptWorld(input);SAVE_PAUSED=true;WORLD.day=399;const p=WORLD.playoffs.find(p=>p.fmt==='GER');p.winner=p.byPos[1];
    const before=JSON.stringify([WORLD.clubs,WORLD.players,WORLD.history]);assert.equal(advance().t,'day');assert.equal(WORLD.day,399);assert.equal(WORLD.season,2030);assert.equal(JSON.stringify([WORLD.clubs,WORLD.players,WORLD.history]),before);
  });
}
fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify({passed:true,sourceSha:crypto.createHash('sha256').update(fs.readFileSync(process.env.FMFILE||'index.html')).digest('hex'),results},null,2));
clearTimeout(SAVE_TIMER);console.log('PASS',results.length+' checks');
