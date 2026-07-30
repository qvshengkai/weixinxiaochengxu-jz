// utils/category-service.js — 用户分类云端管理 + 个人常用排序
const { DEFAULT_CATEGORIES } = require('./categories');

const db = () => wx.cloud.database();
const cmd = () => wx.cloud.database().command;

let initPromise = null;

function generateId() {
  return 'uc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 检查集合不存在/权限等错误，用于降级判断
function isMissingCollectionError(e) {
  const msg = String(e && e.message || e);
  return msg.includes('collection not exists') ||
         msg.includes('Db or Table not exist') ||
         msg.includes('-502005');
}

// 确保默认分类齐全：按 id 去重、逐条补写。
// 关键修复：云开发客户端 add 不支持传数组，旧逻辑 add([...]) 导致默认分类从未写入云端，
// 一旦用户添加任意分类使 count>0，便再也不补默认分类。现改为每次启动检查缺失项并补写，
// 不影响用户自定义分类（自定义 id 为 uc_ 前缀，不会与默认 id 冲突）。
async function doEnsureUserCategories() {
  try {
    const ids = DEFAULT_CATEGORIES.map(c => c.id);
    const res = await db().collection('categories').where({ id: cmd().in(ids) }).get();
    const existIds = new Set((res.data || []).map(d => d.id));
    for (const c of DEFAULT_CATEGORIES) {
      if (existIds.has(c.id)) continue;
      await db().collection('categories').add({
        data: {
          ...c,
          usageCount: 0,
          lastUsedAt: 0,
          isDefault: true,
          createdAt: Date.now()
        }
      });
    }
  } catch (e) {
    console.error('ensureUserCategories failed', e);
    // 集合不存在/权限不足时静默，页面走本地兜底
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
  try {
    await ensureUserCategories();
  } catch (e) {
    console.error('ensureUserCategories failed', e);
  }
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
  try {
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
    return { success: true, data: doc };
  } catch (e) {
    console.error('addCategory failed', e);
    const isMissing = isMissingCollectionError(e);
    return {
      success: false,
      error: isMissing
        ? '云数据库 categories 集合不存在，请先创建集合并设置权限'
        : '添加分类失败，请重试',
      detail: e
    };
  }
}

async function deleteCategory(id) {
  try {
    const res = await db().collection('categories').where({ id }).get();
    const cat = res.data[0];
    if (!cat || cat.isDefault) return { success: false, error: '默认分类不能删除' };
    await db().collection('categories').doc(cat._id).remove();
    return { success: true };
  } catch (e) {
    console.error('deleteCategory failed', e);
    const isMissing = isMissingCollectionError(e);
    return {
      success: false,
      error: isMissing ? '云数据库 categories 集合不存在' : '删除失败，请重试'
    };
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
