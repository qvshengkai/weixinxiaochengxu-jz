// utils/categories.js — 默认分类字典（首次使用时通过 category-service 写入用户云数据库）
// ring 为界面设计稿中分类圆圈的描边色，selected 时使用紫粉渐变覆盖
const DEFAULT_CATEGORIES = [
  { id: 'food', name: '餐饮', emoji: '🍜', color: '#ff9f43', ring: '#E8B95D', type: 'expense', keywords: ['吃', '饭', '餐', '外卖', '麦当劳', '肯德基', '星巴克', '奶茶', '咖啡', '火锅', '食堂', '早餐', '午餐', '晚餐', '宵夜'] },
  { id: 'transport', name: '交通', emoji: '🚇', color: '#54a0ff', ring: '#8FB7EA', type: 'expense', keywords: ['地铁', '公交', '打车', '滴滴', '高铁', '火车', '机票', '加油', '停车', '骑车'] },
  { id: 'shopping', name: '购物', emoji: '🛍️', color: '#5f27cd', ring: '#B79CEA', type: 'expense', keywords: ['买', '淘宝', '京东', '拼多多', '衣服', '鞋', '包', '化妆品', '数码', '日用品'] },
  { id: 'snacks', name: '零食', emoji: '🍿', color: '#ff9f43', ring: '#E8B95D', type: 'expense', keywords: ['零食', '薯片', '巧克力', '奶茶', '饮料', '冰淇淋', '饼干', '坚果', '辣条', '糖果'] },
  { id: 'home', name: '居家', emoji: '🏠', color: '#00d2d3', ring: '#7ED9C4', type: 'expense', keywords: ['房租', '物业', '水电', '燃气', '网费', '家居'] },
  { id: 'fun', name: '娱乐', emoji: '🎮', color: '#ee5253', ring: '#F0A868', type: 'expense', keywords: ['电影', '游戏', '演唱会', 'ktv', '旅游', '门票', '健身'] },
  { id: 'beauty', name: '美妆', emoji: '💄', color: '#E4789F', ring: '#E4789F', type: 'expense', keywords: ['美妆', '化妆', '口红', '护肤', '面膜', '香水'] },
  { id: 'medical', name: '医疗', emoji: '💊', color: '#10ac84', ring: '#C7BEDD', type: 'expense', keywords: ['药', '医院', '门诊', '体检', '看病', '牙'] },
  { id: 'study', name: '学习', emoji: '📚', color: '#576574', ring: '#6FC2B4', type: 'expense', keywords: ['书', '课程', '培训', '网课', '文具'] },
  { id: 'social', name: '人情', emoji: '🎁', color: '#f368e0', ring: '#C7BEDD', type: 'expense', keywords: ['红包', '礼物', '份子', '请客', '聚会'] },
  { id: 'other_exp', name: '其他支出', emoji: '💸', color: '#8395a7', ring: '#C7BEDD', type: 'expense', keywords: [] },
  { id: 'salary', name: '工资', emoji: '💰', color: '#07c160', ring: '#B79CEA', type: 'income', keywords: ['工资', '薪水', '月薪', '发工资'] },
  { id: 'bonus', name: '奖金', emoji: '🧧', color: '#07c160', ring: '#B79CEA', type: 'income', keywords: ['奖金', '年终', '绩效', '提成'] },
  { id: 'refund', name: '退款', emoji: '↩️', color: '#07c160', ring: '#B79CEA', type: 'income', keywords: ['退款', '退回', '退'] },
  { id: 'other_inc', name: '其他收入', emoji: '✨', color: '#07c160', ring: '#B79CEA', type: 'income', keywords: [] }
];

const INCOME_CATS = DEFAULT_CATEGORIES.filter(c => c.type === 'income');
const EXPENSE_CATS = DEFAULT_CATEGORIES.filter(c => c.type === 'expense');

// 根据文本匹配分类（用于语音/导入）
// list 可由 category-service.getCategories() 提供，未提供则回退到默认分类。
// 评分：自定义分类优先；命中的关键词越长越具体得分越高，避免"奶茶"被默认餐饮抢走。
function matchCategory(text, list) {
  if (!text) return null;
  const source = list || DEFAULT_CATEGORIES;
  const t = text.toLowerCase();
  let best = null, bestScore = -1;
  for (const c of source) {
    for (const k of (c.keywords || [])) {
      const kl = k.toLowerCase();
      if (t.includes(kl)) {
        const isCustom = c.id && c.id.indexOf('uc_') === 0;
        const score = (isCustom ? 1000 : 0) + kl.length;
        if (score > bestScore) { bestScore = score; best = c; }
      }
    }
  }
  return best;
}

// 按 id 取分类
// list 可由 category-service.getCategories() 提供，未提供则回退到默认分类
function getCategory(id, list) {
  const source = list || DEFAULT_CATEGORIES;
  return source.find(c => c.id === id) || null;
}

module.exports = { DEFAULT_CATEGORIES, CATEGORIES: DEFAULT_CATEGORIES, INCOME_CATS, EXPENSE_CATS, matchCategory, getCategory };
