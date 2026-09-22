// ===== 云函数 getJoins —— 山主查看加入意向 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
async function isChief(openid) {
  if (!openid) return false
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []
  if (!grants.length) return false
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  return rr.data.some(r => (r.perms || []).indexOf('manageAll') >= 0 || (r.perms || []).indexOf('viewAll') >= 0)
}
const KIND = { reside: '长期驻留/养', partner: '共创伙伴/来干活', node: '带节点加入' }
function fmt(d) { if (!d) return ''; const x = new Date(d), p = n => ('0' + n).slice(-2); return `${x.getMonth() + 1}月${x.getDate()}日 ${p(x.getHours())}:${p(x.getMinutes())}` }

exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  if (!(await isChief(openid))) return { ok: false, msg: '仅山主可见' }
  const r = await db.collection('joins').orderBy('createdAt', 'desc').limit(100).get()
  return { ok: true, list: r.data.map(x => ({ _id: x._id, kindLabel: KIND[x.kind] || x.kind, name: x.name || '', wechat: x.wechat || '', phone: x.phone || '', message: x.message || '', skills: x.skills || [], timeText: fmt(x.createdAt) })) }
}