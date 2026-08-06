const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('home entry dock sits immediately above the custom tab bar', () => {
  const css = read('pages/record/record.wxss');
  assert.match(css, /\.entry-dock\s*\{[\s\S]*?bottom:\s*calc\(72rpx \+ env\(safe-area-inset-bottom\)\)/);
  assert.doesNotMatch(css, /\.entry-dock\s*\{[\s\S]*?bottom:\s*calc\(106rpx \+ env\(safe-area-inset-bottom\)\)/);
});

test('record sheets use only the safe area after the tab bar is hidden', () => {
  const css = read('pages/record/record.wxss');
  for (const selector of ['entry-sheet', 'category-picker']) {
    assert.match(css, new RegExp(`\\.${selector}\\s*\\{[\\s\\S]*?bottom:\\s*env\\(safe-area-inset-bottom\\)`));
  }
});

test('custom tab bar supports being hidden by the record page', () => {
  const script = read('custom-tab-bar/index.js');
  const template = read('custom-tab-bar/index.wxml');
  assert.match(script, /hidden:\s*false/);
  assert.match(template, /wx:if="\{\{!hidden\}\}"/);
});
