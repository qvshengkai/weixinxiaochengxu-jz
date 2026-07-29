// cloudfunctions/importBill/index.js
// 接收客户端解析好的记录数组，批量写入云数据库（校验 + 分批）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const records = (event.records || []).filter(r => r && r.amount > 0);
  if (records.length === 0) {
    return { code: 0, data: { count: 0 } };
  }

  const docs = records.map(r => ({
    _openid: OPENID,
    type: r.type === 'income' ? 'income' : 'expense',
    amount: Number(r.amount),
    categoryId: r.categoryId || 'other_exp',
    note: r.note || '',
    happenAt: Number(r.happenAt) || Date.now(),
    source: 'import',
    createdAt: Date.now()
  }));

  // 云数据库单次写入上限，分批写入
  const BATCH = 20;
  let count = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    await db.collection('records').add({ data: slice });
    count += slice.length;
  }

  return { code: 0, data: { count } };
};
