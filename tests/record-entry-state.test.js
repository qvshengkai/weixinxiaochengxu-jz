const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  createRecordEntryState,
  transitionRecordEntry
} = require('../utils/record-entry-state');

test('entry state starts with both panels closed', () => {
  assert.deepEqual(createRecordEntryState('food'), {
    entryVisible: false,
    categoryPickerVisible: false,
    categoryId: 'food'
  });
});

test('selecting a category returns to the amount panel', () => {
  let state = createRecordEntryState('food');
  state = transitionRecordEntry(state, { type: 'OPEN_ENTRY' });
  state = transitionRecordEntry(state, { type: 'OPEN_CATEGORY_PICKER' });
  state = transitionRecordEntry(state, { type: 'SELECT_CATEGORY', categoryId: 'traffic' });

  assert.deepEqual(state, {
    entryVisible: true,
    categoryPickerVisible: false,
    categoryId: 'traffic'
  });
});

test('closing the entry also closes the category picker', () => {
  let state = createRecordEntryState('food');
  state = transitionRecordEntry(state, { type: 'OPEN_ENTRY' });
  state = transitionRecordEntry(state, { type: 'OPEN_CATEGORY_PICKER' });
  state = transitionRecordEntry(state, { type: 'CLOSE_ENTRY' });

  assert.deepEqual(state, {
    entryVisible: false,
    categoryPickerVisible: false,
    categoryId: 'food'
  });
});
