// 完整离线版为源文件；网页版替换图片表示，并生成独立于存档的资源缓存。
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),sourcePath=path.join(root,'执掌绿茵.html');
const source=fs.readFileSync(sourcePath,'utf8'),out=path.join(root,'assets','images');fs.mkdirSync(out,{recursive:true});
const seen=new Map(),files=[];
let web=source.replace(/data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g,(uri,type,b64)=>{
 if(seen.has(uri))return seen.get(uri);
 const data=Buffer.from(b64,'base64'),hash=crypto.createHash('sha256').update(data).digest('hex'),ext=type==='jpeg'?'jpg':type;
 const file='assets/images/'+hash.slice(0,24)+'.'+ext;
 fs.writeFileSync(path.join(root,file),data);seen.set(uri,file);files.push({path:file,bytes:data.length,sha256:hash});return file;
});
web=web.replace('<meta name="touchline-distribution" content="standalone">','<meta name="touchline-distribution" content="web">');
if(!web.includes('content="web"'))throw Error('缺少发行形式标识');
fs.writeFileSync(path.join(root,'index.html'),web);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const worker=fs.readFileSync(path.join(__dirname,'resource-worker.js'),'utf8').replace('__BUILD__','20261024.3').replace('__WEB_SHA__',sha(web)).replace('__ASSETS__',JSON.stringify(files));
fs.writeFileSync(path.join(root,'sw.js'),worker);
const manifest={version:'20261024.3',source:'执掌绿茵.html',sourceSha256:sha(source),sourceBytes:Buffer.byteLength(source),webBytes:Buffer.byteLength(web),sourceGzipBytes:zlib.gzipSync(source).length,webGzipBytes:zlib.gzipSync(web).length,images:files.length,imageBytes:files.reduce((n,f)=>n+f.bytes,0),files:[{path:'sw.js',bytes:Buffer.byteLength(worker),sha256:sha(worker)},{path:'index.html',bytes:Buffer.byteLength(web),sha256:sha(web)},{path:'执掌绿茵.html',bytes:Buffer.byteLength(source),sha256:sha(source)},...files]};
fs.writeFileSync(path.join(root,'assets','manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({webBytes:manifest.webBytes,webGzipBytes:manifest.webGzipBytes,standaloneBytes:manifest.sourceBytes,images:manifest.images,imageBytes:manifest.imageBytes}));
