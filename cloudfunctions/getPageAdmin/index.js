// ===== 云函数 getPageAdmin —— 后台读全部理念页（html原文，需 manageAll） =====
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
  return rr.data.some(r => (r.perms || []).indexOf('manageAll') >= 0 || (r.perms || []).indexOf('viewAll') >= 0)
}
exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  if (!(await canEdit(openid))) return { ok: false, msg: '仅管理员可编辑' }
  const r = await db.collection('pages').get()
  const list = r.data.slice().sort((a, b) => (a.order || 999) - (b.order || 999))
    .map(p => ({ key: p.key, navTitle: p.navTitle || '', cardTitle: p.cardTitle || '', cardSub: p.cardSub || '', html: p.html || '', order: p.order || 0 }))
  return { ok: true, list }
}