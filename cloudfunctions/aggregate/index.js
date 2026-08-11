// cloudfunctions/aggregate/index.js
// 统计聚合：按分类/收支汇总，返回分组与收支总额
// 支持个人统计（默认，按 _openid）与共享账本统计（按 ledgerId，需成员校验）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const { start, end, ledgerId } = event;
    if (!start || !end) {
      return { code: 1, message: 'missing range' };
    }

    // 共享账本统计：校验调用者是成员
    if (ledgerId) {
      const doc = await db.collection('ledgers').doc(ledgerId).get().catch(() => null);
      if (!doc || !doc.data) return { code: 1, message: '账本不存在或已解散' };
      if (!doc.data.memberOpenids.includes(OPENID)) {
        return { code: 1, message: '你不是该账本成员' };
      }
    }

    // 构建 match：个人统计按 _openid，共享统计按 ledgerId
    const matchCond = ledgerId
      ? { ledgerId, happenAt: _.gte(start).lte(end) }
      : { _openid: OPENID, happenAt: _.gte(start).lte(end) };

    const aggRes = await db.collection('records').aggregate()
      .match(matchCond)
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
