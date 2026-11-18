const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT_DIR, 'index.html');
const CSS_PATH = path.join(ROOT_DIR, 'css', 'style.css');
const MAIN_PATH = path.join(ROOT_DIR, 'js', 'main.js');

/* =========================================================================
   1. HTML Markup Contract for Taskbar Digital Clock
   ========================================================================= */
test('index.html contains accessible #clock element inside taskbar with interactive attributes', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  assert.match(html, /<span[^>]*id=["']clock["'][^>]*>/i, 'index.html must contain #clock span');
  const clockTag = html.match(/<span[^>]*id=["']clock["'][^>]*>/i)[0];

  assert.match(clockTag, /class=["'][^"']*\bclock\b[^"']*["']/i, '#clock must have .clock class');
  assert.match(clockTag, /role=["']button["']/i, '#clock must declare role="button"');
  assert.match(clockTag, /tabindex=["']0["']/i, '#clock must be keyboard focusable with tabindex="0"');
  assert.match(clockTag, /aria-label=/i, '#clock must have an accessible aria-label');
});

/* =========================================================================
   2. CSS Contract for Interactive Digital Clock
   ========================================================================= */
test('css/style.css defines pointer cursor, focus ring, and min-width for .clock', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  assert.match(css, /\.clock\s*\{[^}]*\}/i, 'style.css must define .clock');
  const clockBlock = css.match(/\.clock\s*\{([^}]+)\}/i)[1];

  assert.match(clockBlock, /cursor:\s*pointer/i, '.clock must have cursor: pointer');
  assert.match(clockBlock, /text-align:\s*right/i, '.clock must be right-aligned');
  assert.match(css, /\.clock:focus-visible/i, '.clock must define :focus-visible styling');
});

/* =========================================================================
   3. JS renderClock Formatting Logic Contract
   ========================================================================= */
test('js/main.js defines renderClock supporting 12-hour and 24-hour with seconds', () => {
  const mainSrc = fs.readFileSync(MAIN_PATH, 'utf8');

  assert.match(mainSrc, /function\s+renderClock\s*\(/, 'main.js must define renderClock');
  assert.match(mainSrc, /hour12:\s*fmt\s*===\s*['"]12['"]|hour12:\s*format\s*===\s*['"]12['"]/,
    'renderClock must configure hour12 based on format === "12"');
  assert.match(mainSrc, /second:\s*fmt\s*===\s*['"]24['"]\s*\?\s*['"]2-digit['"]|second:\s*format\s*===\s*['"]24['"]\s*\?\s*['"]2-digit['"]/,
    'renderClock must include seconds in 24-hour mode');

  const main = require(MAIN_PATH);
  assert.strictEqual(typeof main.renderClock, 'function', 'renderClock must be exported');

  const fixedDate = new Date(2026, 9, 31, 23, 42, 15); // 11:42:15 PM

  // Test 12-hour format: hour + minute + am/pm (no seconds)
  const time12 = main.renderClock(fixedDate, '12');
  assert.match(time12, /11:42\s*(PM|pm)/i, '12-hour format should output 11:42 PM');

  // Test 24-hour format: 2-digit hour + minute + second (no am/pm)
  const time24 = main.renderClock(fixedDate, '24');
  assert.match(time24, /23:42:15/, '24-hour format should output 23:42:15');
});

/* =========================================================================
   4. Clock Format Toggling and Persistent Store
   ========================================================================= */
test('initClock reads preference from store and click listener toggles between 12h and 24h', () => {
  const mainSrc = fs.readFileSync(MAIN_PATH, 'utf8');

  assert.match(mainSrc, /store\.get\(['"]clock_format['"],\s*['"]12['"]\)/,
    'initClock must read "clock_format" with "12" default');
  assert.match(mainSrc, /store\.set\(['"]clock_format['"],\s*format\)/,
    'Click listener must persist new format in store');
  assert.match(mainSrc, /format\s*===\s*['"]12['"]\s*\?\s*['"]24['"]\s*:\s*['"]12['"]/,
    'Must alternate between 12 and 24 hour formats');
});
