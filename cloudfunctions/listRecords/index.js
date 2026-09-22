// ===== 云函数 listRecords —— 山野记录流 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
function fmt(d) { if (!d) return ''; const x = new Date(d), p = n => ('0' + n).slice(-2); return `${x.getMonth() + 1}月${x.getDate()}日` }
exports.main = async (event) => {
  const { page = 0, size = 20 } = event || {}
  const cats = (await db.collection('categories').where({ kind: 'wild' }).get()).data
  const cmap = {}; cats.forEach(c => { cmap[c.key] = c })
  const r = await db.collection('records').where({ status: 'public' }).orderBy('createdAt', 'desc').skip(page * size).limit(size).get()
  const list = r.data.map(x => ({
    _id: x._id, text: x.text || '', images: x.images || [],
    nickName: x.nickName || '山客', avatarUrl: x.avatarUrl || '',
    icon: (cmap[x.categoryKey] || {}).icon || '🌿', catName: (cmap[x.categoryKey] || {}).name || '',
    timeText: fmt(x.createdAt)
  }))
  return { ok: true, list, hasMore: r.data.length === size }
}