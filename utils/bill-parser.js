// utils/bill-parser.js — 微信支付账单 CSV 解析（端侧预处理）
// 微信账单默认导出为 Excel，用户可「另存为 CSV」后用 wx.chooseMessageFile 选入。
// 列示例：交易时间,交易类型,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
const { matchCategory } = require('./categories');

function splitCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function toAmount(s) {
  const m = (s || '').match(/-?[\d,]+(\.\d+)?/);
  if (!m) return 0;
  return parseFloat(m[0].replace(/,/g, ''));
}

function parseTime(s) {
  const m = (s || '').match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return Date.now();
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

// 返回 { records, skipped }，records 为可批量写入云数据库的结构
function parse(text, categories) {
  if (!text) return { records: [], skipped: 0 };
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  let headerIdx = lines.findIndex(l => l.includes('交易时间'));
  if (headerIdx < 0) headerIdx = lines.findIndex(l => l.includes('时间') && l.includes('金额'));
  if (headerIdx < 0) return { records: [], skipped: lines.length };

  const headers = splitCsvLine(lines[headerIdx]);
  const idx = name => headers.findIndex(h => h.includes(name));
  const iTime = idx('时间'), iGoods = idx('商品'), iInout = idx('收/支'),
        iAmt = idx('金额'), iStatus = idx('状态'), iRemark = idx('备注');

  const records = [];
  let skipped = 0;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3) { skipped++; continue; }
    const status = cols[iStatus] || '';
    if (status.includes('退款')) { skipped++; continue; } // 退款行跳过，避免重复
    const inout = cols[iInout] || '';
    const type = inout.includes('收') ? 'income' : 'expense';
    const amount = toAmount(cols[iAmt]);
    if (!amount) { skipped++; continue; }
    const goods = (cols[iGoods] || '').trim();
    const cat = matchCategory(goods + ' ' + (cols[iRemark] || ''), categories);
    records.push({
      type,
      amount: Math.abs(amount),
      categoryId: cat ? cat.id : (type === 'income' ? 'other_inc' : 'other_exp'),
      note: goods.slice(0, 30),
      happenAt: parseTime(cols[iTime]),
      source: 'import'
    });
  }
  return { records, skipped };
}

module.exports = { parse };
