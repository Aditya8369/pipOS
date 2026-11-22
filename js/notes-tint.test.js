'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const STYLE_CSS_PATH = path.join(ROOT_DIR, 'css', 'style.css');
const NOTES_JS_PATH = path.join(ROOT_DIR, 'js', 'notes.js');

describe('Starlight Sticky Notes Pastel Color Tint Picker', () => {
  test('index.html contains .note-tint-bar with 4 swatch buttons inside #notes .win-bar', () => {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    assert.ok(html.includes('class="note-tint-bar"'), 'index.html must contain .note-tint-bar');

    // Verify .note-tint-bar is inside #notes .win-bar
    const notesMatch = html.match(/<article[^>]*id=["']notes["'][^>]*>[\s\S]*?<\/article>/i);
    assert.ok(notesMatch, '#notes must exist');

    const tintBarMatch = notesMatch[0].match(/<div[^>]*class=["'][^"']*\bnote-tint-bar\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    assert.ok(tintBarMatch, '.note-tint-bar element must exist inside #notes');

    const buttonMatches = tintBarMatch[1].match(/<button\b[^>]*>/gi);
    assert.ok(buttonMatches, 'Must contain button swatches');
    assert.strictEqual(buttonMatches.length, 4, 'Must contain exactly 4 swatch buttons');

    // Verify swatch tints
    assert.ok(tintBarMatch[1].includes('data-tint="mint"'), 'Must have mint swatch');
    assert.ok(tintBarMatch[1].includes('data-tint="buttercup"'), 'Must have buttercup swatch');
    assert.ok(tintBarMatch[1].includes('data-tint="peach"'), 'Must have peach swatch');
    assert.ok(tintBarMatch[1].includes('data-tint="default"'), 'Must have default swatch');
  });

  test('css/style.css defines [data-tint="mint"], [data-tint="buttercup"], [data-tint="peach"] altering --paper and border tones', () => {
    const css = fs.readFileSync(STYLE_CSS_PATH, 'utf8');

    assert.match(css, /\[data-tint=["']mint["']\]/, 'Must define [data-tint="mint"] selector');
    assert.match(css, /\[data-tint=["']buttercup["']\]/, 'Must define [data-tint="buttercup"] selector');
    assert.match(css, /\[data-tint=["']peach["']\]/, 'Must define [data-tint="peach"] selector');

    // Verify --paper and border tones (--line) are altered
    assert.match(
      css,
      /\[data-tint=["']mint["']\][\s\S]*?--paper:[\s\S]*?--line:/,
      '[data-tint="mint"] must alter --paper and border tones (--line)'
    );
    assert.match(
      css,
      /\[data-tint=["']buttercup["']\][\s\S]*?--paper:[\s\S]*?--line:/,
      '[data-tint="buttercup"] must alter --paper and border tones (--line)'
    );
    assert.match(
      css,
      /\[data-tint=["']peach["']\][\s\S]*?--paper:[\s\S]*?--line:/,
      '[data-tint="peach"] must alter --paper and border tones (--line)'
    );

    // Verify .note-tint-bar layout and swatch button styling
    assert.match(css, /\.note-tint-bar/, 'css must style .note-tint-bar');
  });

  test('js/notes.js exports setTint and getTint API methods', () => {
    const notes = require(NOTES_JS_PATH);

    assert.strictEqual(typeof notes.setTint, 'function', 'notes.setTint must be a function');
    assert.strictEqual(typeof notes.getTint, 'function', 'notes.getTint must be a function');
  });

  test('notes.setTint persists selection to store.set("notes_tint", tint) and applies data-tint to #notes', () => {
    const notes = require(NOTES_JS_PATH);

    let storedKey = null;
    let storedVal = null;

    global.PIP = global.PIP || {};
    global.PIP.store = {
      get: (k, d) => (k === storedKey ? storedVal : d),
      set: (k, v) => {
        storedKey = k;
        storedVal = v;
      }
    };

    let appliedAttrs = {};
    const mockNotesEl = {
      setAttribute: (k, v) => {
        appliedAttrs[k] = v;
      },
      getAttribute: (k) => appliedAttrs[k] || null,
      removeAttribute: (k) => {
        delete appliedAttrs[k];
      }
    };

    global.document = {
      getElementById: (id) => (id === 'notes' ? mockNotesEl : null),
      querySelector: (sel) => (sel === '#notes' ? mockNotesEl : null),
      querySelectorAll: () => []
    };

    // Apply mint tint
    notes.setTint('mint');
    assert.strictEqual(storedKey, 'notes_tint', 'Must persist to store key notes_tint');
    assert.strictEqual(storedVal, 'mint', 'Must store "mint"');
    assert.strictEqual(mockNotesEl.getAttribute('data-tint'), 'mint', 'Must set data-tint="mint" on #notes');
    assert.strictEqual(notes.getTint(), 'mint');

    // Apply buttercup tint
    notes.setTint('buttercup');
    assert.strictEqual(storedVal, 'buttercup');
    assert.strictEqual(mockNotesEl.getAttribute('data-tint'), 'buttercup', 'Must set data-tint="buttercup" on #notes');
    assert.strictEqual(notes.getTint(), 'buttercup');

    // Apply peach tint
    notes.setTint('peach');
    assert.strictEqual(storedVal, 'peach');
    assert.strictEqual(mockNotesEl.getAttribute('data-tint'), 'peach', 'Must set data-tint="peach" on #notes');
    assert.strictEqual(notes.getTint(), 'peach');

    // Apply default tint
    notes.setTint('default');
    assert.strictEqual(storedVal, 'default');
    assert.strictEqual(mockNotesEl.getAttribute('data-tint'), 'default', 'Must apply default tint to #notes');
    assert.strictEqual(notes.getTint(), 'default');
  });
});
