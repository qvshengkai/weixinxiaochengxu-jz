const https = require('https');

const VALID_TYPES = ['expense', 'income'];

function buildChatRequest({ model, text, now, categories }) {
  const allowedCategories = (categories || []).map(({ id, name, type }) => ({ id, name, type }));
  const system = [
    'You extract one personal bookkeeping record.',
    'Return a JSON object only with amount, type, categoryId, happenAt and note.',
    'type must be expense or income. categoryId must be one of the provided categories.',
    'amount must be a positive number. happenAt must be a Unix timestamp in milliseconds.',
    'Use the supplied current time to resolve relative dates. json only.'
  ].join(' ');
  const user = JSON.stringify({ text, now, categories: allowedCategories });
  return {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 256,
    stream: false,
    thinking: { type: 'disabled' }
  };
}

function parseModelContent(content) {
  const value = JSON.parse(content);
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('DeepSeek response must be an object');
  }
  return value;
}

function validateSuggestion(suggestion, categories) {
  const amount = Number(suggestion && suggestion.amount);
  const happenAt = Number(suggestion && suggestion.happenAt);
  const category = (categories || []).find(item => item.id === suggestion.categoryId);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('AI suggestion amount is invalid');
  if (!VALID_TYPES.includes(suggestion.type)) throw new Error('AI suggestion type is invalid');
  if (!category || category.type !== suggestion.type) throw new Error('AI suggestion category is invalid');
  if (!Number.isFinite(happenAt) || happenAt <= 0) throw new Error('AI suggestion date is invalid');
  return {
    amount,
    type: suggestion.type,
    categoryId: category.id,
    happenAt,
    note: typeof suggestion.note === 'string' ? suggestion.note.trim().slice(0, 20) : ''
  };
}

function requestDeepSeek(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 15000
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`DeepSeek request failed (${response.statusCode})`));
          return;
        }
        try { resolve(JSON.parse(raw)); } catch (error) { reject(new Error('DeepSeek response is invalid')); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('DeepSeek request timed out')));
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

module.exports = { buildChatRequest, parseModelContent, validateSuggestion, requestDeepSeek };
