// pages/ledger-list/ledger-list.js
// 共享账本列表页：我的账本 + 创建账本 + 邀请加入
const { call } = require('../../utils/cloud');

Page({
  data: {
    statusBarH: 20,
    ledgers: [],
    loading: true,
    showCreate: false,
    createName: '',
    creating: false,
    pendingLedgerId: '',   // 从分享链接带过来的待加入账本
    pendingLedgerName: ''
  },

  onLoad(options) {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarH: info.statusBarHeight || 20 });

    // 分享链接带 ledgerId 参数：直接加入
    if (options && options.ledgerId) {
      this.setData({ pendingLedgerId: options.ledgerId });
      this.joinPending(options.ledgerId);
    }
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const ledgers = await call('ledger', { action: 'list' });
      this.setData({ ledgers: ledgers || [] });
    } catch (e) {
      console.error('load ledgers failed', e);
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goBack() { wx.navigateBack(); },

  // 创建账本
  toggleCreate() { this.setData({ showCreate: !this.data.showCreate, createName: '' }); },
  onCreateName(e) { this.setData({ createName: e.detail.value }); },

  async submitCreate() {
    const name = this.data.createName.trim();
    if (!name) { wx.showToast({ title: '请输入账本名称', icon: 'none' }); return; }
    this.setData({ creating: true });
    try {
      const ledger = await call('ledger', { action: 'create', name });
      this.setData({ showCreate: false, createName: '' });
      wx.showToast({ title: '账本已创建', icon: 'success' });
      this.load();
      // 创建后进入详情
      wx.navigateTo({ url: `/pages/ledger-detail/ledger-detail?ledgerId=${ledger._id}` });
    } catch (e) {
      wx.showToast({ title: e.message || '创建失败', icon: 'none' });
    } finally {
      this.setData({ creating: false });
    }
  },

  // 加入账本（从分享链接）
  async joinPending(ledgerId) {
    wx.showLoading({ title: '加入账本…' });
    try {
      const res = await call('ledger', { action: 'join', ledgerId });
      wx.hideLoading();
      if (res.alreadyMember) {
        wx.showToast({ title: '已在账本中', icon: 'none' });
      } else {
        wx.showToast({ title: `已加入「${res.ledger.name}」`, icon: 'success' });
      }
      this.setData({ pendingLedgerId: '', pendingLedgerName: '' });
      this.load();
      wx.navigateTo({ url: `/pages/ledger-detail/ledger-detail?ledgerId=${ledgerId}` });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '加入失败', icon: 'none' });
      this.setData({ pendingLedgerId: '' });
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/ledger-detail/ledger-detail?ledgerId=${id}` });
  }
});
