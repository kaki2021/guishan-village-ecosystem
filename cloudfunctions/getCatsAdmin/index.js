// ===== 云函数 getCatsAdmin —— 山主查看三组分类（山野标签/活动分类/内容类型） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
async function isChief(openid) {
  if (!openid) return false
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []; if (!grants.length) return false
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  return rr.data.some(r => (r.perms || []).indexOf('manageAll') >= 0 || (r.perms || []).indexOf('viewAll') >= 0)
}
const map = x => ({ key: x.key, name: x.name, icon: x.icon || '' })
exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  if (!(await isChief(openid))) return { ok: false, msg: '仅山主可管理分类' }
  const all = (await db.collection('categories').orderBy('order', 'asc').limit(300).get()).data
  return {
    ok: true,
    wildPending: all.filter(c => c.kind === 'wild' && c.status === 'pending').map(map),
    wildApproved: all.filter(c => c.kind === 'wild' && c.status === 'approved').map(map),
    activity: all.filter(c => c.kind === 'activity' && c.status === 'approved').map(map),
    content: all.filter(c => c.kind === 'content' && c.status === 'approved').map(map),
    venue: all.filter(c => c.kind === 'venue' && c.status === 'approved').map(map)
  }
}