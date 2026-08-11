// cloudfunctions/ledger/index.js
// 共享账本云函数：创建/加入/退出/列表/详情/账本内记录
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const MAX_MEMBERS = 10;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const action = event.action;

  try {
    switch (action) {
      case 'create': return await createLedger(event, OPENID);
      case 'join': return await joinLedger(event, OPENID);
      case 'leave': return await leaveLedger(event, OPENID);
      case 'list': return await listLedgers(OPENID);
      case 'detail': return await ledgerDetail(event, OPENID);
      case 'myRecords': return await myRecords(event, OPENID);
      case 'memberCount': return await memberCount(event, OPENID);
      default:
        return { code: 1, message: `unknown action: ${action}` };
    }
  } catch (e) {
    console.error('[ledger]', action, e);
    return { code: 1, message: e.message || 'ledger error' };
  }
};

// 创建账本
async function createLedger(event, OPENID) {
  const name = typeof event.name === 'string' ? event.name.trim().slice(0, 20) : '';
  if (!name) return { code: 1, message: '账本名称不能为空' };

  // 每人只能在一个账本：先查是否已加入
  const existing = await db.collection('ledgers')
    .where({ memberOpenids: OPENID })
    .limit(1)
    .get();
  if (existing.data.length > 0) {
    return { code: 1, message: '你已加入账本「' + existing.data[0].name + '」，一个账号只能在一个账本' };
  }

  const res = await db.collection('ledgers').add({
    data: {
      name,
      ownerOpenid: OPENID,
      memberOpenids: [OPENID],
      createdAt: Date.now()
    }
  });
  return { code: 0, data: { _id: res._id, name, ownerOpenid: OPENID, memberOpenids: [OPENID] } };
}

// 加入账本
async function joinLedger(event, OPENID) {
  const ledgerId = typeof event.ledgerId === 'string' ? event.ledgerId : '';
  if (!ledgerId) return { code: 1, message: '缺少账本ID' };

  const doc = await db.collection('ledgers').doc(ledgerId).get().catch(() => null);
  if (!doc || !doc.data) return { code: 1, message: '账本不存在或已解散' };

  const ledger = doc.data;
  if (ledger.memberOpenids.includes(OPENID)) {
    return { code: 0, data: { alreadyMember: true, ledger } };
  }
  if (ledger.memberOpenids.length >= MAX_MEMBERS) {
    return { code: 1, message: `账本人数已满（上限 ${MAX_MEMBERS} 人）` };
  }

  // 如果用户已在其他账本，先退出那个账本
  const existing = await db.collection('ledgers')
    .where({ memberOpenids: OPENID })
    .limit(1)
    .get();
  for (const doc2 of existing.data) {
    await db.collection('ledgers').doc(doc2._id).update({
      data: { memberOpenids: _.pull(OPENID) }
    });
  }

  await db.collection('ledgers').doc(ledgerId).update({
    data: { memberOpenids: _.push([OPENID]) }
  });

  return { code: 0, data: { alreadyMember: false, ledger: { ...ledger, memberOpenids: [...ledger.memberOpenids, OPENID] } } };
}

// 退出账本
async function leaveLedger(event, OPENID) {
  const ledgerId = typeof event.ledgerId === 'string' ? event.ledgerId : '';
  if (!ledgerId) return { code: 1, message: '缺少账本ID' };

  const doc = await db.collection('ledgers').doc(ledgerId).get().catch(() => null);
  if (!doc || !doc.data) return { code: 1, message: '账本不存在或已解散' };

  const ledger = doc.data;
  if (!ledger.memberOpenids.includes(OPENID)) {
    return { code: 1, message: '你不在该账本中' };
  }

  // 创建者退出 = 解散账本（本期简化：owner 退出即解散）
  if (ledger.ownerOpenid === OPENID) {
    await db.collection('ledgers').doc(ledgerId).remove();
    return { code: 0, data: { dissolved: true } };
  }

  await db.collection('ledgers').doc(ledgerId).update({
    data: { memberOpenids: _.pull(OPENID) }
  });
  return { code: 0, data: { dissolved: false } };
}

// 我的账本列表
async function listLedgers(OPENID) {
  const res = await db.collection('ledgers')
    .where({ memberOpenids: OPENID })
    .limit(10)
    .get();
  return { code: 0, data: (res.data || []).map(l => ({
    _id: l._id,
    name: l.name,
    ownerOpenid: l.ownerOpenid,
    memberCount: (l.memberOpenids || []).length,
    createdAt: l.createdAt
  })) };
}

// 账本详情（成员校验）
async function ledgerDetail(event, OPENID) {
  const ledgerId = typeof event.ledgerId === 'string' ? event.ledgerId : '';
  if (!ledgerId) return { code: 1, message: '缺少账本ID' };

  const doc = await db.collection('ledgers').doc(ledgerId).get().catch(() => null);
  if (!doc || !doc.data) return { code: 1, message: '账本不存在或已解散' };

  const ledger = doc.data;
  if (!ledger.memberOpenids.includes(OPENID)) {
    return { code: 1, message: '你不是该账本成员' };
  }

  // 统计账本内记录条数与总支出
  const agg = await db.collection('records')
    .where({ ledgerId })
    .count();
  const expenseAgg = await db.collection('records')
    .where({ ledgerId, type: 'expense' })
    .count();

  return {
    code: 0,
    data: {
      _id: ledger._id,
      name: ledger.name,
      ownerOpenid: ledger.ownerOpenid,
      memberOpenids: ledger.memberOpenids,
      createdAt: ledger.createdAt,
      recordCount: agg.total || 0,
      expenseCount: expenseAgg.total || 0
    }
  };
}

// 账本内记录（成员共享读取，按时间倒序）
async function myRecords(event, OPENID) {
  const ledgerId = typeof event.ledgerId === 'string' ? event.ledgerId : '';
  if (!ledgerId) return { code: 1, message: '缺少账本ID' };

  const doc = await db.collection('ledgers').doc(ledgerId).get().catch(() => null);
  if (!doc || !doc.data) return { code: 1, message: '账本不存在或已解散' };
  if (!doc.data.memberOpenids.includes(OPENID)) return { code: 1, message: '你不是该账本成员' };

  const limit = Math.min(Number(event.limit) || 50, 100);
  const res = await db.collection('records')
    .where({ ledgerId })
    .orderBy('happenAt', 'desc')
    .limit(limit)
    .get();

  return { code: 0, data: res.data || [] };
}

// 成员数（供邀请页显示）
async function memberCount(event, OPENID) {
  const ledgerId = typeof event.ledgerId === 'string' ? event.ledgerId : '';
  if (!ledgerId) return { code: 1, message: '缺少账本ID' };
  const doc = await db.collection('ledgers').doc(ledgerId).get().catch(() => null);
  if (!doc || !doc.data) return { code: 1, message: '账本不存在' };
  return { code: 0, data: { count: (doc.data.memberOpenids || []).length } };
}
