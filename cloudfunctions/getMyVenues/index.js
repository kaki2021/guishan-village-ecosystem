// ===== 云函数 getMyVenues —— 后台"我能管的节点"（玄灵/止灵=全部，亓灵=自己负责的） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  let perms = {}
  if (keys.length) { const rr = await db.collection('roles').where({ key: _.in(keys) }).get(); rr.data.forEach(r => (r.perms || []).forEach(p => { perms[p] = true })) }
  const seeAll = perms.manageAll || perms.viewAll
  const all = (await db.collection('venues').orderBy('order', 'asc').get()).data
  let venues
  if (seeAll) venues = all
  else {
    const mine = grants.filter(g => g.roleKey === 'steward').map(g => g.venueId).filter(Boolean)
    venues = all.filter(v => mine.indexOf(v._id) >= 0)
  }
  return { ok: true, venues: venues.map(v => ({ _id: v._id, name: v.name })), canManageAll: !!seeAll }
}