// cloudfunctions/aggregate/index.js
// 统计聚合：按分类/收支汇总，返回分组与收支总额
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const { start, end } = event;
    if (!start || !end) {
      return { code: 1, message: 'missing range' };
    }

    const aggRes = await db.collection('records').aggregate()
      .match({
        _openid: OPENID,
        happenAt: _.gte(start).lte(end)
      })
      .group({
        _id: { category: '$categoryId', type: '$type' },
        total: $.sum('$amount'),
        count: $.sum(1)
      })
      .end();
    // 云开发 Node SDK 的 aggregate().end() 返回 { list: [...] }（个别版本为 { data: [...] }），不是裸数组
    const groups = aggRes.list || aggRes.data || [];

    let income = 0;
    let expense = 0;
    groups.forEach(g => {
      if (g._id.type === 'income') income += g.total;
      else expense += g.total;
    });

    return {
      code: 0,
      data: { groups, totals: { income, expense } }
    };
  } catch (e) {
    // 把云函数异常转成可读错误信息，避免前端拿到空 data 后静默失败
    return { code: 1, message: e.message || 'aggregate error' };
  }
};
