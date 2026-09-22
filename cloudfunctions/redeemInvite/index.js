// ===== 云函数 redeemInvite —— 用户输邀请码认领：成为该节点仓灵 + 发FCL编号 + 记引荐人 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function assignFclNo(userId, target) {
  if (target.fclNo) return target.fclNo
  for (let attempt = 0; attempt < 5; attempt++) {
    const maxU = await db.collection('users').where({ fclSeq: _.gt(0) }).orderBy('fclSeq', 'desc').limit(1).get()
    const seq = ((maxU.data[0] && maxU.data[0].fclSeq) || 0) + 1
    const fclNo = 'FCL-' + String(seq).padStart(6, '0')
    const dup = await db.collection('users').where({ fclSeq: seq }).count()
    if (dup.total > 0) continue
    await db.collection('users').doc(userId).update({ data: { fclNo, fclSeq: seq, fclAt: new Date() } })
    return fclNo
  }
  throw new Error('assign fcl failed')
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  let { code } = event || {}
  code = (code || '').trim().toUpperCase()
  if (!code) return { ok: false, msg: '请输入邀请码' }

  const me = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  if (!me) return { ok: false, msg: '请先进入小程序' }
  if ((me.roles || []).length) return { ok: false, msg: '你已经是成员了' }

  const vr = await db.collection('venues').where({ inviteCode: code, status: 'active' }).get()
  if (!vr.data.length) return { ok: false, msg: '邀请码无效' }
  const venue = vr.data[0]

  const roles = [{ roleKey: 'member', venueId: venue._id, referrer: venue.inviteBy || '', referredAt: new Date() }]
  await db.collection('users').doc(me._id).update({ data: { roles } })
  let fclNo = ''
  try { fclNo = await assignFclNo(me._id, me) } catch (e) {}

  return { ok: true, venueName: venue.name, fclNo }
}
