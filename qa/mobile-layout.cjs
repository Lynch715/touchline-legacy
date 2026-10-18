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
  const context = {
    window: { innerHeight: 793, innerWidth: 393, screen: { width: 393, height: 852 },
      visualViewport: { height: 793, offsetTop: 0, scale: 1 }, ...overrides.window },
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
check('Home Screen fills the missing 59px', { navigator: { standalone: true } }, 852);
check('No double inset when Home Screen already reports full height', {
  navigator: { standalone: true }, window: { innerHeight: 852 }
}, 852);
check('Landscape with portrait screen metrics', {
  navigator: { standalone: true }, window: { innerWidth: 852, innerHeight: 372 }
}, 393);
check('Landscape with rotated screen metrics', {
  navigator: { standalone: true }, window: { innerWidth: 852, innerHeight: 372, screen: { width: 852, height: 393 } }
}, 393);
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
check('Checkbox does not trigger keyboard sizing', {
  navigator: { standalone: true }, input: { tagName: 'INPUT', type: 'checkbox' }
}, 852);
check('Input focus with hardware keyboard keeps full-screen correction', {
  navigator: { standalone: true }, input: { tagName: 'INPUT', type: 'text' }
}, 852);
check('Keyboard that also shrinks innerHeight remains visible', {
  navigator: { standalone: true }, input: { tagName: 'INPUT', type: 'text' },
  window: { innerHeight: 470, visualViewport: { height: 470, offsetTop: 0, scale: 1 } }
}, 470);
check('Pinch zoom does not rewrite app geometry', {
  window: { visualViewport: { height: 400, offsetTop: 0, scale: 2 } }
}, 0);
check('Transient zero viewport is ignored', { window: { innerHeight: 0 } }, 0);
assert(!html.includes('var(--sab) - 14px'), 'Bottom inset must not be reduced');
assert(html.includes('max(var(--sab), 3px)'), 'Bottom controls need full safe area');
console.log(`${passed} viewport scenarios passed; full game script syntax passed.`);
