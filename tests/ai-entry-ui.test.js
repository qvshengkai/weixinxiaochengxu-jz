const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('home composer exposes AI text, inline voice, manual, and import actions', () => {
  const template = read('pages/record/record.wxml');
  const script = read('pages/record/record.js');

  assert.match(template, /class="[^"]*composer-dock/);
  assert.match(template, /data-mode="manual"/);
  assert.match(template, /data-mode="import"/);
  assert.match(template, /class="composer-mic"/);
  assert.match(template, /bindinput="onAiText"/);
  assert.match(template, /bindtap="fillFromAi"/);
  assert.doesNotMatch(template, /data-mode="voice"/);
  assert.match(script, /aiText:\s*''/);
  assert.match(script, /aiLoading:\s*false/);
  assert.match(script, /onAiText\(e\)/);
  assert.match(script, /fillFromAi\(\)/);
  assert.match(script, /name:\s*'parse-agent'/);
  assert.match(script, /createAiRecordPatch/);
  assert.match(script, /selectComposerMode\(e\)/);
});
