// pages/record/record.js
const { DEFAULT_CATEGORIES, getCategory: getDefaultCategory } = require('../../utils/categories');
const { parseVoice } = require('../../utils/voice-parser');
const { startOfDay, formatDate } = require('../../utils/date');
const { createRecordEntryState, transitionRecordEntry } = require('../../utils/record-entry-state');
const categoryService = require('../../utils/category-service');

const db = () => wx.cloud.database();

// 人类可读日期：今天 / 昨天 / M月D日
function humanLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (d.toDateString() === now.toDateString()) return `今天 · ${md}`;
  if (d.toDateString() === y.toDateString()) return `昨天 · ${md}`;
  return md;
}

Page({
  data: {
    statusBarH: 20,
    amountStr: '',
    type: 'expense',
    cats: DEFAULT_CATEGORIES.filter(c => c.type === 'expense'),
    categoryId: DEFAULT_CATEGORIES.find(c => c.type === 'expense').id,
    selectedCategory: DEFAULT_CATEGORIES.find(c => c.type === 'expense'),
    allCats: DEFAULT_CATEGORIES,
    happenAt: startOfDay(new Date()).getTime(),
    dateText: '',
    dateLabel: '',
    note: '',
    recording: false,
    voiceText: '',
    voiceChips: { time: '', amount: '', category: '' },
    source: 'manual',
    dateVisible: false,
    ...createRecordEntryState(DEFAULT_CATEGORIES.find(c => c.type === 'expense').id)
  },

  async onLoad(options) {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const ts = startOfDay(new Date()).getTime();
    this.setData({
      statusBarH: info.statusBarHeight || 20,
      dateText: formatDate(ts),
      dateLabel: humanLabel(ts)
    });
    if (options && options.amount) {
      this.setData({ amountStr: String(options.amount) });
    }
    await this.loadCategories();
    this.initVoice();
  },

  async loadCategories() {
    const [expenseCats, allCats] = await Promise.all([
      categoryService.getCategories('expense'),
      categoryService.getCategories()
    ]);
    const currentId = this.data.categoryId;
    const stillValid = allCats.some(c => c.id === currentId);
    const selected = stillValid
      ? (allCats.find(c => c.id === currentId) || expenseCats[0])
      : expenseCats[0];
    this.setData({
      cats: this.data.type === 'income'
        ? allCats.filter(c => c.type === 'income')
        : expenseCats,
      allCats,
      categoryId: selected.id,
      selectedCategory: selected
    });
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    await this.loadCategories();
  },

  applyEntryAction(action) {
    const next = transitionRecordEntry({
      entryVisible: this.data.entryVisible,
      categoryPickerVisible: this.data.categoryPickerVisible,
      categoryId: this.data.categoryId
    }, action);
    const selected = this.data.allCats.find(c => c.id === next.categoryId) ||
                     getDefaultCategory(next.categoryId) ||
                     this.data.allCats[0];
    this.setData({
      ...next,
      selectedCategory: selected
    });
  },

  openEntry() {
    this.applyEntryAction({ type: 'OPEN_ENTRY' });
  },

  closeEntry() {
    this.applyEntryAction({ type: 'CLOSE_ENTRY' });
  },

  openCategoryPicker() {
    this.applyEntryAction({ type: 'OPEN_CATEGORY_PICKER' });
  },

  closeCategoryPicker() {
    this.applyEntryAction({ type: 'CLOSE_CATEGORY_PICKER' });
  },

  // 微信同声传译插件（需在公众平台添加插件后才可用）
  initVoice() {
    try {
      const plugin = requirePlugin('WechatSI');
      this.manager = plugin.getRecordRecognitionManager();
      this.manager.onRecognize = (res) => {
        const t = (res && res.result) || '';
        if (t) this.setData({ voiceText: t });
      };
      this.manager.onStop = (res) => {
        this.setData({ recording: false });
        const text = (res && res.result) || '';
        if (!text) {
          wx.showToast({ title: '没听清，请重试', icon: 'none' });
          return;
        }
        this.applyVoice(text);
      };
      this.manager.onError = (err) => {
        this.setData({ recording: false });
        console.error('voice error', err);
        wx.showToast({ title: '识别失败', icon: 'none' });
      };
    } catch (e) {
      this.manager = null; // 未添加插件时降级
    }
  },

  async toggleType(e) {
    const type = e.currentTarget.dataset.type;
    const cats = await categoryService.getCategories(type);
    const selected = cats[0];
    this.setData({ type, cats, categoryId: selected.id, selectedCategory: selected });
  },

  selectCat(e) {
    const id = e.currentTarget.dataset.id;
    if (id === '__add_category__') {
      wx.navigateTo({ url: '/pages/category-manage/category-manage' });
      return;
    }
    this.applyEntryAction({ type: 'SELECT_CATEGORY', categoryId: id });
    categoryService.touchCategory(id);
  },

  onDateChange(e) {
    const ts = new Date(e.detail.value.replace(/-/g, '/')).getTime();
    this.setData({ happenAt: ts, dateText: e.detail.value, dateLabel: humanLabel(ts), dateVisible: false });
  },

  onDateCancel() {
    this.setData({ dateVisible: false });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  startVoice() {
    if (wx.getStorageSync('voicePluginOn') === false) {
      wx.showModal({
        title: '语音未开启',
        content: '请在「我的 → 语音记账插件」打开开关后使用。',
        showCancel: false
      });
      return;
    }
    if (!this.manager) {
      wx.showModal({
        title: '未启用语音',
        content: '请先在「微信公众平台 → 设置 → 第三方设置 → 插件管理」中添加「微信同声传译」插件。',
        showCancel: false
      });
      return;
    }
    if (this.data.recording) {
      this.manager.stop();
    } else {
      this.setData({ recording: true, voiceText: '正在聆听…' });
      this.manager.start({ duration: 60000, lang: 'zh_CN' });
    }
  },

  stopVoice() {
    if (this.manager && this.data.recording) this.manager.stop();
  },

  // 语音识别文本 → 预填（只预填，不自动存）
  applyVoice(text) {
    const p = parseVoice(text, this.data.allCats);
    const cat = this.data.allCats.find(c => c.id === p.categoryId) ||
                getDefaultCategory(p.categoryId);
    this.setData({
      voiceText: text,
      amountStr: p.amount ? String(p.amount) : '',
      type: p.type,
      cats: (p.type === 'income'
        ? this.data.allCats.filter(c => c.type === 'income')
        : this.data.allCats.filter(c => c.type === 'expense')),
      categoryId: p.categoryId,
      selectedCategory: cat,
      happenAt: p.happenAt,
      dateText: formatDate(p.happenAt),
      dateLabel: humanLabel(p.happenAt),
      note: p.note || '',
      source: 'voice',
      entryVisible: true,
      categoryPickerVisible: false,
      voiceChips: {
        time: humanLabel(p.happenAt),
        amount: p.amount ? String(p.amount) : '',
        category: cat ? cat.name : ''
      }
    });
    wx.showToast({ title: '已智能填充，请确认', icon: 'none' });
  },

  clearVoice() {
    this.setData({ voiceText: '', voiceChips: { time: '', amount: '', category: '' }, source: 'manual' });
  },

  onKey(e) {
    const k = e.detail.key;

    let s = this.data.amountStr;
    if (k === 'del') {
      s = s.slice(0, -1);
    } else if (k === '.') {
      if (s.indexOf('.') === -1 && s.length > 0) s += '.';
    } else {
      if (s.indexOf('.') > -1 && s.split('.')[1].length >= 2) return; // 两位小数
      if (s === '0') s = k; else s += k;
      if (s.replace('.', '').length > 9) return; // 金额上限
    }
    this.setData({ amountStr: s });
  },

  save() {
    const amount = parseFloat(this.data.amountStr);
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入金额', icon: 'none' });
      return;
    }
    const cat = this.data.selectedCategory;
    wx.showLoading({ title: '保存中' });
    db().collection('records').add({
      data: {
        type: this.data.type,
        amount: amount,
        categoryId: this.data.categoryId,
        categoryName: cat ? cat.name : '',
        happenAt: this.data.happenAt,
        note: this.data.note,
        source: this.data.source || 'manual',
        createdAt: Date.now()
      }
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '已记录' });
      categoryService.touchCategory(this.data.categoryId);
      this.reset();
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
      console.error(err);
    });
  },

  reset() {
    const today = startOfDay(new Date()).getTime();
    const expenseCats = this.data.allCats.filter(c => c.type === 'expense');
    const selected = expenseCats[0] || this.data.selectedCategory;
    this.setData({
      amountStr: '',
      type: 'expense',
      cats: expenseCats,
      categoryId: selected.id,
      selectedCategory: selected,
      happenAt: today,
      dateText: formatDate(today),
      dateLabel: humanLabel(today),
      note: '',
      voiceText: '',
      voiceChips: { time: '', amount: '', category: '' },
      source: 'manual',
      ...createRecordEntryState(selected.id)
    });
  }
});
