// pages/bill/bill.js
const { DEFAULT_CATEGORIES, getCategory: getDefaultCategory } = require('../../utils/categories');
const { parse } = require('../../utils/bill-parser');
const categoryService = require('../../utils/category-service');

const db = () => wx.cloud.database();
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const SOURCE_LABEL = { manual: '手动', voice: '语音', import: '导入' };

function dayHead(ts) {
  const d = new Date(ts);
  return { day: `${d.getMonth() + 1}月${d.getDate()}日`, week: WEEK[d.getDay()] };
}

Page({
  data: {
    statusBarH: 20,
    groups: [],
    filters: [{ id: 'all', name: '全部' }].concat(DEFAULT_CATEGORIES.filter(c => c.type === 'expense').map(c => ({ id: c.id, name: c.name }))),
    activeFilter: 'all',
    searchKey: '',
    searching: false,
    manageMode: false,
    selectedIds: [],
    allCats: DEFAULT_CATEGORIES,
    // 编辑弹窗状态
    editVisible: false,
    editId: '',
    editType: 'expense',
    editAmount: '',
    editNote: '',
    editCatId: '',
    editCats: DEFAULT_CATEGORIES.filter(c => c.type === 'expense'),
    ledgerList: [],
    activeLedgerId: '',
    activeLedgerName: '',
    viewOnly: false
  },

  async onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarH: info.statusBarHeight || 20 });
    await this.loadCategories();
  },

  async loadCategories() {
    const allCats = await categoryService.getCategories();
    const expenseCats = allCats.filter(c => c.type === 'expense');
    this.setData({
      allCats,
      filters: [{ id: 'all', name: '全部' }].concat(expenseCats.map(c => ({ id: c.id, name: c.name })))
    });
  },

  // 加载共享账本列表（切换查看范围）
  async loadLedgerInfo() {
    let ledgerList = [];
    try {
      const { call } = require('../../utils/cloud');
      ledgerList = await call('ledger', { action: 'list' }) || [];
    } catch (e) {
      console.error('load ledger info failed', e);
    }
    const storageLedgerId = wx.getStorageSync('activeLedgerId') || '';
    const active = ledgerList.find(l => l._id === storageLedgerId) || null;
    this.setData({
      ledgerList,
      activeLedgerId: active ? active._id : '',
      activeLedgerName: active ? active.name : ''
    });
  },

  // 切换查看范围
  selectLedger(e) {
    const id = e.currentTarget.dataset.id || '';
    const ledger = this.data.ledgerList.find(l => l._id === id) || null;
    wx.setStorageSync('activeLedgerId', id);
    this.setData({
      activeLedgerId: id,
      activeLedgerName: ledger ? ledger.name : ''
    });
    this.load();
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    await this.loadCategories();
    await this.loadLedgerInfo();
    this.load();
    if (wx.getStorageSync('pendingBillImport')) {
      wx.removeStorageSync('pendingBillImport');
      wx.nextTick(() => this.onImport());
    }
  },

  onPullDownRefresh() { this.load(() => wx.stopPullDownRefresh()); },

  async load(done) {
    try {
      let raw = [];
      const ledgerId = this.data.activeLedgerId;
      if (ledgerId) {
        // 共享账本：走云函数读全体成员记录（仅查看，不可编辑删除）
        const { call } = require('../../utils/cloud');
        raw = (await call('ledger', { action: 'myRecords', ledgerId, limit: 100 })) || [];
        this.setData({ viewOnly: true });
      } else {
        // 个人账单：只显示个人账（ledgerId 为空/缺失），不混入共享账本数据
        const cmd = db().command;
        const res = await db().collection('records')
          .where(cmd.or([{ ledgerId: '' }, { ledgerId: cmd.exists(false) }]))
          .orderBy('happenAt', 'desc')
          .limit(100)
          .get();
        raw = res.data;
        this.setData({ viewOnly: false });
      }
      this.all = raw.map(r => {
        const c = this.data.allCats.find(x => x.id === r.categoryId) || getDefaultCategory(r.categoryId);
        const amt = parseFloat(r.amount);
        return {
          _id: r._id,
          categoryId: r.categoryId,
          emoji: c ? c.emoji : '💸',
          ring: c ? c.ring : '#C7BEDD',
          name: c ? c.name : (r.categoryName || '其他'),
          note: r.note,
          happenAt: r.happenAt,
          time: this.hm(r.happenAt),
          source: SOURCE_LABEL[r.source] || '手动',
          amount: (r.type === 'income' ? '+' : '-') + amt.toFixed(2),
          isIncome: r.type === 'income',
          amtValue: amt
        };
      });
      this.applyFilter();
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      if (done) done();
    }
  },

  hm(ts) {
    const d = new Date(ts);
    const p = n => (n < 10 ? '0' + n : '' + n);
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  },

  applyFilter() {
    const { activeFilter, searchKey } = this.data;
    let list = this.all || [];
    if (activeFilter !== 'all') list = list.filter(x => x.categoryId === activeFilter);
    if (searchKey) {
      const k = searchKey.toLowerCase();
      list = list.filter(x => (x.note && x.note.toLowerCase().includes(k)) || x.name.toLowerCase().includes(k));
    }
    // 按天分组
    const map = {};
    list.forEach(x => {
      const key = new Date(x.happenAt).toDateString();
      if (!map[key]) map[key] = { ts: x.happenAt, rows: [], exp: 0, inc: 0 };
      map[key].rows.push(x);
      if (x.isIncome) map[key].inc += x.amtValue; else map[key].exp += x.amtValue;
    });
    const groups = Object.keys(map).sort((a, b) => map[b].ts - map[a].ts).map(k => {
      const g = map[k];
      const head = dayHead(g.ts);
      const summary = g.inc > 0 ? `收入 ¥${g.inc.toFixed(0)}` : `支出 ¥${g.exp.toFixed(0)}`;
      return { day: head.day, week: head.week, summary, rows: g.rows };
    });
    this.setData({ groups });
  },

  onFilter(e) {
    this.setData({ activeFilter: e.currentTarget.dataset.id }, () => this.applyFilter());
  },

  toggleSearch() {
    const searching = !this.data.searching;
    this.setData({ searching, searchKey: searching ? this.data.searchKey : '' }, () => this.applyFilter());
  },

  onSearchInput(e) {
    this.setData({ searchKey: e.detail.value }, () => this.applyFilter());
  },

  toggleManage() {
    const manageMode = !this.data.manageMode;
    this.setData({ manageMode, selectedIds: manageMode ? this.data.selectedIds : [] });
  },

  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const sel = this.data.selectedIds.slice();
    const i = sel.indexOf(id);
    if (i >= 0) sel.splice(i, 1); else sel.push(id);
    this.setData({ selectedIds: sel });
  },

  onRowTap(e) {
    if (this.data.manageMode) this.toggleSelect(e);
  },

  batchDelete() {
    const ids = this.data.selectedIds;
    if (ids.length === 0) return;
    wx.showModal({
      title: `删除 ${ids.length} 条记录`,
      content: '删除后不可恢复，确定？',
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '删除中' });
        try {
          await Promise.all(ids.map(id => db().collection('records').doc(id).remove()));
          wx.hideLoading();
          this.setData({ manageMode: false, selectedIds: [] });
          this.load();
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  // 打开编辑弹窗，预填当前记录
  openEdit(e) {
    const id = e.currentTarget.dataset.id;
    const rec = (this.all || []).find(x => x._id === id);
    if (!rec) return;
    const type = rec.isIncome ? 'income' : 'expense';
    const editCats = this.data.allCats.filter(c => c.type === type);
    this.setData({
      editVisible: true,
      editId: id,
      editType: type,
      editAmount: rec.amtValue.toFixed(2),
      editNote: rec.note || '',
      editCatId: rec.categoryId,
      editCats
    });
  },

  // 切换 支出/收入
  onEditType(e) {
    const t = e.currentTarget.dataset.type;
    const cats = this.data.allCats.filter(c => c.type === t);
    const cur = this.data.allCats.find(c => c.id === this.data.editCatId) || getDefaultCategory(this.data.editCatId);
    const keep = cur && cur.type === t ? this.data.editCatId : '';
    this.setData({ editType: t, editCats: cats, editCatId: keep });
  },

  onPickEditCat(e) {
    this.setData({ editCatId: e.currentTarget.dataset.id });
  },

  onEditAmount(e) {
    this.setData({ editAmount: e.detail.value });
  },

  onEditNote(e) {
    this.setData({ editNote: e.detail.value });
  },

  stopTap() {},

  closeEdit() {
    this.setData({ editVisible: false });
  },

  // 保存修改：金额 / 备注 / 类型（收支方向 + 分类）
  saveEdit() {
    const amt = parseFloat(this.data.editAmount);
    if (!amt || amt <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }
    if (!this.data.editCatId) {
      wx.showToast({ title: '请选择分类', icon: 'none' });
      return;
    }
    const cat = this.data.allCats.find(c => c.id === this.data.editCatId) || getDefaultCategory(this.data.editCatId);
    wx.showLoading({ title: '保存中' });
    db().collection('records').doc(this.data.editId).update({
      data: {
        amount: amt,
        note: this.data.editNote,
        type: this.data.editType,
        categoryId: cat.id,
        categoryName: cat.name
      }
    }).then(() => {
      wx.hideLoading();
      this.setData({ editVisible: false });
      this.load();
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除该记录',
      content: '删除后不可恢复，确定？',
      success: (r) => {
        if (r.confirm) {
          db().collection('records').doc(id).remove()
            .then(() => this.load())
            .catch(() => wx.showToast({ title: '删除失败', icon: 'none' }));
        }
      }
    });
  },

  // 导入微信支付账单 CSV（解析在本地，批量写入在云函数 importBill）
  onImport() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv', 'txt'],
      success: (res) => {
        const file = res.tempFiles[0];
        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath: file.path,
          encoding: 'utf-8',
          success: (rf) => {
            const { records, skipped } = parse(rf.data, this.data.allCats);
            if (records.length === 0) {
              wx.showToast({ title: '未解析到记录', icon: 'none' });
              return;
            }
            wx.showLoading({ title: '导入中' });
            wx.cloud.callFunction({
              name: 'importBill',
              data: { records }
            }).then(r => {
              wx.hideLoading();
              const d = r.result || {};
              wx.showToast({ title: `导入 ${d.count || 0} 条`, icon: 'none' });
              this.load();
            }).catch(err => {
              wx.hideLoading();
              wx.showToast({ title: '导入失败', icon: 'none' });
              console.error(err);
            });
          },
          fail: () => wx.showToast({ title: '读取失败', icon: 'none' })
        });
      },
      fail: () => {}
    });
  }
});
