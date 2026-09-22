// ===== 云函数 adminList —— 管理员看某节点下全部内容（含草稿），动态分类标签 =====
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
    const permOk = perms.indexOf('manageAll') >= 0 || perms.indexOf('manageVenue') >= 0 || perms.indexOf('manageContent') >= 0 || perms.indexOf('viewAll') >= 0
    const scopeOk = role.scope === 'all' || !g.venueId || g.venueId === venueId
    if (permOk && scopeOk) return true
  }
  return false
}
async function lbl(kind) { const r = await db.collection('categories').where({ kind, status: 'approved' }).get(); const m = {}; r.data.forEach(c => { m[c.key] = c.name }); return m }
const STAT = { draft: '草稿', published: '已发布' }

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  const { venueId } = event || {}
  if (!venueId) return { ok: false, msg: '请选节点' }
  if (!(await hasPerm(openid, 'manageContent', venueId))) return { ok: false, msg: '没有该节点的管理权限' }
  const TYPE = await lbl('content')
  const co = await db.collection('contents').where({ venueId }).orderBy('createdAt', 'desc').limit(50).get()
  return {
    ok: true,
    contents: co.data.map(c => ({ _id: c._id, title: c.title, sub: (TYPE[c.type] || '') + ' · ' + (STAT[c.status] || c.status), raw: { venueId: c.venueId, type: c.type, title: c.title, cover: c.cover || '', bodyHtml: c.bodyHtml || '', body: c.body || [], solarTerm: c.solarTerm || '', relatedActivityId: c.relatedActivityId || '', status: c.status } }))
  }
}
