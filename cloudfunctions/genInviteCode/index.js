// ===== 云函数 genInviteCode —— 为节点生成/重置邀请码（玄灵/止灵任意，亓灵限自己节点） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
// 去掉易混字符(0/O/1/I/L)的码池
const POOL = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
function randCode() {
  let s = ''
  for (let i = 0; i < 6; i++) s += POOL[Math.floor(Math.random() * POOL.length)]
  return s.slice(0, 3) + '-' + s.slice(3) // 形如 ABC-DEF
}
async function whoami(openid) {
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  let perms = {}
  if (keys.length) { const rr = await db.collection('roles').where({ key: _.in(keys) }).get(); rr.data.forEach(r => (r.perms || []).forEach(p => { perms[p] = true })) }
  return { keys, perms, grants }
}
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  const { venueId } = event || {}
  if (!venueId) return { ok: false, msg: '缺少节点' }
  const me = await whoami(openid)
  const isManagerUp = me.perms.manageAll
  const isStewardHere = me.grants.some(g => g.roleKey === 'steward' && g.venueId === venueId)
  if (!isManagerUp && !isStewardHere) return { ok: false, msg: '只能管理你负责节点的邀请码' }

  // 生成唯一码（撞库重试）
  let code = '', tries = 0
  while (tries < 10) {
    code = randCode()
    const dup = await db.collection('venues').where({ inviteCode: code }).count()
    if (dup.total === 0) break
    tries++
  }
  await db.collection('venues').doc(venueId).update({ data: { inviteCode: code, inviteBy: openid, inviteAt: new Date() } })
  return { ok: true, code }
}