// ===== 云函数 adminPendingNodes —— 列待审核节点（需 manageAll：止灵/玄灵/襾灵） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
async function canReview(openid) {
  if (!openid) return false
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const keys = Array.from(new Set(((u && u.roles) || []).map(g => g.roleKey))); if (!keys.length) return false
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  return rr.data.some(r => (r.perms || []).indexOf('manageAll') >= 0 || (r.perms || []).indexOf('viewAll') >= 0)
}
exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  if (!(await canReview(openid))) return { ok: false, msg: '没有审核权限' }
  const r = await db.collection('venues').where({ status: 'pending' }).orderBy('createdAt', 'asc').get()
  // 申请人昵称
  const ids = Array.from(new Set(r.data.map(v => v.applicantOpenid).filter(Boolean)))
  let umap = {}
  if (ids.length) { try { (await db.collection('users').where({ _openid: _.in(ids) }).get()).data.forEach(u => { umap[u._openid] = u.nickName || '' }) } catch (e) {} }
  return { ok: true, list: r.data.map(v => ({ _id: v._id, name: v.name, intro: v.intro || '', address: v.address || '', applicant: umap[v.applicantOpenid] || '' })) }
}