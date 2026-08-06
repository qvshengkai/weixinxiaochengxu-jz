const COMPOSER_MODES = [
  { id: 'ai', label: 'AI 记账' },
  { id: 'manual', label: '手动记账' },
  { id: 'import', label: '账单导入' }
];

function getComposerAction(mode) {
  if (mode === 'manual') return { type: 'OPEN_ENTRY' };
  if (mode === 'import') return { type: 'IMPORT_BILL' };
  return { type: 'SELECT_MODE', mode: 'ai' };
}

function createVoiceTextPatch(text) {
  return {
    aiText: String(text || '').trim(),
    composerMode: 'ai',
    voiceText: ''
  };
}

module.exports = { COMPOSER_MODES, getComposerAction, createVoiceTextPatch };
