const crypto = require('crypto');

const HOST = 'iat-api.xfyun.cn';
const PATH = '/v2/iat';
const FRAME_BYTES = 1280; // 讯飞推荐每帧 40ms@16k/16bit = 1280 字节

function buildAuthUrl({ apiKey, apiSecret, date = new Date() }) {
  const dateText = date.toUTCString();
  const signatureOrigin = `host: ${HOST}\ndate: ${dateText}\nGET ${PATH} HTTP/1.1`;
  const signature = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const query = new URLSearchParams({
    authorization: Buffer.from(authorizationOrigin).toString('base64'),
    date: dateText,
    host: HOST
  });
  return `wss://${HOST}${PATH}?${query.toString()}`;
}

function extractIatText(message) {
  const words = message && message.data && message.data.result && message.data.result.ws;
  if (!Array.isArray(words)) return '';
  return words.map(word => {
    const candidates = word && word.cw;
    return Array.isArray(candidates) && candidates[0] ? candidates[0].w || '' : '';
  }).join('');
}

function createIatFrames(audioBuffer, appId) {
  const chunks = [];
  for (let offset = 0; offset < audioBuffer.length; offset += FRAME_BYTES) {
    chunks.push(audioBuffer.subarray(offset, offset + FRAME_BYTES));
  }
  if (!chunks.length) throw new Error('audio is empty');

  return chunks.map((chunk, index) => {
    const data = {
      status: index === 0 ? 0 : 1,
      format: 'audio/L16;rate=16000',
      encoding: 'raw',
      audio: chunk.toString('base64')
    };
    if (index !== 0) return { data };
    return {
      common: { app_id: appId },
      business: { language: 'zh_cn', domain: 'iat', accent: 'mandarin' },
      data
    };
  }).concat([{ data: { status: 2 } }]);
}

function recognizePcm({ appId, apiKey, apiSecret, audioBuffer }) {
  return new Promise((resolve, reject) => {
    const WebSocket = require('ws');
    const socket = new WebSocket(buildAuthUrl({ apiKey, apiSecret }));
    let settled = false;
    let text = '';
    let frames = null;
    let sendIndex = 0;
    let timer = null;
    const FRAME_INTERVAL = 40; // ms，模拟实时音频流：讯飞要求帧间隔约 40ms，禁止瞬间一次性发完
    const WATCHDOG_MS = 55000; // 云函数超时为 60s，提前兜底避免被硬掐

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      if (timer) clearInterval(timer);
      try { socket.close(); } catch (e) { /* noop */ }
      if (error) reject(error); else resolve(result);
    };

    socket.on('open', () => {
      try {
        frames = createIatFrames(audioBuffer, appId);
      } catch (error) {
        finish(error);
        return;
      }
      if (!frames.length) { finish(new Error('audio is empty')); return; }
      // 逐帧定时发送，模拟真实麦克风流式输入
      timer = setInterval(() => {
        if (sendIndex >= frames.length) {
          clearInterval(timer);
          timer = null;
          return;
        }
        try {
          socket.send(JSON.stringify(frames[sendIndex]));
        } catch (error) {
          finish(error);
          return;
        }
        sendIndex += 1;
      }, FRAME_INTERVAL);
    });
    socket.on('message', raw => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.code !== 0) {
          finish(new Error(message.message || `讯飞识别失败 (${message.code})`));
          return;
        }
        text += extractIatText(message);
        if (message.data && message.data.status === 2) finish(null, text.trim());
      } catch (error) {
        finish(error);
      }
    });
    socket.on('error', error => finish(error));

    const watchdog = setTimeout(() => finish(new Error('讯飞识别超时')), WATCHDOG_MS);
    socket.on('close', () => clearTimeout(watchdog));
  });
}

module.exports = { buildAuthUrl, extractIatText, createIatFrames, recognizePcm };