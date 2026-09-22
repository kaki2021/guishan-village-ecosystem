// ===== 云函数 movePage —— 上移/下移理念页（与相邻页交换 order，需 manageAll） =====
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
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!(await canEdit(openid))) return { ok: false, msg: '仅管理员可编辑' }
  const { key, dir } = event || {} // dir: 'up' | 'down'
  if (!key || (dir !== 'up' && dir !== 'down')) return { ok: false, msg: '参数错误' }
  // 取全部并按 order 排（order 缺失的用大值兜底，并顺手补齐）
  let list = (await db.collection('pages').get()).data.slice()
  list.sort((a, b) => (a.order == null ? 999 : a.order) - (b.order == null ? 999 : b.order))
  // 规整 order 为 0..n（避免历史脏数据）
  for (let i = 0; i < list.length; i++) { if (list[i].order !== i) { await db.collection('pages').doc(list[i]._id).update({ data: { order: i } }); list[i].order = i } }
  const idx = list.findIndex(p => p.key === key)
  if (idx < 0) return { ok: false, msg: '页面不存在' }
  const swap = dir === 'up' ? idx - 1 : idx + 1
  if (swap < 0 || swap >= list.length) return { ok: false, msg: dir === 'up' ? '已在最前' : '已在最后' }
  const a = list[idx], b = list[swap]
  await db.collection('pages').doc(a._id).update({ data: { order: b.order } })
  await db.collection('pages').doc(b._id).update({ data: { order: a.order } })
  return { ok: true }
}