// pages/ledger-detail/ledger-detail.js
// 共享账本详情页：成员列表、账本记录、邀请、退出
const { call } = require('../../utils/cloud');

Page({
  data: {
    statusBarH: 20,
    ledgerId: '',
    ledger: null,
    records: [],
    loading: true,
    isOwner: false,
    source: 'ledger',   // 记录来源标记：ledger 记账
    showRecords: false,
    // 账本统计
    stats: null,
    statsLoading: false
  },

  async onLoad(options) {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const ledgerId = (options && options.ledgerId) || '';
    this.setData({ statusBarH: info.statusBarHeight || 20, ledgerId });
    if (ledgerId) {
      await this.loadDetail();
      await this.loadRecords();
      this.loadStats();
    }
  },

  goBack() { wx.navigateBack(); },

  async loadDetail() {
    try {
      const ledger = await call('ledger', { action: 'detail', ledgerId: this.data.ledgerId });
      const app = getApp();
      const myOpenid = app.globalData.openid;
      this.setData({
        ledger,
        isOwner: myOpenid && ledger.ownerOpenid === myOpenid
      });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadRecords() {
    try {
      const records = await call('ledger', { action: 'myRecords', ledgerId: this.data.ledgerId, limit: 50 });
      this.setData({ records: records || [] });
    } catch (e) {
      console.error('load ledger records failed', e);
    }
  },

  // 账本统计：全家汇总 + 成员贡献（金额在 JS 格式化，避免 WXML 复杂表达式）
  async loadStats() {
    this.setData({ statsLoading: true });
    try {
      const now = Date.now();
      const start = now - 30 * 24 * 3600 * 1000; // 近30天
      const stats = await call('ledger', { action: 'stats', ledgerId: this.data.ledgerId, start, end: now });
      const expense = Number(stats.totals.expense) || 0;
      const income = Number(stats.totals.income) || 0;
      const net = expense - income;
      const members = (stats.members || []).map(m => ({
        ...m,
        totalText: (Number(m.total) || 0).toFixed(2)
      }));
      this.setData({
        stats: {
          ...stats,
          expenseText: expense.toFixed(2),
          incomeText: income.toFixed(2),
          netText: (net >= 0 ? '' : '-') + Math.abs(net).toFixed(2),
          members
        }
      });
    } catch (e) {
      console.error('load ledger stats failed', e);
    } finally {
      this.setData({ statsLoading: false });
    }
  },

  // 分享给好友（open-type="share" 按钮直接拉起微信分享面板）
  // 好友点击分享卡片 → 打开 ledger-list?ledgerId=xxx → onLoad 自动加入
  onShareAppMessage() {
    const ledger = this.data.ledger || {};
    return {
      title: `邀请你加入「${ledger.name || '共享账本'}」一起记账`,
      path: `/pages/ledger-list/ledger-list?ledgerId=${this.data.ledgerId}`,
      imageUrl: ''
    };
  },

  // 退出账本
  leaveLedger() {
    wx.showModal({
      title: '退出账本',
      content: this.data.isOwner
        ? '你是创建者，退出将解散账本（账本内记录保留在你的个人账下）。确定退出？'
        : '退出后你将看不到该账本的记录。确定退出？',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中…' });
        try {
          await call('ledger', { action: 'leave', ledgerId: this.data.ledgerId });
          wx.hideLoading();
          wx.showToast({ title: this.data.isOwner ? '账本已解散' : '已退出账本', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1200);
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: e.message || '操作失败', icon: 'none' });
        }
      }
    });
  },

  // 去记账（切到账本记账）
  goRecord() {
    wx.setStorageSync('activeLedgerId', this.data.ledgerId);
    wx.switchTab({ url: '/pages/record/record' });
  },

  toggleRecords() { this.setData({ showRecords: !this.data.showRecords }); }
});
