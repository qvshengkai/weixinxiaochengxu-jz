const test = require('node:test');
const assert = require('node:assert/strict');
const {
  COMPOSER_MODES,
  getComposerAction,
  createVoiceTextPatch
} = require('../utils/record-composer');

test('composer offers AI, manual, and import modes only', () => {
  assert.deepEqual(COMPOSER_MODES.map(mode => mode.id), ['ai', 'manual', 'import']);
});

test('composer routes manual and import to existing entry points', () => {
  assert.deepEqual(getComposerAction('manual'), { type: 'OPEN_ENTRY' });
  assert.deepEqual(getComposerAction('import'), { type: 'IMPORT_BILL' });
});

test('voice transcription becomes editable AI text without submitting it', () => {
  assert.deepEqual(createVoiceTextPatch('昨天午饭 32 元'), {
    aiText: '昨天午饭 32 元',
    composerMode: 'ai',
    voiceText: ''
  });
});
