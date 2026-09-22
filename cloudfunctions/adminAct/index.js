// ===== 云函数 adminAct —— 下架/上架/删除（活动·内容） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function hasPerm(openid, perm, venueId) {
  const ur = await db.collection('users').where({ _openid: openid }).get()
  const u = ur.data[0]; const grants = (u && u.roles) || []
  if (!grants.length) return false
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  const roleMap = {}; rr.data.forEach(r => { roleMap[r.key] = r })
  for (const g of grants) {
    const role = roleMap[g.roleKey]; if (!role) continue
    const perms = role.perms || []
    const permOk = perms.indexOf('manageAll') >= 0 || perms.indexOf('manageVenue') >= 0 || perms.indexOf(perm) >= 0
    const scopeOk = role.scope === 'all' || !g.venueId || g.venueId === venueId
    if (permOk && scopeOk) return true
  }
  return false
}

const COLL = { activity: 'activities', content: 'contents' }
const HIDE = { activity: 'draft', content: 'draft' }
const SHOW = { activity: 'open', content: 'published' }

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  const { type, id, action } = event || {}
  const coll = COLL[type]
  if (!coll || !id) return { ok: false, msg: '参数有误' }
  let doc
  try { doc = (await db.collection(coll).doc(id).get()).data } catch (e) { return { ok: false, msg: '不存在' } }
  if (!doc) return { ok: false, msg: '不存在' }
  const perm = type === 'content' ? 'manageContent' : 'manageVenue'
  if (!(await hasPerm(openid, perm, doc.venueId))) return { ok: false, msg: '没有权限' }

  if (action === 'delete') { await db.collection(coll).doc(id).remove(); return { ok: true } }
  if (action === 'hide') { await db.collection(coll).doc(id).update({ data: { status: HIDE[type], updatedAt: new Date() } }); return { ok: true } }
  if (action === 'show') { await db.collection(coll).doc(id).update({ data: { status: SHOW[type], updatedAt: new Date() } }); return { ok: true } }
  return { ok: false, msg: '未知操作' }
}
