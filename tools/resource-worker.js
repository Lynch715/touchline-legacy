// 由 build-web.cjs 注入当前资源清单；缓存严格限定于本游戏目录，不触碰 fmweb-saves。
'use strict';
const BUILD = '__BUILD__';
const WEB_SHA = '__WEB_SHA__';
const ASSETS = __ASSETS__;
const BASE = new URL(self.registration.scope);
const CACHE = 'touchline-resources-v1:' + BASE.href;
const SHELL = new URL('index.html', BASE).href;
const FILES = new Map(ASSETS.map(f => [new URL(f.path, BASE).href, f]));
const inflight = new Map();
let warming = null, latestStatus = null;
const watchers = new Map();
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
async function verified(response, sha, size) {
  if (!response.ok || response.type === 'opaque') throw Error('resource-http');
  const bytes = await response.clone().arrayBuffer();
  if ((size != null && bytes.byteLength !== size) || hex(await crypto.subtle.digest('SHA-256', bytes)) !== sha) throw Error('resource-integrity');
  return response;
}
async function image(url) {
  const cache = await caches.open(CACHE).catch(() => null), hit = await cache?.match(url).catch(() => null);
  if (hit) return hit;
  if (!inflight.has(url)) {
    const work = (async () => {
      const f = FILES.get(url);
      const response = await verified(await fetch(url), f.sha256, f.bytes);
      // 写满或被限制时仍正常显示网络图片，不影响游戏或存档。
      try { await cache?.put(url, response.clone()); } catch (_) {}
      return response;
    })();
    inflight.set(url, work);
    work.finally(() => inflight.delete(url)).catch(() => {});
  }
  return (await inflight.get(url)).clone();
}
async function saveShell(response) {
  try {
    await verified(response, WEB_SHA);
    const headers = new Headers(response.headers); headers.set('x-touchline-build', BUILD); headers.set('x-touchline-sha', WEB_SHA);
    headers.delete('content-encoding'); headers.delete('content-length');
    const copy = new Response(await response.clone().arrayBuffer(), { status: 200, headers });
    await (await caches.open(CACHE)).put(SHELL, copy);
  } catch (_) {} // 部署切换中收到不同版本时不混存。
  return response;
}
async function navigation(request, event) {
  // 在线条件重验证以发现新版；已有本地入口时最多等1.5秒，断网立即回退。
  const network = fetch(request, { cache: 'no-cache' }).then(async r => {
    if (!r.ok) throw Error('navigation-http');
    return saveShell(r);
  });
  event.waitUntil(network.catch(() => {}));
  const cached = await caches.open(CACHE).then(c => c.match(SHELL)).catch(() => null);
  if (!cached) return network;
  let timer;
  const fallback = new Promise(resolve => { timer = setTimeout(() => resolve(cached), 1500); });
  try { return await Promise.race([network.catch(() => cached), fallback]); }
  finally { clearTimeout(timer); }
}
async function notify(source, status) {
  latestStatus = { type: 'TOUCHLINE_CACHE', build: BUILD, ...status };
  for (const [id, client] of watchers) {
    try { client.postMessage(latestStatus); } catch (_) { watchers.delete(id); }
  }
}
async function warm(source) {
  const cache = await caches.open(CACHE);
  const shell = await cache.match(SHELL);
  if (shell?.headers.get('x-touchline-sha') !== WEB_SHA) {
    try { await saveShell(await fetch(SHELL, { cache: 'no-cache' })); } catch (_) {}
  }
  const present = new Set((await cache.keys()).map(r => r.url));
  const pending = ASSETS.filter(f => !present.has(new URL(f.path, BASE).href));
  let cursor = 0, done = ASSETS.length - pending.length, failed = 0;
  const report = async phase => notify(source, { phase, done, total: ASSETS.length, failed, shell: !!(await cache.match(SHELL)) });
  await report('warming');
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < pending.length) {
      const f = pending[cursor++];
      try { await image(new URL(f.path, BASE).href); if (await cache.match(new URL(f.path, BASE).href)) done++; else failed++; }
      catch (_) { failed++; }
      if ((done + failed) % 50 === 0) await report('warming');
      // 让出资源给玩家正在打开的页面，未完成的图片下次进入时续传。
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }));
  await report(failed ? 'partial' : 'ready');
}
self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', event => {
  if (event.data?.type !== 'TOUCHLINE_WARM') return;
  if (event.source) watchers.set(event.source.id || event.source, event.source);
  if (warming && latestStatus) { try { event.source?.postMessage(latestStatus); } catch (_) {} }
  if (!warming) { warming = warm(event.source).catch(() => notify(event.source, { phase: 'unavailable' })).finally(() => { warming = null; }); }
  event.waitUntil(warming);
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin) return;
  url.search = ''; url.hash = '';
  if (FILES.has(url.href)) { event.respondWith(image(url.href)); return; }
  if (request.mode === 'navigate' && (url.href === SHELL || url.href === BASE.href)) event.respondWith(navigation(request, event));
});
