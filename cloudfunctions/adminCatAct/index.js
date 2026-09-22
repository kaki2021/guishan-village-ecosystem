// ===== 云函数 adminCatAct —— 分类管理：增/改名/删/收编/并入（仅山主） =====
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
  return rr.data.some(r => (r.perms || []).indexOf('manageAll') >= 0)
}
async function docOf(kind, key) { const r = await db.collection('categories').where({ kind, key }).get(); return r.data[0] }

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!(await isChief(openid))) return { ok: false, msg: '仅山主可管理分类' }
  const { kind, action, key, intoKey } = event || {}
  let { name, icon } = event || {}

  if (action === 'add') {
    name = (name || '').trim().slice(0, 12); if (!name) return { ok: false, msg: '填个名字' }
    if (['wild', 'activity', 'content', 'venue'].indexOf(kind) < 0) return { ok: false, msg: 'kind 有误' }
    const dup = await db.collection('categories').where({ kind, name }).count()
    if (dup.total) return { ok: false, msg: '已有同名分类' }
    const cnt = await db.collection('categories').where({ kind }).count()
    const newKey = (kind === 'wild' ? 't' : kind.slice(0, 1)) + Date.now() + Math.floor(Math.random() * 1000)
    await db.collection('categories').add({ data: { kind, key: newKey, name, icon: (icon || '').slice(0, 4), order: (cnt.total || 0) + 1, status: 'approved', source: 'manual', createdAt: new Date() } })
    return { ok: true }
  }

  const c = await docOf(kind, key)
  if (!c) return { ok: false, msg: '分类不存在' }
  if (action === 'approve') { await db.collection('categories').doc(c._id).update({ data: { status: 'approved', order: 100, updatedAt: new Date() } }); return { ok: true } }
  if (action === 'rename') {
    const data = { updatedAt: new Date() }
    if (name) data.name = name.trim().slice(0, 12)
    if (typeof icon === 'string') data.icon = icon.slice(0, 4)
    await db.collection('categories').doc(c._id).update({ data }); return { ok: true }
  }
  if (action === 'delete') { await db.collection('categories').doc(c._id).remove(); return { ok: true } }
  if (action === 'merge') { // 仅山野标签：把记录改挂到目标标签
    const target = await docOf('wild', intoKey); if (!target) return { ok: false, msg: '目标不存在' }
    const recs = await db.collection('records').where({ categoryKey: key }).limit(200).get()
    for (const r of recs.data) { await db.collection('records').doc(r._id).update({ data: { categoryKey: intoKey } }) }
    await db.collection('categories').doc(c._id).remove()
    return { ok: true, moved: recs.data.length }
  }
  return { ok: false, msg: '未知操作' }
}