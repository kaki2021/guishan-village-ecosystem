// ===== 云函数 adminActivitySignups —— 看某活动报名名单（按场次日期分组，需节点管理权限） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
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
  const { activityId } = event || {}
  if (!activityId) return { ok: false, msg: '缺少活动' }
  let a
  try { a = (await db.collection('activities').doc(activityId).get()).data } catch (e) { return { ok: false, msg: '活动不存在' } }
  if (!a) return { ok: false, msg: '活动不存在' }
  if (!(await hasPerm(openid, a.venueId))) return { ok: false, msg: '没有权限' }

  const er = await db.collection('enrolls').where({ activityId, status: 'joined' }).orderBy('createdAt', 'asc').get()
  const openids = Array.from(new Set(er.data.map(e => e._openid)))
  let umap = {}
  if (openids.length) {
    const us = (await db.collection('users').where({ _openid: _.in(openids) }).get()).data
    us.forEach(u => { umap[u._openid] = u.nickName || '' })
  }
  const groups = {}
  er.data.forEach(e => {
    if (!groups[e.date]) groups[e.date] = []
    groups[e.date].push({ name: e.name || umap[e._openid] || '微信用户', phone: e.phone || '' })
  })
  const dates = Object.keys(groups).sort()
  const list = dates.map(d => ({
    date: d,
    dateLabel: d.slice(5).replace('-', '/') + ' ' + WD[new Date(d + 'T00:00:00').getDay()],
    count: groups[d].length, people: groups[d]
  }))
  return { ok: true, title: a.title, capacity: a.capacity || 0, list }
}