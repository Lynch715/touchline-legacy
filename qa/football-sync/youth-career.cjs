// 独立培养对照：固定健康、训练、出场率；不代表完整世界长期经济模拟。
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
require('./shim.cjs');newWorld(4242,'Manchester City');SAVE_PAUSED=true;global.news=()=>{};
const c=UC(),original=structuredClone(P(c.squad[0])),id=original.id;c.squad=[id];c.trainIntensity=2;c.trainFocus='balanced';
const scenarios=[{name:'regular',prof:11,coach:12,apps:27},{name:'strong',prof:15,coach:18,apps:34},{name:'neglected',prof:5,coach:6,apps:3}],rows=[];
for(const pos of ['DC','MC','ST','GK'])for(const sc of scenarios)for(let seed=1;seed<=40;seed++){
 const p=structuredClone(original);Object.assign(p,{pos,age:17,pa:170,prof:sc.prof,ambition:11,injury:0,dev:0,loan:null,legend:false,trainPlan:[],a:Object.fromEntries(ATTR_KEYS.map(k=>[k,8]))});p.ca=calcCA(p.a,pos);p.ca0=p.ca;delete p.development;delete p.createdAbs;delete p.joinedAbs;WORLD.players[id]=p;seedRng(seed);WORLD.season=2026;c.coachRating=sc.coach;
 const ages=[];
 for(let age=17;age<=29;age++){
  WORLD.fixtures=Array.from({length:38},(_,i)=>({home:c.id,away:(c.id+1)%WORLD.clubs.length,day:i*7,played:true,comp:'L'}));c.seasonStats.p=38;p.apps=sc.apps;p.age=age;
  for(let week=0;week<43;week++){WORLD.day=week*7;trainClub(c);assert(p.ca<=p.pa);assert(Object.values(p.a).every(x=>x>=1&&x<=20));}
  ages.push({age,ca:p.ca,pa:p.pa});p.age++;prospectFate(p);WORLD.season++;
 }
 rows.push({pos,scenario:sc.name,seed,initialCA:80,initialPA:170,ages});
}
const summary=Object.fromEntries(scenarios.map(sc=>{const a=rows.filter(x=>x.scenario===sc.name);return [sc.name,Object.fromEntries([22,24,26,27,29].map(age=>{const vals=a.map(x=>x.ages.find(a=>a.age===age));return [age,{meanOverall:vals.reduce((s,x)=>s+x.ca/2,0)/vals.length,meanPotential:vals.reduce((s,x)=>s+x.pa/2,0)/vals.length,within5OfOriginal:vals.filter(x=>x.ca>=160).length/vals.length}];}))];}));
const source=process.env.FMFILE||'index.html',report={sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),careers:rows.length,trainingWeeksPerSeason:43,scenarios,summary,rows};
if(typeof developmentShare==='function'){
 assert(summary.regular['27'].meanOverall>summary.regular['24'].meanOverall+2);
 assert(summary.regular['27'].within5OfOriginal>=.7);
 assert(summary.strong['24'].meanOverall>summary.regular['24'].meanOverall);
 assert(summary.regular['27'].meanOverall>summary.neglected['27'].meanOverall+5);
 assert(rows.filter(x=>x.scenario==='regular').every(x=>x.ages[3].ca<170),'20岁前不应批量顶满');
}
fs.writeFileSync(process.argv[2]||'output/youth-development-20261023/career-after.json',JSON.stringify(report,null,2));console.log(JSON.stringify({careers:report.careers,summary}));clearTimeout(SAVE_TIMER);process.exit(0);
