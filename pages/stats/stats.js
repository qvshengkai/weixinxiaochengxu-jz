// pages/stats/stats.js
const { call } = require('../../utils/cloud');
const { getCompare } = require('../../utils/date');
const { getCategory: getDefaultCategory } = require('../../utils/categories');
const categoryService = require('../../utils/category-service');

// 维度（与设计稿一致：昨日/上周/本周/上月/年度/自定义）
const DIMS = [
  { key: 'yesterday', label: '昨日' },
  { key: 'lastWeek', label: '上周' },
  { key: 'thisWeek', label: '本周' },
  { key: 'lastMonth', label: '上月' },
  { key: 'year', label: '年度' },
  { key: 'custom', label: '自定义' }
];
const BIG_LABEL = {
  yesterday: '昨日总支出',
  lastWeek: '上周总支出',
  thisWeek: '本周总支出',
  lastMonth: '上月总支出',
  year: '年度总支出',
  custom: '近30天总支出'
};

// 千分位
function money(n) {
  return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

Page({
  data: {
    statusBarH: 20,
    dims: DIMS,
    active: 'thisWeek',
    activeIndex: 2,
    bigLabel: BIG_LABEL.thisWeek,
    expense: '0.00',
    compare: [
      { label: '环比', val: '--', cls: '' },
      { label: '同比', val: '--', cls: '' }
    ],
    breakdown: [],
    donutGradient: 'conic-gradient(#EFE6FA 0% 100%)',
    budget: 0,
    budgetUsed: '0.00',
    budgetPct: 0,
    budgetWarn: '',
    allCats: []
  },

  async onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarH: info.statusBarHeight || 20 });
    await this.loadCategories();
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.setData({ budget: wx.getStorageSync('monthlyBudget') || 0 });
    await this.loadCategories();
    this.refresh();
  },

  async loadCategories() {
    const allCats = await categoryService.getCategories();
    this.setData({ allCats });
  },

  onPeriod(e) {
    const key = e.currentTarget.dataset.k;
    const idx = DIMS.findIndex(d => d.key === key);
    this.setData({ active: key, activeIndex: idx, bigLabel: BIG_LABEL[key] || '总支出' });
    this.refresh();
  },

  onSwipe(e) {
    const idx = e.detail.current;
    const key = DIMS[idx].key;
    this.setData({ active: key, activeIndex: idx, bigLabel: BIG_LABEL[key] || '总支出' });
    this.refresh();
  },

  editBudget() {
    wx.showModal({
      title: '设置月度预算',
      editable: true,
      placeholderText: '输入金额，如 3000',
      success: (res) => {
        if (res.confirm) {
          const v = parseFloat(res.content) || 0;
          wx.setStorageSync('monthlyBudget', v);
          this.setData({ budget: v });
          this.refresh();
        }
      }
    });
  },

  buildRanges(key) {
    if (key === 'custom') {
      const now = new Date();
      const end = now.getTime();
      const start = end - 30 * 24 * 3600 * 1000;
      const prevStart = start - 30 * 24 * 3600 * 1000;
      return {
        current: { start, end },
        prev: { start: prevStart, end: start },
        yoy: null
      };
    }
    return getCompare(key);
  },

  async refresh() {
    const { active } = this.data;
    const { current, prev, yoy } = this.buildRanges(active);
    const month = getCompare('thisMonth').current;
    wx.showLoading({ title: '统计中' });
    try {
      const [cur, pv, yy, monthAgg] = await Promise.all([
        call('aggregate', current),
        call('aggregate', prev),
        yoy ? call('aggregate', yoy) : Promise.resolve(null),
        call('aggregate', month)
      ]);
      this.render(cur, pv, yy, monthAgg);
    } catch (e) {
      const msg = (e && e.message) || '统计失败';
      wx.showToast({ title: msg.length > 18 ? '统计失败(看控制台)' : msg, icon: 'none' });
      console.error('[stats] 统计失败:', e);
    } finally {
      wx.hideLoading();
    }
  },

  render(cur, pv, yy, monthAgg) {
    const ci = cur.totals.income, ce = cur.totals.expense;
    const pi = pv ? pv.totals.expense : null;
    const ye = yy ? yy.totals.expense : null;

    const momE = pi != null ? (ce - pi) / (pi || 1) * 100 : null;
    const yoyE = ye != null ? (ce - ye) / (ye || 1) * 100 : null;
    const cmp = (v) => v == null
      ? { val: '—', cls: '' }
      : { val: `${v <= 0 ? '▼' : '▲'} ${Math.abs(v).toFixed(0)}%`, cls: v <= 0 ? 'down' : 'up' };
    const compare = [
      { label: '环比', ...cmp(momE) },
      { label: '同比', ...cmp(yoyE) }
    ];

    // 分类占比（支出）
    const expGroups = cur.groups
      .filter(g => g._id.type === 'expense')
      .sort((a, b) => b.total - a.total);
    const totalExp = expGroups.reduce((s, g) => s + g.total, 0) || 1;
    const breakdown = expGroups.slice(0, 5).map(g => {
      const c = this.data.allCats.find(x => x.id === g._id.category) || getDefaultCategory(g._id.category);
      return {
        name: c ? c.name : g._id.category,
        color: c ? c.color : '#B79CEA',
        total: money(g.total),
        pct: Math.round(g.total / totalExp * 100)
      };
    });
    let acc = 0;
    const stops = breakdown.map(b => {
      const start = acc; acc += b.pct;
      return `${b.color} ${start}% ${acc}%`;
    });
    const donutGradient = stops.length
      ? `conic-gradient(${stops.join(',')})`
      : 'conic-gradient(#EFE6FA 0% 100%)';

    // 预算（按本月实际支出）
    const monthExp = monthAgg ? monthAgg.totals.expense : 0;
    const budget = this.data.budget;
    const budgetPct = budget > 0 ? Math.min(100, Math.round(monthExp / budget * 100)) : 0;
    let budgetWarn = '';
    if (budget > 0) {
      budgetWarn = budgetPct >= 100
        ? `⚠ 已超支 ¥${(monthExp - budget).toFixed(0)}`
        : budgetPct >= 80
          ? `⚠ 预算已用 ${budgetPct}%，注意控制支出`
          : `剩余 ¥${(budget - monthExp).toFixed(0)}`;
    }

    this.setData({
      expense: money(ce),
      compare,
      breakdown,
      donutGradient,
      budgetUsed: money(monthExp),
      budgetPct,
      budgetWarn
    });
  }
});
