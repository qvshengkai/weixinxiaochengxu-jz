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

  onHide() {
    // 页面切走/锁屏时主动停录音，避免后台继续录
    if (this.data.recording && this.recorderManager) {
      const p = this.recorderManager.stop();
      if (p && typeof p.catch === 'function') {
        p.catch(() => { /* 切走时忽略隐私/停止错误 */ });
      }
    }
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

  // 语音记账：小程序自带录音管理器（无需任何插件）+ 云函数 ASR
  initVoice() {
    this.recorderManager = wx.getRecorderManager();
    this.recorderManager.onStop = (res) => {
      this.setData({ recording: false });
      this.handleRecordStop(res);
    };
    this.recorderManager.onError = (err) => {
      const msg = (err && (err.errMsg || err.message || '')) || '';
      this.setData({ recording: false });
      if (msg.indexOf('privacy') > -1 || msg.indexOf('隐私') > -1) {
        this.handleRecorderPrivacyError(err);
      } else {
        console.error('recorder error', err);
        wx.showToast({ title: '录音失败', icon: 'none' });
      }
    };
  },

  // 录音因"隐私协议未声明麦克风 scope"而失败时的友好兜底
  handleRecorderPrivacyError(err) {
    this.setData({ recording: false });
    console.error('recorder privacy error', err);
    wx.showModal({
      title: '录音权限未声明',
      content: '小程序隐私保护指引尚未声明「麦克风」权限。\n\n请到：微信公众平台 → 设置 → 用户隐私保护指引 → 勾选「麦克风 / 录音功能」并填写用途，重新提交审核（约 1 个工作日）。审核通过后即可使用语音记账。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 录音结束 → 上传云存储 → 调 asr 云函数识别 → 预填
  async handleRecordStop(res) {
    const tempFilePath = res.tempFilePath;
    if (!tempFilePath) {
      wx.showToast({ title: '没听清，请重试', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '识别中…' });
    try {
      const up = await wx.cloud.uploadFile({
        cloudPath: `asr/${Date.now()}.pcm`,
        filePath: tempFilePath
      });
      const r = await wx.cloud.callFunction({ name: 'asr', data: { fileID: up.fileID } });
      wx.hideLoading();
      if (r.result && r.result.success && r.result.text) {
        this.applyVoice(r.result.text);
      } else {
        wx.showToast({ title: (r.result && r.result.error) || '识别失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      console.error(e);
      wx.showToast({ title: '识别失败', icon: 'none' });
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
        content: '请在「我的 → 语音记账」打开开关后使用。',
        showCancel: false
      });
      return;
    }
    if (this.data.recording) {
      const p = this.recorderManager.stop();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => this.handleRecorderPrivacyError(err));
      }
      return;
    }
    // 录音开始时先收起所有 sheet，避免和录音遮罩互相挡
    this.setData({
      recording: true,
      voiceText: '正在聆听…',
      entryVisible: false,
      categoryPickerVisible: false
    });
    try {
      this.recorderManager.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'pcm'
      });
    } catch (err) {
      // start 同步抛错（如隐私 scope 未声明）兜底
      this.handleRecorderPrivacyError(err);
    }
  },

  stopVoice() {
    if (this.recorderManager && this.data.recording) {
      const p = this.recorderManager.stop();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => this.handleRecorderPrivacyError(err));
      }
    }
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
    // 默认"现在"——账单页需要显示真实时分。
    // 用户主动改日期时（onDateChange）才会回到 00:00（合理）。
    const now = Date.now();
    const expenseCats = this.data.allCats.filter(c => c.type === 'expense');
    const selected = expenseCats[0] || this.data.selectedCategory;
    this.setData({
      amountStr: '',
      type: 'expense',
      cats: expenseCats,
      categoryId: selected.id,
      selectedCategory: selected,
      happenAt: now,
      dateText: formatDate(now),
      dateLabel: humanLabel(now),
      note: '',
      voiceText: '',
      voiceChips: { time: '', amount: '', category: '' },
      source: 'manual',
      ...createRecordEntryState(selected.id)
    });
  }
});
