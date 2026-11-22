'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

describe('task-Desktop Icon Auto-Snap to Grid Toggle', () => {
  const rootDir = path.resolve(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const desktopJs = fs.readFileSync(path.join(rootDir, 'js', 'desktop.js'), 'utf8');

  beforeEach(() => {
    global.window = {
      innerWidth: 1024,
      innerHeight: 768,
      PIP: {}
    };
    global.document = {
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    };
  });

  test('index.html contains 🧲 Auto-Snap: Off item in #desktopContextMenu', () => {
    const menuMatch = indexHtml.match(/<menu\s+[^>]*id=["']desktopContextMenu["'][^>]*>([\s\S]*?)<\/menu>/i);
    assert.ok(menuMatch, 'index.html must contain #desktopContextMenu');
    const menuContent = menuMatch[1];

    assert.match(
      menuContent,
      /<button\s+[^>]*id=["']cmAutoSnap["'][^>]*>[\s\S]*?Auto-Snap:\s*Off[\s\S]*?<\/button>/i,
      '#desktopContextMenu must contain button with id="cmAutoSnap" and text "🧲 Auto-Snap: Off"'
    );
  });

  test('js/desktop.js calculates 80px grid snap (Math.round(x / 80) * 80)', () => {
    assert.match(
      desktopJs,
      /x\s*=\s*Math\.round\(\s*x\s*\/\s*80\s*\)\s*\*\s*80/,
      'js/desktop.js must calculate x = Math.round(x / 80) * 80'
    );
    assert.match(
      desktopJs,
      /y\s*=\s*Math\.round\(\s*y\s*\/\s*80\s*\)\s*\*\s*80/,
      'js/desktop.js must calculate y = Math.round(y / 80) * 80'
    );
  });

  test('Auto-snap math correctly snaps arbitrary coordinates to multiples of 80px', () => {
    function snap80(val) {
      return Math.round(val / 80) * 80;
    }

    assert.strictEqual(snap80(0), 0);
    assert.strictEqual(snap80(39), 0);
    assert.strictEqual(snap80(40), 80);
    assert.strictEqual(snap80(79), 80);
    assert.strictEqual(snap80(80), 80);
    assert.strictEqual(snap80(119), 80);
    assert.strictEqual(snap80(120), 160);
    assert.strictEqual(snap80(155), 160);
    assert.strictEqual(snap80(195), 160);
    assert.strictEqual(snap80(205), 240);
    assert.strictEqual(snap80(240), 240);
    assert.strictEqual(snap80(-41), -80);
  });

  test('Desktop autoSnap toggles state, persists via store.set, and updates menu UI', () => {
    const stored = {};
    const mockStore = {
      get: (k, d) => (k in stored ? stored[k] : d),
      set: (k, v) => { stored[k] = v; }
    };

    const listeners = {};
    const mockButton = {
      textContent: '🧲 Auto-Snap: Off',
      addEventListener: (evt, fn) => { listeners[evt] = fn; },
      click: () => { if (listeners['click']) listeners['click'](); }
    };

    global.window.PIP.store = mockStore;
    global.document.querySelector = (sel) => {
      if (sel === '#cmAutoSnap') return mockButton;
      return null;
    };

    delete require.cache[require.resolve('./desktop.js')];
    const desktop = require('./desktop.js');

    // Default should be false
    assert.strictEqual(desktop.isAutoSnap(), false);

    // Turn autoSnap on
    desktop.setAutoSnap(true);
    assert.strictEqual(desktop.isAutoSnap(), true);
    assert.strictEqual(mockStore.get('auto_snap'), true);
    assert.strictEqual(mockButton.textContent, '🧲 Auto-Snap: On');

    // Turn autoSnap off
    desktop.setAutoSnap(false);
    assert.strictEqual(desktop.isAutoSnap(), false);
    assert.strictEqual(mockStore.get('auto_snap'), false);
    assert.strictEqual(mockButton.textContent, '🧲 Auto-Snap: Off');
  });

  test('Desktop icon pointerup snaps and animates when auto-snap is enabled', () => {
    const stored = { auto_snap: true };
    const mockStore = {
      get: (k, d) => (k in stored ? stored[k] : d),
      set: (k, v) => { stored[k] = v; }
    };

    global.window.PIP.store = mockStore;

    const listeners = {};
    const mockIcon = {
      dataset: {},
      style: { transform: '', transition: '' },
      classList: {
        add: () => {},
        remove: () => {}
      },
      addEventListener: (evt, fn) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      removeEventListener: () => {},
      setPointerCapture: () => {},
      releasePointerCapture: () => {}
    };

    global.document.querySelectorAll = (sel) => {
      if (sel === '.desk-icons > *' || sel.includes('desk-icons')) return [mockIcon];
      return [];
    };

    delete require.cache[require.resolve('./desktop.js')];
    const desktop = require('./desktop.js');
    desktop.setAutoSnap(true);
    desktop.initIconDrag();

    // Trigger pointerdown
    const downListeners = listeners['pointerdown'] || [];
    downListeners.forEach(fn => fn({ clientX: 0, clientY: 0, button: 0, pointerId: 1 }));

    // Trigger pointermove to (110, 205)
    const moveListeners = listeners['pointermove'] || [];
    moveListeners.forEach(fn => fn({ clientX: 110, clientY: 205, pointerId: 1 }));

    // Trigger pointerup
    const upListeners = listeners['pointerup'] || [];
    upListeners.forEach(fn => fn({ pointerId: 1 }));

    // Snapped coordinates:
    // Math.round(110 / 80) * 80 = 80
    // Math.round(205 / 80) * 80 = 240
    assert.strictEqual(mockIcon.dataset.x, 80, 'x coordinate must snap to 80');
    assert.strictEqual(mockIcon.dataset.y, 240, 'y coordinate must snap to 240');
    assert.strictEqual(mockIcon.style.transform, 'translate3d(80px, 240px, 0)');
    assert.ok(mockIcon.style.transition.includes('transform'), 'transition must animate into place');
  });

  test('Desktop icon pointerup leaves raw coordinates when auto-snap is disabled', () => {
    const stored = { auto_snap: false };
    const mockStore = {
      get: (k, d) => (k in stored ? stored[k] : d),
      set: (k, v) => { stored[k] = v; }
    };

    global.window.PIP.store = mockStore;

    const listeners = {};
    const mockIcon = {
      dataset: {},
      style: { transform: '', transition: '' },
      classList: {
        add: () => {},
        remove: () => {}
      },
      addEventListener: (evt, fn) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      removeEventListener: () => {},
      setPointerCapture: () => {},
      releasePointerCapture: () => {}
    };

    global.document.querySelectorAll = (sel) => {
      if (sel === '.desk-icons > *' || sel.includes('desk-icons')) return [mockIcon];
      return [];
    };

    delete require.cache[require.resolve('./desktop.js')];
    const desktop = require('./desktop.js');
    desktop.setAutoSnap(false);
    desktop.initIconDrag();

    // Trigger pointerdown
    const downListeners = listeners['pointerdown'] || [];
    downListeners.forEach(fn => fn({ clientX: 0, clientY: 0, button: 0, pointerId: 1 }));

    // Trigger pointermove to (110, 195)
    const moveListeners = listeners['pointermove'] || [];
    moveListeners.forEach(fn => fn({ clientX: 110, clientY: 195, pointerId: 1 }));

    // Trigger pointerup
    const upListeners = listeners['pointerup'] || [];
    upListeners.forEach(fn => fn({ pointerId: 1 }));

    // Unsnapped coordinates: 110 and 195
    assert.strictEqual(mockIcon.dataset.x, 110, 'x coordinate must remain unsnapped');
    assert.strictEqual(mockIcon.dataset.y, 195, 'y coordinate must remain unsnapped');
    assert.strictEqual(mockIcon.style.transform, 'translate3d(110px, 195px, 0)');
    assert.strictEqual(mockIcon.style.transition, '');
  });
});
