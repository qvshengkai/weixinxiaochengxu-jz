// pages/me/me.js
const categoryService = require('../../utils/category-service');
const db = () => wx.cloud.database();

Page({
  data: {
    statusBarH: 20,
    nick: '微信用户',
    streak: 0,
    totalCount: 0,
    budget: 0,
    customCat: 0,
    budgetWarnOn: true,
    voicePluginOn: true
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarH: info.statusBarHeight || 20 });
    this.loadCustomCatCount();
  },

  async loadCustomCatCount() {
    try {
      const cats = await categoryService.getCategories();
      this.setData({ customCat: cats.filter(c => !c.isDefault).length });
    } catch (e) {
      console.error(e);
      this.setData({ customCat: 0 });
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.setData({
      budget: wx.getStorageSync('monthlyBudget') || 0,
      budgetWarnOn: wx.getStorageSync('budgetWarnOn') !== false,
      voicePluginOn: wx.getStorageSync('voicePluginOn') !== false
    });
    this.loadStats();
    this.loadCustomCatCount();
  },

  async loadStats() {
    try {
      // 个人统计：只算个人账（排除共享账本记录）
      const cmd = db().command;
      const personal = cmd.or([{ ledgerId: '' }, { ledgerId: cmd.exists(false) }]);
      const countRes = await db().collection('records').where(personal).count();
      const res = await db().collection('records')
        .where(personal)
        .orderBy('happenAt', 'desc')
        .limit(200)
        .get();
      this.setData({
        totalCount: countRes.total || 0,
        streak: this.computeStreak(res.data.map(r => r.happenAt))
      });
    } catch (e) {
      console.error(e);
    }
  },

  // 连续记账天数：从今天往前数有记录的连续天数
  computeStreak(tsList) {
    if (!tsList || tsList.length === 0) return 0;
    const days = new Set(tsList.map(ts => new Date(ts).toDateString()));
    let streak = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // 若今天无记录，从昨天起算
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
    while (days.has(d.toDateString())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  },

  setBudget() {
    wx.showModal({
      title: '设置月度预算',
      editable: true,
      placeholderText: '输入金额，如 3000',
      success: (res) => {
        if (res.confirm) {
          const v = parseFloat(res.content) || 0;
          wx.setStorageSync('monthlyBudget', v);
          this.setData({ budget: v });
        }
      }
    });
  },

  goImport() { wx.switchTab({ url: '/pages/bill/bill' }); },

  goCategoryManage() { wx.navigateTo({ url: '/pages/category-manage/category-manage' }); },

  goLedger() { wx.navigateTo({ url: '/pages/ledger-list/ledger-list' }); },

  toggleBudgetWarn() {
    const v = !this.data.budgetWarnOn;
    wx.setStorageSync('budgetWarnOn', v);
    this.setData({ budgetWarnOn: v });
  },

  toggleVoicePlugin() {
    const v = !this.data.voicePluginOn;
    wx.setStorageSync('voicePluginOn', v);
    this.setData({ voicePluginOn: v });
    wx.showToast({ title: v ? '已开启语音记账' : '已关闭语音记账', icon: 'none' });
  },

  comingSoon() { wx.showToast({ title: '敬请期待', icon: 'none' }); },

  privacy() {
    wx.showModal({
      title: '隐私与数据说明',
      content: '我们不会自动同步你的微信支付账单。所有账目由你手动、语音或导入微信账单文件生成，仅存储于你本人的云开发数据库中，用于记账统计。',
      showCancel: false
    });
  },

  feedback() { wx.showToast({ title: '感谢反馈，请联系客服', icon: 'none' }); },

  about() {
    wx.showModal({
      title: '关于花哪去了',
      content: '花哪去了 v1.0 · 一款记录日常收支的小程序。\n· 手动 / 语音 / 微信账单导入\n· 日 / 周 / 月 / 年统计，含环比同比\n· 数据加密存于你的云开发数据库，不上传第三方',
      showCancel: false
    });
  }
});
