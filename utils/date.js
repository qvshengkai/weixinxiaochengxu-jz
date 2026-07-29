// utils/date.js — 时间窗口与对比期计算
// 所有窗口以「毫秒时间戳」返回，便于云数据库做数值范围查询。

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
function addYears(d, n) {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + n);
  return x;
}
// 周一为一周起点
function startOfWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=周日
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}
function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function startOfYear(d) {
  const x = startOfDay(d);
  x.setMonth(0, 1);
  return x;
}
function range(start, end) {
  return { start: start.getTime(), end: end.getTime() };
}

// 报表页支持的周期
const PERIOD_KEYS = ['yesterday', 'lastWeek', 'thisWeek', 'lastMonth', 'thisMonth', 'year'];
const PERIOD_LABELS = {
  yesterday: '昨日',
  lastWeek: '上周',
  thisWeek: '本周',
  lastMonth: '上月',
  thisMonth: '本月',
  year: '年度'
};

// 返回 { current, prev, yoy } 三个时间窗口（yoy 可能为 null）
function getCompare(key) {
  const now = new Date();
  let current, prev, yoy = null;
  switch (key) {
    case 'yesterday':
      current = range(startOfDay(addDays(now, -1)), startOfDay(now));
      prev = range(startOfDay(addDays(now, -2)), startOfDay(addDays(now, -1)));
      yoy = range(startOfDay(addYears(addDays(now, -1), -1)), startOfDay(addYears(now, -1)));
      break;
    case 'thisWeek':
      current = range(startOfWeek(now), startOfWeek(addDays(now, 7)));
      prev = range(startOfWeek(addDays(now, -7)), startOfWeek(now));
      yoy = range(startOfWeek(addYears(now, -1)), startOfWeek(addYears(addDays(now, 7), -1)));
      break;
    case 'lastWeek':
      current = range(startOfWeek(addDays(now, -7)), startOfWeek(now));
      prev = range(startOfWeek(addDays(now, -14)), startOfWeek(addDays(now, -7)));
      yoy = range(startOfWeek(addYears(addDays(now, -7), -1)), startOfWeek(addYears(now, -1)));
      break;
    case 'thisMonth':
      current = range(startOfMonth(now), startOfMonth(addMonths(now, 1)));
      prev = range(startOfMonth(addMonths(now, -1)), startOfMonth(now));
      yoy = range(startOfMonth(addYears(now, -1)), startOfMonth(addYears(addMonths(now, 1), -1)));
      break;
    case 'lastMonth':
      current = range(startOfMonth(addMonths(now, -1)), startOfMonth(now));
      prev = range(startOfMonth(addMonths(now, -2)), startOfMonth(addMonths(now, -1)));
      yoy = range(startOfMonth(addYears(addMonths(now, -1), -1)), startOfMonth(addYears(now, -1)));
      break;
    case 'year':
      current = range(startOfYear(now), startOfYear(addYears(now, 1)));
      prev = range(startOfYear(addYears(now, -1)), startOfYear(now));
      yoy = null;
      break;
    default:
      current = range(startOfMonth(now), startOfMonth(addMonths(now, 1)));
      prev = range(startOfMonth(addMonths(now, -1)), startOfMonth(now));
      yoy = null;
  }
  return { current, prev, yoy };
}

function formatDate(ts, fmt) {
  const d = new Date(ts);
  const p = n => (n < 10 ? '0' + n : '' + n);
  const map = { YYYY: d.getFullYear(), MM: p(d.getMonth() + 1), DD: p(d.getDate()) };
  return (fmt || 'YYYY-MM-DD')
    .replace('YYYY', map.YYYY)
    .replace('MM', map.MM)
    .replace('DD', map.DD);
}

module.exports = { getCompare, PERIOD_KEYS, PERIOD_LABELS, formatDate, startOfDay, addDays };
