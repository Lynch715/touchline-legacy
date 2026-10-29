const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');require('./shim.cjs');
const files=['output/light-theme-fix-20261021/qa-save-before.json','output/player-feedback-20261022/release/线上原存档备份.json','output/promotion-overlap-20261025/足球经理_铜梁龙_2031_第0天_结算修复.json'];
(async()=>{
 const results=[];
 for(const file of files){
  const raw=fs.readFileSync(file,'utf8'),input=JSON.parse(raw),runtime={rng:RNGSTATE,pid:PID,clk:FIN_CLK};
  adoptWorld(input);SAVE_PAUSED=true;const expected=JSON.stringify(WORLD),before=WORLD;
  const record=await processSaveTask({op:'decode',payload:'Z0:'+raw,mode:'adopt',runtime});
  assert.equal(WORLD,before);assert.equal(JSON.stringify(record.obj),expected,'后台旧档迁移与原路径不一致');
  adoptPreparedSave(record);SAVE_PAUSED=true;assert.equal(JSON.stringify(WORLD),expected);validateWorld(WORLD);
  const roundtrip=await processSaveTask({op:'pack',raw:expected,at:100,runtime});
  const restored=await processSaveTask({op:'decode',payload:roundtrip.payload,mode:'adopt',runtime});assert.equal(JSON.stringify(restored.obj),expected,'压缩重读改变进度');
  assert.equal(fs.readFileSync(file,'utf8'),raw);clearTimeout(SAVE_TIMER);
  results.push({file:path.basename(file),passed:true,inputSha256:crypto.createHash('sha256').update(raw).digest('hex'),sameAsOriginalMigration:true,compressedRoundtripUnchanged:true});console.log('PASS',path.basename(file));
 }
 fs.writeFileSync('output/performance-fix-20261029/prepared-old-save-compat.json',JSON.stringify({passed:true,results},null,2));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
