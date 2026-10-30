const fs=require('node:fs'),path=require('node:path');require('./shim.cjs');
const out=path.resolve(__dirname,'../../output/loan-cap-20261030');
newWorld(4242,'Manchester City');adoptWorld(structuredClone(WORLD));SAVE_PAUSED=true;
const c=UC(),host=WORLD.clubs.find(o=>o.id!==c.id);
while(c.squad.length<31){const p=makePlayer(45,'MC',24,c.id);WORLD.players[p.id]=p;c.squad.push(p.id);}
while(c.squad.length>31)toFreeAgent(P(c.squad.at(-1)),c);
for(const id of c.squad.slice(-8))if(!loanPlayer(id,host.id,{wageShare:.5}))throw Error('fixture loan failed');
validateWorld(WORLD);fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'legacy-fixture.json'),JSON.stringify(WORLD));
console.log(JSON.stringify({squad:c.squad.length,out:c.loanedOut.length,counted:reservedSquadSize(c),ver:WORLD.ver}));
clearTimeout(SAVE_TIMER);process.exit(0);
