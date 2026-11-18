const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const AUDIO_JS_PATH = path.join(ROOT_DIR, 'js', 'audio.js');
const MAIN_JS_PATH = path.join(ROOT_DIR, 'js', 'main.js');
const HTML_PATH = path.join(ROOT_DIR, 'index.html');

test('js/audio.js implements audio.keyClick() using an ultra-short 15ms bandpass filtered burst', () => {
  const audioSrc = fs.readFileSync(AUDIO_JS_PATH, 'utf8');

  // Verify function definition and exports
  assert.match(audioSrc, /function\s+keyClick\s*\(/, 'audio.js must define keyClick function');
  assert.match(audioSrc, /keyClick:\s*keyClick/, 'audio.js must export keyClick on PIP.audio and module.exports');

  // Verify 15ms ultra-short duration and bandpass filter usage
  assert.match(audioSrc, /0\.015|15/, 'keyClick must use ultra-short ~15ms burst duration');
  assert.match(audioSrc, /['"]bandpass['"]/, 'keyClick must use a bandpass filter');

  const audio = require(AUDIO_JS_PATH);
  assert.strictEqual(typeof audio.keyClick, 'function', 'audio.keyClick must be a function');

  // When audio is not on, calling keyClick must be a safe no-op
  assert.doesNotThrow(() => {
    audio.keyClick();
  }, 'Calling keyClick when audio is off must not throw');
});

test('index.html contains .term-input and .wall-input elements', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  assert.match(html, /class=["'][^"']*\bterm-input\b[^"']*["']/, 'index.html must contain .term-input element');
  assert.match(html, /class=["'][^"']*\bwall-input\b[^"']*["']/, 'index.html must contain .wall-input element');
});

test('js/main.js safely initializes initKeyClick and attaches input listeners', () => {
  const mainSrc = fs.readFileSync(MAIN_JS_PATH, 'utf8');

  assert.match(mainSrc, /function\s+initKeyClick\s*\(/, 'main.js must define initKeyClick function');
  assert.match(mainSrc, /safe\(\s*['"]keyClick['"]\s*,\s*initKeyClick\s*\)/, 'main.js must safely initialize keyClick');
  assert.match(mainSrc, /\.term-input/, 'main.js must target .term-input');
  assert.match(mainSrc, /\.wall-input/, 'main.js must target .wall-input');
});

test('Mechanical Key Click: input events on .term-input and .wall-input trigger audio.keyClick() when sound is on', () => {
  let clickCount = 0;
  let isSoundOn = true;

  const mockAudio = {
    isOn: () => isSoundOn,
    keyClick: () => {
      clickCount++;
    }
  };

  const listeners = {};
  const mockDoc = {
    addEventListener: (event, fn) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    }
  };

  const termEl = {
    className: 'term-input',
    matches: (sel) => sel.includes('.term-input'),
    addEventListener: (event, fn) => {
      listeners['el_' + event] = listeners['el_' + event] || [];
      listeners['el_' + event].push(fn);
    }
  };

  const wallEl = {
    className: 'wall-input',
    matches: (sel) => sel.includes('.wall-input'),
    addEventListener: (event, fn) => {
      listeners['el_' + event] = listeners['el_' + event] || [];
      listeners['el_' + event].push(fn);
    }
  };

  const otherEl = {
    className: 'regular-input',
    matches: () => false,
    addEventListener: () => {}
  };

  // Mock global environment for main.js initKeyClick
  global.window = global.window || {};
  global.window.PIP = global.window.PIP || {};
  global.window.PIP.audio = mockAudio;
  global.window.PIP.$ = () => null;
  global.window.PIP.$$ = (sel) => {
    if (sel.includes('.term-input') && sel.includes('.wall-input')) {
      return [termEl, wallEl];
    }
    return [];
  };
  global.document = mockDoc;

  const main = require(MAIN_JS_PATH);
  assert.strictEqual(typeof main.initKeyClick, 'function', 'main.initKeyClick must be exported');

  main.initKeyClick();

  // 1. Trigger input on .term-input with sound on
  clickCount = 0;
  const termEvent = { target: termEl };
  listeners.input.forEach((fn) => fn(termEvent));
  assert.strictEqual(clickCount, 1, 'Input on .term-input must trigger keyClick');

  // 2. Trigger input on .wall-input with sound on
  clickCount = 0;
  const wallEvent = { target: wallEl };
  listeners.input.forEach((fn) => fn(wallEvent));
  assert.strictEqual(clickCount, 1, 'Input on .wall-input must trigger keyClick');

  // 3. Trigger input on other input element with sound on -> should NOT click
  clickCount = 0;
  const otherEvent = { target: otherEl };
  listeners.input.forEach((fn) => fn(otherEvent));
  assert.strictEqual(clickCount, 0, 'Input on non-matching element must NOT trigger keyClick');

  // 4. Trigger input with sound OFF -> should NOT click
  isSoundOn = false;
  clickCount = 0;
  const termEventMuted = { target: termEl };
  listeners.input.forEach((fn) => fn(termEventMuted));
  assert.strictEqual(clickCount, 0, 'Input when sound is off must NOT trigger keyClick');

  // Clean up
  delete global.window.PIP.audio;
});
