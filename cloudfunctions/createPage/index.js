// ===== 云函数 createPage —— 新建一个理念页（需 manageAll） =====
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
exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  if (!(await canEdit(openid))) return { ok: false, msg: '仅管理员可编辑' }
  const all = (await db.collection('pages').get()).data
  const maxOrder = all.reduce((m, p) => Math.max(m, p.order || 0), 0)
  const key = 'p' + Date.now()
  await db.collection('pages').add({ data: { key, navTitle: '新页面', cardTitle: '新页面', cardSub: '点这里编辑', html: '<p>在这里编辑内容。</p>', order: maxOrder + 1, updatedAt: new Date() } })
  return { ok: true, key }
}