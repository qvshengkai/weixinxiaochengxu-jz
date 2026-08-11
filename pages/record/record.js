// pages/record/record.js
const { DEFAULT_CATEGORIES, getCategory: getDefaultCategory } = require('../../utils/categories');
const { createAiRecordPatch } = require('../../utils/ai-record-entry');
const { getComposerAction, createVoiceTextPatch } = require('../../utils/record-composer');
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
    aiText: '',
    aiLoading: false,
    composerMode: 'ai',
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
      this.getTabBar().setData({ selected: 0, hidden: false });
    }
    await this.loadCategories();
  },

  onHide() {
    // 页面切走/锁屏时主动停录音；统一走 doStopVoice，立即收起遮罩防卡死
    this.setTabBarVisible(true);
    if (this.data.recording && this.recorderManager) {
      const p = this.recorderManager.stop();
      if (p && typeof p.catch === 'function') {
        p.catch(() => { /* 切走时忽略隐私/停止错误 */ });
      }
    }
  },

  setTabBarVisible(visible) {
    const tabBar = typeof this.getTabBar === 'function' && this.getTabBar();
    if (tabBar) tabBar.setData({ hidden: !visible });
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
    this.setTabBarVisible(!next.entryVisible);
  },

  openEntry() {
    this.applyEntryAction({ type: 'OPEN_ENTRY' });
  },

  selectComposerMode(e) {
    const action = getComposerAction(e.currentTarget.dataset.mode);
    if (action.type === 'OPEN_ENTRY') {
      this.setData({ composerMode: 'manual' });
      this.openEntry();
      return;
    }
    if (action.type === 'IMPORT_BILL') {
      wx.setStorageSync('pendingBillImport', true);
      wx.switchTab({ url: '/pages/bill/bill' });
      return;
    }
    this.setData({ composerMode: action.mode });
  },

  fillComposerExample(e) {
    this.setData({ aiText: e.currentTarget.dataset.text || '', composerMode: 'ai' });
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
    this.recorderManager.onStop((res) => {
      this.setData({ recording: false });
      this.handleRecordStop(res);
    });
    this.recorderManager.onError((err) => {
      const msg = (err && (err.errMsg || err.message || '')) || '';
      this.setData({ recording: false });
      if (msg.indexOf('privacy') > -1 || msg.indexOf('隐私') > -1) {
        this.handleRecorderPrivacyError(err);
      } else {
        console.error('recorder error', err);
        wx.showToast({ title: '录音失败', icon: 'none' });
      }
    });
  },

  // 录音因"隐私协议未声明麦克风 scope"而失败时的友好兜底（带去重，避免连续弹多个）
  handleRecorderPrivacyError(err) {
    const now = Date.now();
    if (this._lastPrivacyTip && now - this._lastPrivacyTip < 3000) return;
    this._lastPrivacyTip = now;
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
      // 透传真实错误：callFunction reject（云函数未部署）时给出明确提示
      const msg = (e && e.message) || '';
      if (/fail|not exist|not found|云函数/i.test(msg)) {
        wx.showToast({ title: '语音服务未部署/不可用', icon: 'none' });
      } else {
        wx.showToast({ title: '识别失败，请重试', icon: 'none' });
      }
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

  onAiText(e) {
    this.setData({ aiText: e.detail.value });
  },

  async fillFromAi() {
    const text = this.data.aiText.trim();
    if (!text || this.data.aiLoading) return;

    this.setData({ aiLoading: true });
    try {
      const response = await wx.cloud.callFunction({
        name: 'parse-agent',
        data: { text, categories: this.data.allCats, now: Date.now() }
      });
      const result = response.result;
      if (!result || result.code !== 0) throw new Error((result && result.message) || 'AI 填充失败');

      const patch = createAiRecordPatch(result.data, this.data.allCats);
      this.setData({
        ...patch,
        cats: this.data.allCats.filter(category => category.type === patch.type),
        dateText: formatDate(patch.happenAt),
        dateLabel: humanLabel(patch.happenAt),
        aiLoading: false
      });
      this.openEntry();
      wx.showToast({ title: '已智能填充，请确认', icon: 'none' });
    } catch (error) {
      console.error('AI fill failed', error);
      this.setData({ aiLoading: false });
      // 透传真实错误：区分"云函数未部署"与"已部署但调用失败"
      const msg = (error && error.message) || 'AI 填充失败，请手动填写';
      if (/fail|not exist|not found|云函数/i.test(msg)) {
        wx.showToast({ title: 'AI 服务未部署/不可用', icon: 'none' });
      } else {
        wx.showToast({ title: msg.length > 20 ? msg.slice(0, 20) + '…' : msg, icon: 'none' });
      }
    }
  },

  // 统一的停止录音：先立即同步收起遮罩，再调用 stop。
  // 关键：无论 stop 返回 Promise 还是纯回调、无论是否抛异常，遮罩都先关掉，杜绝卡死。
  doStopVoice() {
    if (!this.recorderManager) return;
    if (this.data.recording) {
      this.setData({ recording: false });
    }
    try {
      const p = this.recorderManager.stop();
      if (p && typeof p.then === 'function') {
        p.then(() => {}).catch((err) => this.maybePrivacyError(err));
      }
    } catch (err) {
      // stop 同步抛错（如麦克风 scope 未声明）兜底：遮罩已收起，仅提示
      this.maybePrivacyError(err);
    }
  },

  // 判断是否为隐私/权限类错误并提示（容错 stop 的同步/异步两种抛错方式）
  maybePrivacyError(err) {
    const msg = (err && (err.errMsg || err.message || '')) || '';
    if (msg.indexOf('privacy') > -1 || msg.indexOf('隐私') > -1 || msg.indexOf('scope') > -1) {
      this.handleRecorderPrivacyError(err);
    } else {
      console.error('stop voice failed', err);
    }
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
    // 录音中再次点击 → 停止（底部的圆形话筒和遮罩里的话筒都会走到这里）
    if (this.data.recording) {
      this.doStopVoice();
      return;
    }
    // 录音开始时先收起所有 sheet，避免和录音遮罩互相挡
    this.setData({
      recording: true,
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
    this.doStopVoice();
  },

  // 语音识别文本 → 回填 AI 输入框（只预填，不自动识别或保存）
  applyVoice(text) {
    this.setData(createVoiceTextPatch(text));
    wx.showToast({ title: '已转成文字，请点击识别', icon: 'none' });
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
    this.setTabBarVisible(true);
  }
});
