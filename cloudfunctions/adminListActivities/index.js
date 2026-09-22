// ===== 云函数 adminListActivities —— 列节点下的活动（后台管理/编辑回显） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
async function hasPerm(openid, venueId) {
  if (!openid) return false
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []; if (!grants.length) return false
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  const rmap = {}; rr.data.forEach(r => { rmap[r.key] = r })
  for (const g of grants) {
    const role = rmap[g.roleKey]; if (!role) continue
    const p = role.perms || []
    const permOk = p.indexOf('manageAll') >= 0 || p.indexOf('manageVenue') >= 0 || p.indexOf('viewAll') >= 0
    const scopeOk = role.scope === 'all' || !g.venueId || g.venueId === venueId
    if (permOk && scopeOk) return true
  }
  return false
}
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  const { venueId } = event || {}
  if (!venueId) return { ok: false, msg: '缺少节点' }
  if (!(await hasPerm(openid, venueId))) return { ok: false, msg: '没有权限' }
  const r = await db.collection('activities').where({ venueId }).orderBy('updatedAt', 'desc').get()
  return { ok: true, list: r.data.map(a => ({
    _id: a._id, title: a.title, repeat: a.repeat || 'once', recurrenceText: a.recurrenceText || '',
    capacity: a.capacity || 0, status: a.status || 'open', category: a.category || '',
    date: a.date || '', weekday: (a.weekday === 0 || a.weekday) ? a.weekday : '', monthday: a.monthday || '',
    clock: a.clock || '', introHtml: a.introHtml || '', cover: a.cover || ''
  })) }
}