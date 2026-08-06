/**
 * @typedef {Object} AiRecordSuggestion
 * @property {number} amount
 * @property {'expense'|'income'} type
 * @property {string} categoryId
 * @property {number} happenAt
 * @property {string} note
 */

const VALID_TYPES = ['expense', 'income'];

function assertValidSuggestion(suggestion, categories) {
  const amount = Number(suggestion && suggestion.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('AI suggestion amount is invalid');
  }
  if (!suggestion || !VALID_TYPES.includes(suggestion.type)) {
    throw new Error('AI suggestion type is invalid');
  }
  if (!Number.isFinite(Number(suggestion.happenAt)) || Number(suggestion.happenAt) <= 0) {
    throw new Error('AI suggestion date is invalid');
  }

  const category = (categories || []).find(item => item.id === suggestion.categoryId);
  if (!category || category.type !== suggestion.type) {
    throw new Error('AI suggestion category is invalid');
  }
  return { amount, category };
}

function createAiRecordPatch(suggestion, categories) {
  const { amount, category } = assertValidSuggestion(suggestion, categories);
  return {
    amountStr: String(amount),
    type: suggestion.type,
    categoryId: category.id,
    selectedCategory: category,
    happenAt: Number(suggestion.happenAt),
    note: typeof suggestion.note === 'string' ? suggestion.note.trim().slice(0, 20) : '',
    source: 'ai'
  };
}

module.exports = { createAiRecordPatch };
