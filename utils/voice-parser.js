// utils/voice-parser.js — 把语音识别文本解析为结构化记账字段
const { matchCategory } = require('./categories');
const { startOfDay, addDays } = require('./date');

const CN_NUM = { '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };

// 金额解析：优先带单位 → 最后一个裸数字 → 中文数字
function parseAmount(text) {
  if (!text) return null;
  const withUnit = text.match(/(\d+(?:\.\d+)?)\s*(块|元|块钱|元钱)/);
  if (withUnit) return parseFloat(withUnit[1]);
  const nums = text.match(/(\d+(?:\.\d+)?)/g);
  if (nums && nums.length) return parseFloat(nums[nums.length - 1]);
  const cn = text.replace(/[块元钱]/g, '');
  if (/[零一二两三四五六七八九十百千万]/.test(cn)) return parseChineseNumber(cn);
  return null;
}

// 中文数字：支持 十/百/千/万（递归组合）
function parseChineseNumber(s) {
  s = s.replace(/[^零一二两三四五六七八九十百千万]/g, '');
  if (!s) return null;
  if (s.length === 1 && CN_NUM[s] !== undefined) return CN_NUM[s];
  if (s.includes('万')) {
    const parts = s.split('万');
    const w = parts[0] ? (CN_NUM[parts[0]] || 1) : 1;
    const rest = parts[1] ? parseChineseNumber(parts[1]) : 0;
    return w * 10000 + rest;
  }
  if (s.includes('千')) {
    const parts = s.split('千');
    const thousands = parts[0] ? (CN_NUM[parts[0]] || 1) : 1;
    const rest = parts[1] ? parseChineseNumber(parts[1]) : 0;
    return thousands * 1000 + rest;
  }
  if (s.includes('百')) {
    const parts = s.split('百');
    const hundreds = parts[0] ? (CN_NUM[parts[0]] || 1) : 1;
    const rest = parts[1] ? parseChineseNumber(parts[1]) : 0;
    return hundreds * 100 + rest;
  }
  if (s.includes('十')) {
    const parts = s.split('十');
    const tens = parts[0] ? (CN_NUM[parts[0]] || 1) : 1;
    const ones = parts[1] ? (CN_NUM[parts[1]] || 0) : 0;
    return tens * 10 + ones;
  }
  return null;
}

function parseDate(text) {
  const today = new Date();
  if (/今天|今日/.test(text)) return startOfDay(today).getTime();
  if (/大前天/.test(text)) return startOfDay(addDays(today, -3)).getTime();
  if (/昨天|昨日/.test(text)) return startOfDay(addDays(today, -1)).getTime();
  if (/前天/.test(text)) return startOfDay(addDays(today, -2)).getTime();
  if (/大后天/.test(text)) return startOfDay(addDays(today, 3)).getTime();
  if (/后天/.test(text)) return startOfDay(addDays(today, 2)).getTime();
  if (/明天|明日/.test(text)) return startOfDay(addDays(today, 1)).getTime();
  if (/上周/.test(text)) {
    const lwd = text.match(/上周([一二三四五六日天])/);
    if (lwd) {
      const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7 };
      const target = map[lwd[1]];
      const d = startOfDay(today);
      const day = d.getDay();
      const daysFromMon = day === 0 ? 6 : day - 1;
      return startOfDay(addDays(d, -daysFromMon - 7 + (target - 1))).getTime();
    }
    const d = startOfDay(today);
    const day = d.getDay();
    const daysFromMon = day === 0 ? 6 : day - 1;
    return startOfDay(addDays(d, -daysFromMon - 7)).getTime();
  }
  if (/本周|这周|这礼拜/.test(text)) return startOfDay(today).getTime();
  if (/上月|上个月/.test(text)) {
    const d = startOfDay(today);
    d.setMonth(d.getMonth() - 1);
    return d.getTime();
  }
  if (/本月|这个月/.test(text)) return startOfDay(today).getTime();
  const dayM = text.match(/(\d{1,2})\s*号/);
  if (dayM) {
    const d = startOfDay(today);
    d.setDate(parseInt(dayM[1], 10));
    if (d.getTime() > today.getTime()) d.setMonth(d.getMonth() - 1);
    return d.getTime();
  }
  const weekM = text.match(/周([一二三四五六日天])/);
  if (weekM) {
    const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
    const target = map[weekM[1]];
    const d = startOfDay(today);
    const day = d.getDay();
    let diff = target - day;
    if (diff > 0) diff -= 7;
    return addDays(d, diff).getTime();
  }
  return startOfDay(today).getTime();
}

// 收支类型：收紧"发"字，避免"发现/出发/理发"误判为收入
function parseType(text) {
  if (/工资|薪水|奖金|退款|收入|到账|赚了|赚|发工资|发奖金|发钱|分红|收款|收到|红包|报销|退回/.test(text)) return 'income';
  return 'expense';
}

// 主解析：返回 { amount, happenAt, type, categoryId, note, raw }
function parseVoice(text, categories) {
  const clean = (text || '').replace(/\s/g, '');
  const amount = parseAmount(clean);
  const happenAt = parseDate(clean);
  const type = parseType(clean);
  const cat = matchCategory(clean, categories);
  const note = clean
    .replace(/\d+(\.\d+)?\s*(块|元|块钱|元钱)?/g, '')
    .replace(/[零一二两三四五六七八九十百千万\d]+/g, '')
    .replace(/今天|今日|昨天|昨日|前天|大前天|后天|大后天|明天|明日|上周|本周|这周|这礼拜|上月|上个月|本月|这个月|号|周[一二三四五六日天]|吃|花了|花|付|买|记|一笔|记账|块|元/g, '')
    .trim()
    .slice(0, 20);
  return {
    amount,
    happenAt,
    type: cat ? cat.type : type,
    categoryId: cat ? cat.id : (type === 'income' ? 'other_inc' : 'other_exp'),
    note,
    raw: text
  };
}

module.exports = { parseVoice };
