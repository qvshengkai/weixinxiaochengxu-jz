const https = require('https');

function buildSenseNovaRequest({ model, text, now, categories }) {
  const allowedCategories = (categories || []).map(({ id, name, type }) => ({ id, name, type }));
  const system = [
    'You extract one personal bookkeeping record.',
    'Return a JSON object only with amount, type, categoryId, happenAt and note.',
    'type must be expense or income. categoryId must be one of the provided categories.',
    'amount must be a positive number. happenAt must be a Unix timestamp in milliseconds.',
    'Use the supplied current time to resolve relative dates. JSON only.'
  ].join(' ');
  return {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ text, now, categories: allowedCategories }) }
    ],
    max_new_tokens: 256,
    temperature: 0.1,
    stream: false
  };
}

function parseSenseNovaResponse(response) {
  if (!response || !response.status || response.status.code !== 0) {
    throw new Error('SenseNova response is invalid');
  }
  const content = response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('SenseNova response is empty');
  }
  return content;
}

function requestSenseNova(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request({
      hostname: 'api.sensenova.cn',
      path: '/v1/llm/chat-completions',
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
          reject(new Error(`SenseNova request failed (${response.statusCode})`));
          return;
        }
        try { resolve(JSON.parse(raw)); } catch (error) { reject(new Error('SenseNova response is invalid')); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('SenseNova request timed out')));
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

module.exports = { buildSenseNovaRequest, parseSenseNovaResponse, requestSenseNova };
