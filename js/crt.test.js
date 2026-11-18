const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CSS_PATH = path.join(ROOT_DIR, 'css', 'style.css');
const MAIN_JS_PATH = path.join(ROOT_DIR, 'js', 'main.js');
const TERM_JS_PATH = path.join(ROOT_DIR, 'js', 'terminal.js');

test('css/style.css defines .crt-active::after overlay with scanline gradient and vignette', () => {
  assert.ok(fs.existsSync(CSS_PATH), 'css/style.css must exist');
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  assert.match(css, /\.crt-active::after\s*\{/, 'Must define .crt-active::after pseudo-element');
  assert.match(css, /position:\s*fixed/, 'Overlay must be position fixed');
  assert.match(css, /pointer-events:\s*none/, 'Overlay must be pointer-events none');
  assert.match(css, /repeating-linear-gradient/, 'Overlay must use repeating-linear-gradient for scanlines');
  assert.match(css, /box-shadow:\s*inset/, 'Overlay must include subtle vignette box-shadow');
});

test('js/main.js defines CRT scanline initialization and toggling with store persistence', () => {
  assert.ok(fs.existsSync(MAIN_JS_PATH), 'js/main.js must exist');
  const mainSrc = fs.readFileSync(MAIN_JS_PATH, 'utf8');

  assert.match(mainSrc, /function\s+initCrt\s*\(/, 'main.js must define initCrt');
  assert.match(mainSrc, /crt-active/, 'main.js must toggle crt-active class');
  assert.match(mainSrc, /pip-crt-toggle/, 'main.js must listen for pip-crt-toggle event');
  assert.match(mainSrc, /crt_mode/, 'main.js must read and persist crt_mode in store');
});

test('js/terminal.js supports crt command and parameter autocompletion', () => {
  const term = require(TERM_JS_PATH);

  // Autocomplete tests
  const crtAll = term.autocomplete('crt ');
  assert.deepStrictEqual(crtAll, ['crt on', 'crt off'], 'crt command must autocomplete on/off subcommands');

  // Execution tests
  const storeMap = {};
  global.window = global.window || {};
  global.window.PIP = global.window.PIP || {};
  global.window.PIP.store = {
    get(k, def) { return storeMap[k] !== undefined ? storeMap[k] : def; },
    set(k, v) { storeMap[k] = v; }
  };

  const classListSet = new Set();
  global.document = {
    body: {
      classList: {
        toggle(cls, val) {
          if (val) classListSet.add(cls);
          else classListSet.delete(cls);
        },
        contains(cls) { return classListSet.has(cls); }
      }
    },
    dispatchEvent() {}
  };

  try {
    const resOn = term.executeCommand('crt on');
    assert.ok(resOn.ok);
    assert.match(resOn.output, /ON/);
    assert.strictEqual(storeMap['crt_mode'], 'true', 'Must persist crt_mode as true');
    assert.ok(classListSet.has('crt-active'), 'Must add crt-active to body');

    const resOff = term.executeCommand('crt off');
    assert.ok(resOff.ok);
    assert.match(resOff.output, /OFF/);
    assert.strictEqual(storeMap['crt_mode'], 'false', 'Must persist crt_mode as false');
    assert.ok(!classListSet.has('crt-active'), 'Must remove crt-active from body');
  } finally {
    delete global.document;
  }
});
