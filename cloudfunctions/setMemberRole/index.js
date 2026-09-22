// ===== 云函数 setMemberRole —— 分级授权设称号 =====
// 玄灵(chief)：可设 少灵/仓灵/亓灵/止灵/玄灵/襾灵（最高）
// 止灵(manager)：可设 少灵/仓灵/亓灵（含任命亓灵绑节点）；不能设止灵/玄灵/襾灵
// 亓灵(steward)：只能给"自己负责的节点"设/收 仓灵，并记录引荐人
// 玄灵/襾灵 称号受保护：非玄灵不可改动
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function whoami(openid) {
  if (!openid) return { keys: [], perms: {}, grants: [] }
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  let perms = {}
  if (keys.length) { const rr = await db.collection('roles').where({ key: _.in(keys) }).get(); rr.data.forEach(r => (r.perms || []).forEach(p => { perms[p] = true })) }
  return { keys, perms, grants }
}

// —— 发号：从 users 表查当前最大 fclSeq +1，不依赖额外集合，撞号重试 ——
async function assignFclNo(userId, target) {
  if (target.fclNo) return target.fclNo
  for (let attempt = 0; attempt < 5; attempt++) {
    const maxU = await db.collection('users').where({ fclSeq: _.gt(0) }).orderBy('fclSeq', 'desc').limit(1).get()
    const seq = ((maxU.data[0] && maxU.data[0].fclSeq) || 0) + 1
    const fclNo = 'FCL-' + String(seq).padStart(6, '0')
    // 撞号检查：该号是否已被别人占用
    const dup = await db.collection('users').where({ fclSeq: seq }).count()
    if (dup.total > 0) continue // 撞了，重试取更大的号
    await db.collection('users').doc(userId).update({ data: { fclNo, fclSeq: seq, fclAt: new Date() } })
    return fclNo
  }
  throw new Error('assign fcl failed')
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  const me = await whoami(openid)
  const isChief = me.keys.indexOf('chief') >= 0
  const isManager = me.keys.indexOf('manager') >= 0
  const isSteward = me.keys.indexOf('steward') >= 0
  let { targetOpenid, roleKey, venueId } = event || {}
  roleKey = roleKey || ''
  if (!targetOpenid) return { ok: false, msg: '缺少成员' }

  let allowed
  if (isChief) allowed = ['', 'member', 'steward', 'manager', 'chief', 'elder']
  else if (isManager) allowed = ['', 'member', 'steward']
  else if (isSteward) allowed = ['', 'member']
  else return { ok: false, msg: '没有成员管理权限' }
  if (allowed.indexOf(roleKey) < 0) return { ok: false, msg: '你无权设置该称号' }

  if (isSteward && !isManager && !isChief) {
    const myVenueIds = me.grants.filter(g => g.roleKey === 'steward').map(g => g.venueId).filter(Boolean)
    if (roleKey === 'member' && (!venueId || myVenueIds.indexOf(venueId) < 0)) return { ok: false, msg: '只能管理你负责的节点' }
  }

  if (roleKey === 'steward' && !venueId) return { ok: false, msg: '亓灵需指定负责的节点' }

  const tr = await db.collection('users').where({ _openid: targetOpenid }).get()
  const target = tr.data[0]
  if (!target) return { ok: false, msg: '成员不存在' }
  const cur = (target.roles || []).map(g => g.roleKey)
  if ((cur.indexOf('chief') >= 0 || cur.indexOf('elder') >= 0) && !isChief) return { ok: false, msg: '玄灵 / 襾灵 称号受保护' }

  let roles
  if (!roleKey) roles = []
  else if (roleKey === 'steward') roles = [{ roleKey: 'steward', venueId: venueId }]
  else if (roleKey === 'member') roles = [{ roleKey: 'member', venueId: venueId || '', referrer: openid, referredAt: new Date() }]
  else roles = [{ roleKey, venueId: '' }]

  await db.collection('users').doc(target._id).update({ data: { roles } })
  // 首次获得任何身份（仓灵及以上）→ 自动发风吹岭旅人编号
  let fclNo = ''
  if (roleKey && !target.fclNo) {
    try { fclNo = await assignFclNo(target._id, target) } catch (e) { fclNo = 'ERR:' + (e && e.message || e) }
  }
  return { ok: true, fclNo }
}
