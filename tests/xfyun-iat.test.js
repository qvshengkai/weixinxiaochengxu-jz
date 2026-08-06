const assert = require('node:assert/strict');
const { test } = require('node:test');

function loadXfyunIat() {
  try {
    return require('../cloudfunctions/asr/xfyun-iat');
  } catch (error) {
    return {};
  }
}

test('讯飞 IAT signs the WebSocket URL with the API key and secret', () => {
  const { buildAuthUrl } = loadXfyunIat();
  assert.equal(typeof buildAuthUrl, 'function');

  const url = new URL(buildAuthUrl({
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    date: new Date('2026-08-05T00:00:00Z')
  }));

  assert.equal(url.protocol, 'wss:');
  assert.equal(url.hostname, 'iat-api.xfyun.cn');
  assert.equal(url.pathname, '/v2/iat');
  assert.ok(url.searchParams.get('authorization'));
  assert.ok(url.searchParams.get('date'));
  assert.equal(url.searchParams.get('host'), 'iat-api.xfyun.cn');
});

test('讯飞 IAT parser joins recognized word fragments', () => {
  const { extractIatText } = loadXfyunIat();
  assert.equal(typeof extractIatText, 'function');

  assert.equal(extractIatText({
    data: { result: { ws: [
      { cw: [{ w: '今天' }] },
      { cw: [{ w: '午饭' }] },
      { cw: [{ w: '二十八元' }] }
    ] } }
  }), '今天午饭二十八元');
});

test('讯飞 IAT creates a first PCM frame with required audio metadata', () => {
  const { createIatFrames } = loadXfyunIat();
  assert.equal(typeof createIatFrames, 'function');

  const frames = createIatFrames(Buffer.from([1, 2, 3]), 'test-app');
  assert.equal(frames[0].common.app_id, 'test-app');
  assert.equal(frames[0].business.language, 'zh_cn');
  assert.equal(frames[0].data.status, 0);
  assert.equal(frames[0].data.format, 'audio/L16;rate=16000');
  assert.equal(frames.at(-1).data.status, 2);
});
