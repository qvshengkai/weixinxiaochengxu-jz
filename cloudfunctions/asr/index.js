// cloudfunctions/asr/index.js
// 语音识别：下载云存储录音 → 腾讯云「一句话识别」(SentenceRecognition) → 返回文本
// 依赖：wx-server-sdk（云函数环境自动注入）、Node 内置 crypto / https，无需第三方包
//
// 前置：在云函数「配置 → 环境变量」中设置
//   TENCENT_SECRET_ID  = 腾讯云 API 密钥 SecretId
//   TENCENT_SECRET_KEY = 腾讯云 API 密钥 SecretKey
// 并在腾讯云控制台开通「语音识别 ASR」服务（个人实名账号免费额度充足）
const cloud = require('wx-server-sdk');
const https = require('https');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 优先级：云函数环境变量 > 本地 config.js（上传部署时一并打包）
let SECRET_ID = process.env.TENCENT_SECRET_ID;
let SECRET_KEY = process.env.TENCENT_SECRET_KEY;
if (!SECRET_ID || !SECRET_KEY) {
  try {
    const cfg = require('./config');
    SECRET_ID = SECRET_ID || cfg.SECRET_ID;
    SECRET_KEY = SECRET_KEY || cfg.SECRET_KEY;
  } catch (e) {
    // config.js 不存在时忽略，走环境变量
  }
}

const HOST = 'asr.tencentcloudapi.com';
const SERVICE = 'asr';
const REGION = 'ap-guangzhou';
const ACTION = 'SentenceRecognition';
const VERSION = '2019-06-14';

// TC3-HMAC-SHA256 签名（腾讯云标准鉴权方式）
function signTC3(secretId, secretKey, payloadStr, timestamp) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10); // YYYY-MM-DD

  const hashedPayload = crypto.createHash('sha256').update(payloadStr).digest('hex');
  const canonicalHeaders = 'content-type:application/json; charset=utf-8\nhost:' + HOST + '\n';
  const signedHeaders = 'content-type;host';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload
  ].join('\n');

  const credentialScope = date + '/' + SERVICE + '/tc3_request';
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    hashedCanonicalRequest
  ].join('\n');

  const secretDate = crypto.createHmac('sha256', 'TC3' + secretKey).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(SERVICE).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  return 'TC3-HMAC-SHA256 Credential=' + secretId + '/' + credentialScope +
    ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
}

// 调用腾讯云一句话识别
function callASR(audioBase64, audioLen) {
  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payloadStr = JSON.stringify({
      EngineModelType: '16k_zh', // 16k 中文普通话
      ChannelNum: 1,
      ResTextFormat: 0,          // 0=纯文本
      SourceType: 1,             // 1=音频数据内嵌在 Data 字段
      Data: audioBase64,
      DataLen: audioLen
    });

    const authorization = signTC3(SECRET_ID, SECRET_KEY, payloadStr, timestamp);
    const options = {
      hostname: HOST,
      path: '/',
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json; charset=utf-8',
        'Host': HOST,
        'X-TC-Action': ACTION,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Version': VERSION,
        'X-TC-Region': REGION
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const resp = json.Response || {};
          if (resp.Result) {
            resolve(resp.Result.trim());
          } else if (resp.Error) {
            reject(new Error(resp.Error.Message || 'ASR Error'));
          } else {
            reject(new Error('Unknown ASR response: ' + body));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(payloadStr);
    req.end();
  });
}

exports.main = async (event) => {
  try {
    const { fileID } = event;
    if (!fileID) throw new Error('missing fileID');
    if (!SECRET_ID || !SECRET_KEY) {
      throw new Error('TENCENT_SECRET_ID / TENCENT_SECRET_KEY 未配置（云函数环境变量）');
    }

    // 1. 下载云存储中的录音文件
    const dl = await cloud.downloadFile({ fileID });
    const audioBuffer = dl.fileContent;

    // 2. 调用腾讯云 ASR
    const text = await callASR(audioBuffer.toString('base64'), audioBuffer.length);
    return { success: true, text };
  } catch (e) {
    console.error('[asr] error', e);
    return { success: false, error: e.message };
  }
};
