// ===== 云函数 listCats —— 按 kind 读分类（approved） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async (event) => {
  const { kind } = event || {}
  if (!kind) return { ok: false, msg: '缺少 kind' }
  const r = await db.collection('categories').where({ kind, status: 'approved' }).orderBy('order', 'asc').limit(100).get()
  return { ok: true, list: r.data.map(c => ({ key: c.key, name: c.name, icon: c.icon || '' })) }
}