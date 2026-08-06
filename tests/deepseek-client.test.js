const assert = require('node:assert/strict');
const { test } = require('node:test');

function loadDeepSeekClient() {
  try {
    return require('../cloudfunctions/parse-agent/deepseek-client');
  } catch (error) {
    return {};
  }
}

test('DeepSeek request asks for JSON and limits categories to the current user set', () => {
  const { buildChatRequest } = loadDeepSeekClient();
  assert.equal(typeof buildChatRequest, 'function');

  const request = buildChatRequest({
    model: 'deepseek-v4-flash',
    text: '今天午饭 28 元',
    now: 1785801600000,
    categories: [{ id: 'food', name: '餐饮', type: 'expense', keywords: ['午饭'] }]
  });

  assert.equal(request.model, 'deepseek-v4-flash');
  assert.deepEqual(request.response_format, { type: 'json_object' });
  assert.equal(request.temperature, 0.1);
  assert.match(request.messages[0].content, /json/i);
  assert.match(request.messages[1].content, /"id":"food"/);
  assert.doesNotMatch(request.messages[1].content, /keywords/);
});

test('DeepSeek content parser rejects a non-object response', () => {
  const { parseModelContent } = loadDeepSeekClient();
  assert.equal(typeof parseModelContent, 'function');

  assert.deepEqual(parseModelContent('{"amount":28,"type":"expense"}'), {
    amount: 28,
    type: 'expense'
  });
  assert.throws(() => parseModelContent('[]'), /object/i);
});

test('server-side validation accepts only a current category with the matching type', () => {
  const { validateSuggestion } = loadDeepSeekClient();
  assert.equal(typeof validateSuggestion, 'function');

  const categories = [{ id: 'food', name: '餐饮', type: 'expense' }];
  assert.deepEqual(validateSuggestion({
    amount: '28', type: 'expense', categoryId: 'food', happenAt: 1785801600000, note: '午饭'
  }, categories), {
    amount: 28, type: 'expense', categoryId: 'food', happenAt: 1785801600000, note: '午饭'
  });
  assert.throws(() => validateSuggestion({
    amount: 28, type: 'income', categoryId: 'food', happenAt: 1785801600000, note: ''
  }, categories), /category/i);
});
