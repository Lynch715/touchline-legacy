// 独立进程运行；真实 worker_threads 模拟浏览器 Worker 的结构化复制和终止。
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Worker:Thread}=require('node:worker_threads');
require('./shim.cjs');
const out=path.resolve(__dirname,'../../output/large-save-load-20261031');
const source=process.env.FMFILE||path.resolve(__dirname,'../../index.html');
const payload=fs.readFileSync(path.join(out,'large-fixture.packed'),'utf8');
let active=0,created=0,peakWorkers=0;
global.Worker=class {
 constructor(){
  active++;created++;peakWorkers=Math.max(active,peakWorkers);this.stopped=false;
  this.thread=new Thread(`const {parentPort,workerData}=require('node:worker_threads');process.env.FMFILE=workerData.source;require(workerData.shim);global.self=global;self.postMessage=data=>parentPort.postMessage(data);saveWorkerLoop();parentPort.on('message',data=>self.onmessage({data}));`,{eval:true,workerData:{source,shim:path.resolve(__dirname,'shim.cjs')}});
  this.thread.on('message',data=>this.onmessage?.({data}));this.thread.on('error',error=>this.onerror?.(error));
 }
 postMessage(data){this.thread.postMessage(data);}
 terminate(){if(!this.stopped){this.stopped=true;active--;return this.thread.terminate();}}
};
global.document.querySelectorAll=()=>[{textContent:'function validateWorld(w){}'}];
global.idbGet=async key=>key===SAVEKEY?payload:null;
global.cacheGet=global.idbGet;global.localStorage.getItem=key=>key===SAVEKEY?payload:null;
(async()=>{
 const started=performance.now(),record=await readSaveRecord('adopt');
 assert(record?.prepared);adoptPreparedSave(record);SAVE_PAUSED=true;clearTimeout(SAVE_TIMER);validateWorld(WORLD);
 const report={passed:true,source,elapsedMs:Math.round(performance.now()-started),menuMB:record.meta.mb,players:Object.keys(WORLD.players).length,fixtures:WORLD.fixtures.length,day:WORLD.day,season:WORLD.season,createdWorkers:created,peakWorkers,workersAfterLoad:active,mainHeapMiB:Math.round(process.memoryUsage().heapUsed/1048576),peakRssMiB:Math.round(process.resourceUsage().maxRSS/1024)};
 fs.writeFileSync(path.join(out,process.env.MEMORY_REPORT||'memory-after.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
