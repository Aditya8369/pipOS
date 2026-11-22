const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT_DIR, 'index.html');
const CSS_PATH = path.join(ROOT_DIR, 'css', 'style.css');
const MAIN_JS_PATH = path.join(ROOT_DIR, 'js', 'main.js');

test('index.html contains shortcuts-hud dialog with close button and definitions', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // Verify dialog element with shortcuts-hud class
  assert.match(html, /<dialog[^>]*class=["'][^"']*\bshortcuts-hud\b[^"']*["'][^>]*>/i,
    'index.html must contain <dialog> with .shortcuts-hud class');

  // Verify close button inside dialog
  const hudMatch = html.match(/<dialog[^>]*\bshortcuts-hud\b[^>]*>([\s\S]*?)<\/dialog>/i);
  assert.ok(hudMatch, 'shortcuts-hud dialog element must exist');
  const hudContent = hudMatch[1];

  assert.match(hudContent, /<button[^>]*id=["']hudCloseBtn["'][^>]*>/i,
    'Dialog must contain a close button with id="hudCloseBtn"');

  // Verify definitions list (<dl>, <dt>, <dd>)
  assert.match(hudContent, /<dl[^>]*class=["'][^"']*\bhud-definitions\b[^"']*["']>/i,
    'Dialog must contain a definitions list with .hud-definitions class');
  assert.match(hudContent, /<dt>[\s\S]*?<kbd>\?<\/kbd>[\s\S]*?<\/dt>/i,
    'Definitions must include "?" key description');
  assert.match(hudContent, /<dt>[\s\S]*?<kbd>1<\/kbd>[\s\S]*?<kbd>8<\/kbd>[\s\S]*?<\/dt>/i,
    'Definitions must include 1 to 8 keys description');
  assert.match(hudContent, /<dt>[\s\S]*?<kbd>Space<\/kbd>[\s\S]*?<\/dt>/i,
    'Definitions must include Space key description');
});

test('css/style.css styles .shortcuts-hud with retro border, paper background, and backdrop blur', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  // Verify .shortcuts-hud styling rules
  assert.match(css, /\.shortcuts-hud\s*\{[^}]*background:\s*var\(--paper\)/,
    '.shortcuts-hud must use paper background variable');
  assert.match(css, /\.shortcuts-hud\s*\{[^}]*border:\s*3px\s+solid/,
    '.shortcuts-hud must feature a 3px solid retro border');

  // Verify backdrop blur on ::backdrop
  assert.match(css, /\.shortcuts-hud::backdrop\s*\{[^}]*backdrop-filter:\s*blur/,
    '.shortcuts-hud::backdrop must apply backdrop-filter blur');
});

test('js/main.js global keydown listener opens dialog.showModal() on ? when outside inputs', () => {
  const mainSrc = fs.readFileSync(MAIN_JS_PATH, 'utf8');

  // Verify source contract
  assert.match(mainSrc, /showModal\(\)/, 'main.js must call showModal() on the dialog');
  assert.match(mainSrc, /e\.key\s*===\s*['"]\?['"]/, 'main.js must listen for "?" key');
  assert.match(mainSrc, /shortcutsHud/, 'main.js must query shortcutsHud dialog');

  let modalOpened = false;
  let modalClosed = false;

  const mockDialog = {
    open: false,
    showModal: () => {
      modalOpened = true;
      mockDialog.open = true;
    },
    close: () => {
      modalClosed = true;
      mockDialog.open = false;
    },
    addEventListener: () => {}
  };

  const mockCloseBtn = {
    addEventListener: (evt, handler) => {
      if (evt === 'click') mockCloseBtn._click = handler;
    }
  };

  let registeredKeydown = null;
  const mockDoc = {
    addEventListener: (evt, handler) => {
      if (evt === 'keydown') registeredKeydown = handler;
    },
    getElementById: (id) => {
      if (id === 'shortcutsHud') return mockDialog;
      if (id === 'hudCloseBtn') return mockCloseBtn;
      return null;
    },
    querySelector: (sel) => (sel === 'dialog.shortcuts-hud' ? mockDialog : null),
    documentElement: { classList: { toggle: () => {} } }
  };

  const mockWindow = {
    document: mockDoc,
    addEventListener: () => {},
    setTimeout: (fn) => 1,
    clearTimeout: () => {}
  };

  const mockPIP = {
    $: (sel) => {
      if (sel === '#shortcuts') return { contains: () => false };
      if (sel === 'dialog.shortcuts-hud') return mockDialog;
      return null;
    },
    $$: () => [],
    store: { get: () => '', set: () => {} },
    clamp: (v, a, b) => v,
    reduceMotion: { matches: false },
    fx: { init: () => {} },
    pip: { init: () => {} },
    toys: { init: () => {} }
  };

  mockWindow.PIP = mockPIP;

  const runCode = new Function('window', 'document', mainSrc);
  runCode(mockWindow, mockDoc);

  assert.ok(typeof registeredKeydown === 'function', 'Global keydown handler must be registered');

  // 1. Press '?' inside an input element -> should NOT open modal
  const inputEvent = {
    key: '?',
    target: { tagName: 'INPUT' },
    preventDefault: () => {}
  };
  registeredKeydown(inputEvent);
  assert.strictEqual(modalOpened, false, 'Pressing ? inside INPUT must not open modal');

  // 2. Press '?' inside a textarea element -> should NOT open modal
  const textareaEvent = {
    key: '?',
    target: { tagName: 'TEXTAREA' },
    preventDefault: () => {}
  };
  registeredKeydown(textareaEvent);
  assert.strictEqual(modalOpened, false, 'Pressing ? inside TEXTAREA must not open modal');

  // 3. Press '?' outside input (e.g. body or main) -> MUST open modal
  let prevented = false;
  const normalEvent = {
    key: '?',
    target: { tagName: 'BODY' },
    preventDefault: () => { prevented = true; }
  };
  registeredKeydown(normalEvent);
  assert.strictEqual(modalOpened, true, 'Pressing ? on body must call dialog.showModal()');
  assert.strictEqual(prevented, true, 'Default action must be prevented');

  // 4. Press '?' again when modal is open -> should toggle close
  registeredKeydown(normalEvent);
  assert.strictEqual(modalClosed, true, 'Pressing ? while open must call dialog.close()');

  // 5. Test close button click handler
  assert.ok(typeof mockCloseBtn._click === 'function', 'Close button must have click listener');
  modalClosed = false;
  mockCloseBtn._click();
  assert.strictEqual(modalClosed, true, 'Clicking close button must call dialog.close()');
});
