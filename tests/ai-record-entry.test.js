const assert = require('node:assert/strict');
const { test } = require('node:test');

function loadAiRecordEntry() {
  try {
    return require('../utils/ai-record-entry');
  } catch (error) {
    return {};
  }
}

test('AI suggestion becomes a safe existing record form patch', () => {
  const { createAiRecordPatch } = loadAiRecordEntry();
  assert.equal(typeof createAiRecordPatch, 'function');

  const patch = createAiRecordPatch({
    amount: 28,
    type: 'expense',
    categoryId: 'food',
    happenAt: 1785801600000,
    note: '午饭'
  }, [
    { id: 'food', type: 'expense', name: '餐饮', emoji: '🍜' },
    { id: 'salary', type: 'income', name: '工资', emoji: '💰' }
  ]);

  assert.deepEqual(patch, {
    amountStr: '28',
    type: 'expense',
    categoryId: 'food',
    selectedCategory: { id: 'food', type: 'expense', name: '餐饮', emoji: '🍜' },
    happenAt: 1785801600000,
    note: '午饭',
    source: 'ai'
  });
});

test('AI suggestion rejects an unknown or mismatched category', () => {
  const { createAiRecordPatch } = loadAiRecordEntry();
  assert.equal(typeof createAiRecordPatch, 'function');

  assert.throws(() => createAiRecordPatch({
    amount: 28,
    type: 'expense',
    categoryId: 'salary',
    happenAt: 1785801600000,
    note: ''
  }, [{ id: 'salary', type: 'income' }]), /category/i);
});
