// utils/category-service.js — 用户分类云端管理 + 个人常用排序
const { DEFAULT_CATEGORIES } = require('./categories');

const db = () => wx.cloud.database();
const cmd = () => wx.cloud.database().command;

let initPromise = null;

function generateId() {
  return 'uc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 首次将默认分类写入当前用户的云数据库，后续完全走云端
async function doEnsureUserCategories() {
  const key = 'categories_init_v1';
  if (wx.getStorageSync(key)) return;
  try {
    const countRes = await db().collection('categories').count();
    if (countRes.total > 0) {
      wx.setStorageSync(key, true);
      return;
    }
    const docs = DEFAULT_CATEGORIES.map(c => ({
      ...c,
      usageCount: 0,
      lastUsedAt: 0,
      isDefault: true,
      createdAt: Date.now()
    }));
    const BATCH = 20;
    for (let i = 0; i < docs.length; i += BATCH) {
      await db().collection('categories').add({ data: docs.slice(i, i + BATCH) });
    }
    wx.setStorageSync(key, true);
  } catch (e) {
    console.error('ensureUserCategories failed', e);
    // 初始化失败时不阻塞，页面可回退到默认分类
  }
}

function ensureUserCategories() {
  if (!initPromise) {
    initPromise = doEnsureUserCategories().finally(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

// 获取分类，按 usageCount 倒序、lastUsedAt 倒序排列（常用在前）
async function getCategories(type) {
  await ensureUserCategories();
  const where = {};
  if (type) where.type = type;
  try {
    const res = await db().collection('categories').where(where).get();
    return (res.data || []).sort((a, b) => {
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      return b.lastUsedAt - a.lastUsedAt;
    });
  } catch (e) {
    console.error('getCategories failed', e);
    return type ? DEFAULT_CATEGORIES.filter(c => c.type === type) : DEFAULT_CATEGORIES;
  }
}

async function getCategory(id) {
  try {
    const res = await db().collection('categories').where({ id }).get();
    return res.data[0] || null;
  } catch (e) {
    console.error('getCategory failed', e);
    return require('./categories').getCategory(id);
  }
}

function matchCategory(text, categories) {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const c of (categories || [])) {
    for (const k of (c.keywords || [])) {
      if (t.includes(k.toLowerCase())) return c;
    }
  }
  return null;
}

// 使用一次分类：usageCount +1，lastUsedAt 更新为当前时间
async function touchCategory(id) {
  try {
    const res = await db().collection('categories').where({ id }).get();
    const cat = res.data[0];
    if (!cat) return;
    await db().collection('categories').doc(cat._id).update({
      data: {
        usageCount: cmd().inc(1),
        lastUsedAt: Date.now()
      }
    });
  } catch (e) {
    console.error('touchCategory failed', e);
  }
}

async function addCategory({ name, emoji, type, color, ring, keywords }) {
  const kw = (keywords || '').split(/[,，]/).map(k => k.trim()).filter(Boolean);
  const doc = {
    id: generateId(),
    name: (name || '').trim(),
    emoji: emoji || '🏷️',
    type: type === 'income' ? 'income' : 'expense',
    color: color || '#8395a7',
    ring: ring || '#C7BEDD',
    keywords: kw,
    usageCount: 0,
    lastUsedAt: 0,
    isDefault: false,
    createdAt: Date.now()
  };
  await db().collection('categories').add({ data: doc });
  return doc;
}

async function deleteCategory(id) {
  try {
    const res = await db().collection('categories').where({ id }).get();
    const cat = res.data[0];
    if (!cat || cat.isDefault) return false;
    await db().collection('categories').doc(cat._id).remove();
    return true;
  } catch (e) {
    console.error('deleteCategory failed', e);
    return false;
  }
}

module.exports = {
  ensureUserCategories,
  getCategories,
  getCategory,
  matchCategory,
  touchCategory,
  addCategory,
  deleteCategory
};
