// ===== 云函数 deletePage —— 删除一个理念页（需 manageAll） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
async function canEdit(openid) {
  if (!openid) return false
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []; if (!grants.length) return false
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  return rr.data.some(r => (r.perms || []).indexOf('manageAll') >= 0)
}
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!(await canEdit(openid))) return { ok: false, msg: '仅管理员可编辑' }
  const { key } = event || {}
  if (!key) return { ok: false, msg: '缺少 key' }
  const all = (await db.collection('pages').get()).data
  if (all.length <= 1) return { ok: false, msg: '至少保留一页' }
  await db.collection('pages').where({ key }).remove()
  return { ok: true }
}