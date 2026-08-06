const assert = require('node:assert/strict');
const { test } = require('node:test');

function loadSenseNovaClient() {
  try {
    return require('../cloudfunctions/parse-agent/sensenova-client');
  } catch (error) {
    return {};
  }
}

test('SenseNova request follows its chat-completions contract', () => {
  const { buildSenseNovaRequest } = loadSenseNovaClient();
  assert.equal(typeof buildSenseNovaRequest, 'function');

  const request = buildSenseNovaRequest({
    model: 'deepseek-v4-flash',
    text: '今天午饭 28 元',
    now: 1785801600000,
    categories: [{ id: 'food', name: '餐饮', type: 'expense' }]
  });

  assert.equal(request.model, 'deepseek-v4-flash');
  assert.equal(request.stream, false);
  assert.equal(request.max_new_tokens, 256);
  assert.match(request.messages[0].content, /JSON/);
  assert.match(request.messages[1].content, /"id":"food"/);
});

test('SenseNova response parser extracts non-streaming assistant content', () => {
  const { parseSenseNovaResponse } = loadSenseNovaClient();
  assert.equal(typeof parseSenseNovaResponse, 'function');

  assert.equal(parseSenseNovaResponse({
    status: { code: 0 },
    data: { choices: [{ message: '{"amount":28}' }] }
  }), '{"amount":28}');
  assert.throws(() => parseSenseNovaResponse({ status: { code: 1 } }), /SenseNova/);
});
