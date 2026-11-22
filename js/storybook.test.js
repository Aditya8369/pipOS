const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const HTML_PATH = path.resolve(__dirname, '..', 'index.html');
const TOYS_JS_PATH = path.resolve(__dirname, 'toys.js');
const CSS_PATH = path.resolve(__dirname, '..', 'css', 'style.css');

test('index.html contains storybook.exe window in Work section', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  assert.match(html, /<article[^>]*id=["']storybook["'][^>]*class=["'][^"']*w-flipbook[^"']*["']/i,
    'Work section must include storybook article');
  assert.match(html, /storybook\.exe/i, 'Storybook window title must be storybook.exe');
  assert.match(html, /id=["']book["'][^>]*role=["']region["']/i, 'Flipbook container must have role="region"');
  assert.match(html, /id=["']bookPrev["']/i, 'Previous page button must exist');
  assert.match(html, /id=["']bookNext["']/i, 'Next page button must exist');
  assert.match(html, /id=["']bookInd["']/i, 'Page indicator must exist');
});

test('storybook.exe has exactly 6 illustrated pages with concise micro-stories', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  const pageMatches = html.match(/<article[^>]*class=["'][^"']*book-page[^"']*["']/g);
  assert.ok(pageMatches, 'Storybook must contain book-page elements');
  assert.strictEqual(pageMatches.length, 6, 'Storybook must have exactly 6 illustrated pages');

  // Verify page titles
  assert.match(html, /The Midnight Basket/i);
  assert.match(html, /The Stolen Star/i);
  assert.match(html, /Mixing Lantern Honey/i);
  assert.match(html, /Rooftop Wind Secrets/i);
  assert.match(html, /The Sock Detective/i);
  assert.match(html, /Goodnight, Little Dreamer/i);

  // Verify every page contains an inline SVG illustration
  const svgMatches = html.match(/<div class=["']bp-art["']>\s*<svg/g);
  assert.ok(svgMatches && svgMatches.length >= 6, 'Every story page must have an inline SVG illustration');
});

test('js/toys.js implements initStorybook with arrow keys and touch swipe support', () => {
  const toysSrc = fs.readFileSync(TOYS_JS_PATH, 'utf8');

  assert.match(toysSrc, /function\s+initStorybook\s*\(/, 'toys.js must define initStorybook');
  assert.match(toysSrc, /initStorybook\(\)/, 'PIP.toys.init must call initStorybook()');
  assert.match(toysSrc, /touchstart/, 'Flipbook must register touchstart listener for swiping');
  assert.match(toysSrc, /touchend/, 'Flipbook must register touchend listener for swiping');
  assert.match(toysSrc, /ArrowRight|ArrowLeft/, 'Flipbook must support arrow key navigation');
});

test('css/style.css defines responsive grid and reduced-motion overrides for storybook', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  assert.match(css, /\.w-flipbook\s*\{\s*grid-column:\s*span\s+12;/,
    '.w-flipbook must span all 12 grid columns');
  assert.match(css, /\.book-page\s*\{[^}]*display:\s*grid;/,
    '.book-page must be a styled grid layout');
  assert.match(css, /\.book-page\s*\{[^}]*transition:/,
    '.book-page must have smooth page-flip transition');
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.book-page/,
    'Reduced motion media query must override .book-page transition');
});

test('js/toys.js guards speech synthesis interactions and handles utterance error events', () => {
  const toysSrc = fs.readFileSync(TOYS_JS_PATH, 'utf8');

  // Verify feature support guard exists
  assert.match(toysSrc, /function\s+hasSpeechSupport\s*\(/, 'Must define hasSpeechSupport helper');
  assert.match(toysSrc, /'speechSynthesis'\s+in\s+window/, 'Must check for speechSynthesis in window');
  assert.match(toysSrc, /SpeechSynthesisUtterance/, 'Must check for SpeechSynthesisUtterance support');

  // Verify utterance.onerror handler exists and resets speech state
  assert.match(toysSrc, /utterance\.onerror\s*=\s*function/, 'Must attach onerror event handler to utterance');
  assert.match(toysSrc, /stopSpeech/, 'onerror must invoke stopSpeech to reset UI controls');

  // Verify stopSpeech cancels speech in a safe try-catch
  assert.match(toysSrc, /try\s*\{\s*if\s*\([^}]*cancel/, 'stopSpeech must guard cancel invocation safely');

  // Verify pause and resume are guarded
  assert.match(toysSrc, /if\s*\(!hasSpeechSupport\(\)\)\s*return;/, 'pauseBtn must guard against missing speech support');
});

test('Speech synthesis error and completion events cleanly reset narration UI', () => {
  // Verify behavior using mock DOM elements
  const listeners = {};
  function makeElem(id) {
    return {
      id,
      textContent: '',
      hidden: false,
      style: {},
      querySelector: (sel) => ({ textContent: sel + ' text' }),
      querySelectorAll: () => [],
      classList: { toggle: () => {}, contains: () => false },
      removeAttribute: () => {},
      setAttribute: () => {},
      addEventListener: (type, cb) => { listeners[id + ':' + type] = cb; }
    };
  }

  const bookPages = [makeElem('p1'), makeElem('p2')];
  const bookEl = {
    ...makeElem('book'),
    querySelectorAll: (sel) => (sel === '.book-page' ? bookPages : [])
  };

  const speechBtn = makeElem('storySpeechBtn');
  const pauseBtn = makeElem('storyPauseBtn');
  const stopBtn = makeElem('storyStopBtn');
  const prevBtn = makeElem('bookPrev');
  const nextBtn = makeElem('bookNext');
  const indEl = makeElem('bookInd');

  let activeUtterance = null;
  function MockUtterance(text) {
    this.text = text;
    this.rate = 1;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
    activeUtterance = this;
  }

  let cancelCount = 0;
  let speakCount = 0;
  const mockSpeechSynthesis = {
    paused: false,
    speaking: false,
    cancel: () => { cancelCount++; },
    speak: (u) => {
      speakCount++;
      if (u.onstart) u.onstart();
    },
    pause: function () { this.paused = true; this.speaking = false; },
    resume: function () { this.paused = false; this.speaking = true; }
  };

  global.document = {
    getElementById: (id) => {
      if (id === 'storySpeechBtn') return speechBtn;
      if (id === 'storyPauseBtn') return pauseBtn;
      if (id === 'storyStopBtn') return stopBtn;
      return null;
    },
    querySelector: (sel) => {
      if (sel === '#book') return bookEl;
      if (sel === '#bookPrev') return prevBtn;
      if (sel === '#bookNext') return nextBtn;
      if (sel === '#bookInd') return indEl;
      return null;
    },
    querySelectorAll: (sel) => (sel === '.book-page' ? bookPages : [])
  };

  const pipObj = {
    $: (sel) => global.document.querySelector(sel),
    $$: (sel, root) => (root ? root.querySelectorAll(sel) : global.document.querySelectorAll(sel))
  };
  global.window = {
    speechSynthesis: mockSpeechSynthesis,
    SpeechSynthesisUtterance: MockUtterance,
    addEventListener: () => {},
    PIP: pipObj
  };
  global.PIP = pipObj;

  try {
    delete require.cache[require.resolve('./toys.js')];
    const toys = require('./toys.js');
    if (toys && typeof toys.initStorybook === 'function') {
      toys.initStorybook();
    }

    const clickSpeech = listeners['storySpeechBtn:click'];
    assert.strictEqual(typeof clickSpeech, 'function', 'Must register click handler on speechBtn');

    // 1. Start speech narration
    clickSpeech();
    assert.strictEqual(speakCount, 1);
    assert.strictEqual(speechBtn.hidden, true, 'Speech button must be hidden while reading');
    assert.strictEqual(pauseBtn.hidden, false, 'Pause button must be shown while reading');
    assert.strictEqual(stopBtn.hidden, false, 'Stop button must be shown while reading');
    assert.ok(activeUtterance, 'Utterance must be instantiated');
    assert.strictEqual(typeof activeUtterance.onerror, 'function', 'onerror must be attached');
    assert.strictEqual(typeof activeUtterance.onend, 'function', 'onend must be attached');

    // 2. Error occurs during speech synthesis
    activeUtterance.onerror(new Error('audio-busy'));
    assert.strictEqual(speechBtn.hidden, false, 'Speech button must be restored on error');
    assert.strictEqual(pauseBtn.hidden, true, 'Pause button must be hidden on error');
    assert.strictEqual(stopBtn.hidden, true, 'Stop button must be hidden on error');
    assert.strictEqual(pauseBtn.textContent, '⏸ Pause', 'Pause button text must reset on error');

    // 3. Normal completion via onend resets cleanly
    clickSpeech();
    assert.strictEqual(speechBtn.hidden, true);
    activeUtterance.onend();
    assert.strictEqual(speechBtn.hidden, false, 'Speech button must be restored on completion');
    assert.strictEqual(pauseBtn.hidden, true, 'Pause button must be hidden on completion');
    assert.strictEqual(stopBtn.hidden, true, 'Stop button must be hidden on completion');
  } finally {
    delete global.document;
    delete global.window;
    delete global.PIP;
    delete require.cache[require.resolve('./toys.js')];
  }
});

test('Storybook handles absence of speechSynthesis API gracefully', () => {
  const elements = {};
  function makeElem(id) {
    return {
      id,
      textContent: '',
      hidden: false,
      style: {},
      querySelector: (sel) => ({ textContent: sel + ' text' }),
      querySelectorAll: () => [],
      classList: { toggle: () => {}, contains: () => false },
      removeAttribute: () => {},
      setAttribute: () => {},
      addEventListener: () => {}
    };
  }

  const bookPages = [makeElem('p1'), makeElem('p2')];
  const bookEl = {
    ...makeElem('book'),
    querySelectorAll: (sel) => (sel === '.book-page' ? bookPages : [])
  };

  const speechBtn = makeElem('storySpeechBtn');
  const pauseBtn = makeElem('storyPauseBtn');
  const stopBtn = makeElem('storyStopBtn');
  const prevBtn = makeElem('bookPrev');
  const nextBtn = makeElem('bookNext');
  const indEl = makeElem('bookInd');

  const pipObj = {
    $: (sel) => global.document.querySelector(sel),
    $$: (sel, root) => (root ? root.querySelectorAll(sel) : global.document.querySelectorAll(sel))
  };

  global.document = {
    getElementById: (id) => {
      if (id === 'storySpeechBtn') return speechBtn;
      if (id === 'storyPauseBtn') return pauseBtn;
      if (id === 'storyStopBtn') return stopBtn;
      return null;
    },
    querySelector: (sel) => {
      if (sel === '#book') return bookEl;
      if (sel === '#bookPrev') return prevBtn;
      if (sel === '#bookNext') return nextBtn;
      if (sel === '#bookInd') return indEl;
      return null;
    },
    querySelectorAll: (sel) => (sel === '.book-page' ? bookPages : [])
  };

  // Environment without speechSynthesis support
  global.window = {
    addEventListener: () => {},
    PIP: pipObj
  };
  global.PIP = pipObj;

  try {
    delete require.cache[require.resolve('./toys.js')];
    const toys = require('./toys.js');
    assert.doesNotThrow(() => {
      toys.initStorybook();
    }, 'Must not throw when speechSynthesis is missing');

    assert.strictEqual(speechBtn.style.display, 'none', 'Speech button must be hidden when unsupported');
    assert.strictEqual(pauseBtn.style.display, 'none', 'Pause button must be hidden when unsupported');
    assert.strictEqual(stopBtn.style.display, 'none', 'Stop button must be hidden when unsupported');
  } finally {
    delete global.document;
    delete global.window;
    delete global.PIP;
    delete require.cache[require.resolve('./toys.js')];
  }
});
