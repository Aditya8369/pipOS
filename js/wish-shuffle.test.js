'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const STYLE_CSS_PATH = path.join(ROOT_DIR, 'css', 'style.css');
const WALL_JS_PATH = path.join(ROOT_DIR, 'js', 'wall.js');

describe('Wish Wall Random Dream Shuffler (Surprise Dream)', () => {
  test('index.html contains 🎲 Surprise Dream button inside .wall-actions', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    assert.ok(html.includes('id="gbShuffle"'), 'index.html must contain #gbShuffle button');
    assert.ok(html.includes('Surprise Dream'), 'Must contain "Surprise Dream" text');
    assert.ok(html.includes('🎲'), 'Must contain 🎲 emoji');
    assert.match(
      html,
      /<div[^>]*class=["'][^"']*\bwall-actions\b[^"']*["'][^>]*>[\s\S]*?<button[^>]*id=["']gbShuffle["'][^>]*>[\s\S]*?Surprise Dream[\s\S]*?<\/button>[\s\S]*?<button[^>]*id=["']gbExport["']/,
      '#gbShuffle button must be placed inside .wall-actions before #gbExport'
    );
  });

  test('css/style.css defines .note.is-highlighted with pulse animation for 2.5s and reduced motion overrides', () => {
    const css = fs.readFileSync(STYLE_CSS_PATH, 'utf8');

    assert.match(css, /\.note\.is-highlighted/, 'Must define .note.is-highlighted styling');
    assert.match(css, /@keyframes\s+pulse/, 'Must define @keyframes pulse');
    assert.match(css, /animation:\s*pulse\s+2\.5s/, '.note.is-highlighted must specify pulse 2.5s');

    // Reduced motion override
    assert.match(
      css,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.note\.is-highlighted\s*\{[^}]*animation:\s*none/,
      'prefers-reduced-motion must disable animation for .note.is-highlighted'
    );
  });

  test('js/wall.js exports surpriseDream and pickRandomDream methods', () => {
    const wall = require(WALL_JS_PATH);

    assert.strictEqual(typeof wall.surpriseDream, 'function', 'surpriseDream must be a function');
    assert.strictEqual(typeof wall.pickRandomDream, 'function', 'pickRandomDream must be a function');
  });

  test('wall.surpriseDream returns null when no .note elements are present', () => {
    const wall = require(WALL_JS_PATH);
    const mockDoc = {
      querySelectorAll: (sel) => []
    };

    const res = wall.surpriseDream(mockDoc);
    assert.strictEqual(res, null, 'Must return null gracefully when list is empty');
  });

  test('wall.surpriseDream selects a random note, calls scrollIntoView, adds .is-highlighted, and triggers confetti', (t, done) => {
    const wall = require(WALL_JS_PATH);

    let scrolledWith = null;
    let confettiTarget = null;
    let classes = ['note'];

    const mockNote = {
      className: 'note',
      classList: {
        add: (cls) => {
          if (!classes.includes(cls)) classes.push(cls);
        },
        remove: (cls) => {
          classes = classes.filter((c) => c !== cls);
        },
        contains: (cls) => classes.includes(cls)
      },
      scrollIntoView: (opts) => {
        scrolledWith = opts;
      }
    };

    const mockDoc = {
      querySelectorAll: (sel) => {
        if (sel === '.note') return [mockNote];
        return [];
      }
    };

    // Mock PIP.fx.confetti
    global.PIP = global.PIP || {};
    global.PIP.fx = global.PIP.fx || {};
    global.PIP.fx.confetti = (target) => {
      confettiTarget = target;
    };

    const selected = wall.surpriseDream(mockDoc);

    assert.strictEqual(selected, mockNote, 'Selected note must be the mocked note');
    assert.deepStrictEqual(scrolledWith, { behavior: 'smooth', block: 'center' }, 'Must scroll into view smoothly and centered');
    assert.ok(mockNote.classList.contains('is-highlighted'), 'Must add .is-highlighted class');
    assert.strictEqual(confettiTarget, mockNote, 'Must pass selected note to PIP.fx.confetti');

    // Verify .is-highlighted removes after 2.5s
    setTimeout(() => {
      assert.strictEqual(mockNote.classList.contains('is-highlighted'), false, '.is-highlighted must expire after 2.5s');
      done();
    }, 2600);
  });

  test('initShuffle attaches click listener to #gbShuffle button', () => {
    const wall = require(WALL_JS_PATH);

    let clickHandler = null;
    const mockBtn = {
      addEventListener: (evt, handler) => {
        if (evt === 'click') clickHandler = handler;
      }
    };

    let selectedNote = null;
    const mockNote = {
      classList: { add: () => {}, remove: () => {} },
      scrollIntoView: () => {}
    };

    const mockDoc = {
      getElementById: (id) => (id === 'gbShuffle' ? mockBtn : null),
      querySelectorAll: (sel) => (sel === '.note' ? [mockNote] : [])
    };

    wall.initShuffle(mockDoc);

    assert.strictEqual(typeof clickHandler, 'function', 'Click listener must be registered on #gbShuffle');
  });
});
