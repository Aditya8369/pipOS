const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT_DIR, 'index.html');
const CSS_PATH = path.join(ROOT_DIR, 'css', 'style.css');
const WALL_JS_PATH = path.join(ROOT_DIR, 'js', 'wall.js');

test('index.html contains #wallSearch inside .wall-actions with accessible attributes', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // Verify #wallSearch is inside .wall-actions
  const wallActionsMatch = html.match(/<div\s+class=["'][^"']*\bwall-actions\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  assert.ok(wallActionsMatch, 'index.html must contain .wall-actions container');
  assert.match(wallActionsMatch[1], /id=["']wallSearch["']/, '#wallSearch input must be inside .wall-actions');

  // Verify accessible attributes
  assert.match(html, /<input[^>]*id=["']wallSearch["'][^>]*>/i, 'Must contain input with id="wallSearch"');
  assert.match(html, /id=["']wallSearch["'][^>]*aria-label=/i, '#wallSearch must have aria-label for accessibility');
  assert.match(html, /id=["']wallSearch["'][^>]*placeholder=/i, '#wallSearch must have placeholder');
});

test('css/style.css defines styling for .wall-actions and .wall-search', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  assert.match(css, /\.wall-actions\s*\{/, 'style.css must define .wall-actions');
  assert.match(css, /\.wall-search\s*\{/, 'style.css must define .wall-search');
  assert.match(css, /\.wall-search:focus\s*\{/, 'style.css must define .wall-search:focus state');
});

test('js/wall.js exports filterNotes and initWallSearch functions', () => {
  const wall = require(WALL_JS_PATH);

  assert.strictEqual(typeof wall.filterNotes, 'function', 'wall.filterNotes must be a function');
  assert.strictEqual(typeof wall.initWallSearch, 'function', 'wall.initWallSearch must be a function');
});

test('wall.filterNotes filters cards by case-insensitive keyword match', () => {
  const wall = require(WALL_JS_PATH);

  const mockCards = [
    { textContent: 'I wish for soft rain and warm soup dreams - A sleepy friend', hidden: false },
    { textContent: 'May the stars shine bright over the nursery - Stargazer', hidden: false },
    { textContent: 'Sleep tight little Pip with your warm blanket - Caretaker', hidden: false }
  ];

  const mockDoc = {
    querySelectorAll: (sel) => (sel === '.note' ? mockCards : [])
  };

  // 1. Search for "soup" (lowercase) -> only card 0 matches
  wall.filterNotes('soup', mockDoc);
  assert.strictEqual(mockCards[0].hidden, false, 'Card with "soup" should be visible');
  assert.strictEqual(mockCards[1].hidden, true, 'Card without "soup" should be hidden');
  assert.strictEqual(mockCards[2].hidden, true, 'Card without "soup" should be hidden');

  // 2. Search for "STARS" (uppercase) -> case-insensitive, only card 1 matches
  wall.filterNotes('STARS', mockDoc);
  assert.strictEqual(mockCards[0].hidden, true);
  assert.strictEqual(mockCards[1].hidden, false, 'Card with "stars" should match "STARS"');
  assert.strictEqual(mockCards[2].hidden, true);

  // 3. Search for "pip" -> matches card 2
  wall.filterNotes('pip', mockDoc);
  assert.strictEqual(mockCards[0].hidden, true);
  assert.strictEqual(mockCards[1].hidden, true);
  assert.strictEqual(mockCards[2].hidden, false, 'Card with "Pip" should match "pip"');

  // 4. Empty query -> all cards should be visible
  wall.filterNotes('', mockDoc);
  assert.strictEqual(mockCards[0].hidden, false, 'Empty query reveals card 0');
  assert.strictEqual(mockCards[1].hidden, false, 'Empty query reveals card 1');
  assert.strictEqual(mockCards[2].hidden, false, 'Empty query reveals card 2');
});

test('wall.initWallSearch attaches input listener to #wallSearch and updates cards on input', () => {
  const wall = require(WALL_JS_PATH);

  const mockCards = [
    { textContent: 'Soft clouds and quiet nights', hidden: false },
    { textContent: 'Lullaby under starlight', hidden: false }
  ];

  let inputListener = null;
  const mockSearchInput = {
    id: 'wallSearch',
    value: '',
    addEventListener: (event, fn) => {
      if (event === 'input') inputListener = fn;
    }
  };

  const mockDoc = {
    getElementById: (id) => (id === 'wallSearch' ? mockSearchInput : null),
    querySelector: (sel) => (sel === '#wallSearch' ? mockSearchInput : null),
    querySelectorAll: (sel) => (sel === '.note' ? mockCards : [])
  };

  const res = wall.initWallSearch(mockDoc);
  assert.strictEqual(res, mockSearchInput, 'initWallSearch must return the search input');
  assert.ok(inputListener, 'Input event listener must be registered on #wallSearch');

  // Simulate keystroke typing "lullaby"
  mockSearchInput.value = 'lullaby';
  inputListener({ target: mockSearchInput });

  assert.strictEqual(mockCards[0].hidden, true, 'Card without "lullaby" must be hidden');
  assert.strictEqual(mockCards[1].hidden, false, 'Card with "Lullabies" must be visible');

  // Simulate clearing input
  mockSearchInput.value = '';
  inputListener({ target: mockSearchInput });

  assert.strictEqual(mockCards[0].hidden, false, 'Cleared input reveals all cards');
  assert.strictEqual(mockCards[1].hidden, false, 'Cleared input reveals all cards');
});
