// utils/stat.js — 环比/同比计算
// ratio: 返回涨跌幅（-0.12 表示下降 12%）；分母为 0 时返回 null（无法计算）
function ratio(current, previous) {
  if (previous === undefined || previous === null) return null;
  if (previous === 0) return current > 0 ? null : 0;
  return (current - previous) / previous;
}

function formatPct(r) {
  if (r === null || r === undefined) return '--';
  const pct = (r * 100).toFixed(1);
  return (pct > 0 ? '+' : '') + pct + '%';
}

// 趋势颜色：支出上升=红（变差），收入上升=绿（变好）
function trendColor(r, kind) {
  if (r === null || r === undefined) return '#999999';
  const up = r > 0;
  if (kind === 'expense') return up ? '#fa5151' : '#07c160';
  if (kind === 'income') return up ? '#07c160' : '#fa5151';
  return up ? '#fa5151' : '#07c160';
}

module.exports = { ratio, formatPct, trendColor };
