const cloud = require('wx-server-sdk');
const { validateSuggestion } = require('./deepseek-client');
const {
  buildSenseNovaRequest,
  parseSenseNovaResponse,
  requestSenseNova
} = require('./sensenova-client');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const MAX_TEXT_LENGTH = 200;
const DEFAULT_MODEL = 'deepseek-v4-flash';

// 容错解析：AI 模型可能返回 ```json 代码块 或 自然语言包裹的 JSON，
// 直接 JSON.parse 易失败导致 502。先剥离代码块、截取首个 {...} 再解析。
function safeParseJson(content) {
  if (content && typeof content === 'object') return content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI 返回内容为空');
  let s = content.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  const value = JSON.parse(s);
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('AI 返回不是合法 JSON 对象');
  }
  return value;
}

exports.main = async (event) => {
  const text = typeof event.text === 'string' ? event.text.trim() : '';
  const categories = Array.isArray(event.categories) ? event.categories : [];
  const now = Number(event.now) || Date.now();
  const apiKey = process.env.SENSENOVA_API_KEY;

  if (!text || text.length > MAX_TEXT_LENGTH) return { code: 400, message: '请输入不超过 200 字的记账描述' };
  if (!categories.length) return { code: 400, message: '没有可用分类' };
  if (!apiKey) return { code: 500, message: 'AI 服务尚未配置' };

  try {
    const response = await requestSenseNova(apiKey, buildSenseNovaRequest({
      model: process.env.SENSENOVA_MODEL || DEFAULT_MODEL,
      text,
      now,
      categories
    }));
    const content = parseSenseNovaResponse(response);
    const suggestion = safeParseJson(content);
    return { code: 0, data: validateSuggestion(suggestion, categories) };
  } catch (error) {
    console.error('parse-agent failed', error);
    return { code: 502, message: 'AI 暂时不可用，请手动填写或稍后重试' };
  }
};
