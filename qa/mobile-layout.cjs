const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
new vm.Script(script);
const helpers = script.slice(script.indexOf('function appViewportHeight(){'), script.indexOf('// 聚焦输入框时'));
let passed = 0;
function check(name, overrides, expected) {
  const properties = new Map();
  const win={innerHeight:793,innerWidth:393,screen:{width:393,height:852},...overrides.window};
  if(!Object.hasOwn(overrides.window||{},'visualViewport')) win.visualViewport={height:win.innerHeight,offsetTop:0,scale:1};
  const context = {
    window:win,
    navigator: { standalone: false, ...overrides.navigator },
    document: { activeElement: overrides.input || null, documentElement: { style: {
      getPropertyValue: k => properties.get(k) || '', setProperty: (k, v) => properties.set(k, v)
    } } }
  };
  vm.createContext(context);
  vm.runInContext(helpers, context);
  assert.equal(vm.runInContext('appViewportHeight()', context), expected, name);
  vm.runInContext('fitAppHeight()', context);
  assert.equal(properties.get('--app-height'), expected > 0 ? `${expected}px` : undefined, name);
  passed++;
  console.log(`PASS ${name}`);
}
check('Safari tab keeps its own viewport', {}, 793);
check('Home Screen never exceeds the reported drawing area', { navigator: { standalone: true } }, 793);
check('No double inset when Home Screen already reports full height', {
  navigator: { standalone: true }, window: { innerHeight: 852 }
}, 852);
check('Landscape with portrait screen metrics', {
  navigator: { standalone: true }, window: { innerWidth: 852, innerHeight: 372 }
}, 372);
check('Landscape with rotated screen metrics', {
  navigator: { standalone: true }, window: { innerWidth: 852, innerHeight: 372, screen: { width: 852, height: 393 } }
}, 372);
check('Split window does not use full-screen height', {
  navigator: { standalone: true }, window: { innerWidth: 320, innerHeight: 600 }
}, 600);
check('Desktop window is not expanded to monitor height', {
  window: { innerWidth: 1280, innerHeight: 720, screen: { width: 1920, height: 1080 } }
}, 720);
check('Keyboard shrinks installed app to visible area', {
  navigator: { standalone: true }, input: { tagName: 'INPUT', type: 'text' },
  window: { visualViewport: { height: 470, offsetTop: 0, scale: 1 } }
}, 470);
check('Keyboard panning includes viewport offset', {
  navigator: { standalone: true }, input: { tagName: 'TEXTAREA' },
  window: { visualViewport: { height: 420, offsetTop: 35, scale: 1 } }
}, 455);
check('Legacy keyboard without VisualViewport', {
  navigator: { standalone: true }, input: { tagName: 'INPUT', type: 'number' },
  window: { innerHeight: 470, visualViewport: null }
}, 470);
check('Checkbox does not expand the drawing area', {
  navigator: { standalone: true }, input: { tagName: 'INPUT', type: 'checkbox' }
}, 793);
check('Input focus with hardware keyboard stays within viewport', {
  navigator: { standalone: true }, input: { tagName: 'INPUT', type: 'text' }
}, 793);
check('Keyboard that also shrinks innerHeight remains visible', {
  navigator: { standalone: true }, input: { tagName: 'INPUT', type: 'text' },
  window: { innerHeight: 470, visualViewport: { height: 470, offsetTop: 0, scale: 1 } }
}, 470);
check('Pinch zoom does not rewrite app geometry', {
  window: { visualViewport: { height: 400, offsetTop: 0, scale: 2 } }
}, 0);
check('Transient zero viewport is ignored', { window: { innerHeight: 0 } }, 0);
check('Visual viewport grows before innerHeight catches up', {
  window:{visualViewport:{height:852,offsetTop:0,scale:1}}
},852);
check('Visible viewport excludes browser toolbar', {
  window:{visualViewport:{height:700,offsetTop:0,scale:1}}
},700);
for(const scale of [1,0.85,1.176]){
  check(`Reported iPhone 462×932 / 393×852, scale ${scale}`,{
    navigator:{standalone:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)'},
    window:{innerWidth:462,innerHeight:932,orientation:0,visualViewport:{width:462,height:932,offsetTop:0,scale}}
  },932);
}
check('Zoomed-in iPhone remains inside its viewport',{
  navigator:{standalone:true,userAgent:'iPhone'},
  window:{innerWidth:314,innerHeight:634,orientation:0}
},634);
check('Scaled landscape iPhone uses the reported drawing area',{
  navigator:{standalone:true,userAgent:'iPhone'},
  window:{innerWidth:1002,innerHeight:438,orientation:90}
},438);
check('Scaled iPhone keyboard still shrinks to the visible area',{
  navigator:{standalone:true,userAgent:'iPhone'},input:{tagName:'INPUT',type:'text'},
  window:{innerWidth:462,innerHeight:500,orientation:0}
},500);
check('Scaled ordinary Safari tab is not forced to screen height',{
  navigator:{standalone:false,userAgent:'iPhone'},
  window:{innerWidth:462,innerHeight:932,orientation:0}
},932);
assert(html.includes('name="apple-mobile-web-app-status-bar-style" content="black"'), 'Standalone uses an opaque status bar');
assert(!helpers.includes('window.screen'), 'Never infer drawable height from physical screen');
assert(!html.includes('var(--sab) - 14px'), 'Bottom inset must not be reduced');
assert(html.includes('min(var(--sab),34px)'), 'Home area must not include a phantom browser toolbar');
assert(html.includes('max(var(--nav-safe-bottom), 3px)'), 'Bottom controls need the bounded home area');
const modeHelper=script.slice(script.indexOf('function isStandaloneApp(){'),script.indexOf('function layoutSnapshot(){'));
for(const [legacy,media,expected] of [[true,false,true],[false,true,true],[false,false,false]]){
  const ctx={navigator:{standalone:legacy},window:{matchMedia:()=>({matches:media})}};
  vm.createContext(ctx);vm.runInContext(modeHelper,ctx);
  assert.equal(vm.runInContext('isStandaloneApp()',ctx),expected,'Launch mode detection');passed++;
}
console.log(`${passed} viewport scenarios passed; full game script syntax passed.`);
