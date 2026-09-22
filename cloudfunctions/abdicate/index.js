// ===== 云函数 abdicate —— 玄灵自助退位转襾灵 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  if (!u) return { ok: false, msg: '未找到成员' }
  const keys = (u.roles || []).map(g => g.roleKey)
  if (keys.indexOf('chief') < 0) return { ok: false, msg: '只有玄灵可以退位' }
  // 至少保留一位玄灵：若全网只有这一个玄灵，禁止退位（避免无人管理）
  const others = (await db.collection('users').where({ roles: db.command.elemMatch({ roleKey: 'chief' }) }).get()).data.filter(x => x._openid !== openid)
  if (!others.length) return { ok: false, msg: '你是唯一的玄灵，请先任命一位新玄灵再退位' }
  await db.collection('users').doc(u._id).update({ data: { roles: [{ roleKey: 'elder', venueId: '' }] } })
  return { ok: true }
}