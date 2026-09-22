// ===== 云函数 listContents —— 内容列表（动态内容类型标签） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function toHttp(fileList) {
  const ids = (fileList || []).filter(x => x && typeof x === 'string' && x.indexOf('cloud://') === 0)
  if (!ids.length) return {}
  try { const r = await cloud.getTempFileURL({ fileList: ids }); const m = {}; r.fileList.forEach(f => { m[f.fileID] = f.tempFileURL || '' }); return m } catch (e) { return {} }
}
async function lbl(kind) { const r = await db.collection('categories').where({ kind, status: 'approved' }).get(); const m = {}; r.data.forEach(c => { m[c.key] = c.name }); return m }
exports.main = async (event) => {
  const { venueId, type, solarTerm, page = 0, size = 20 } = event || {}
  const TYPE = await lbl('content')
  const w = { status: 'published' }
  if (venueId) w.venueId = venueId
  if (type) w.type = type
  if (solarTerm) w.solarTerm = solarTerm
  const res = await db.collection('contents').where(w).orderBy('sortWeight', 'desc').orderBy('publishedAt', 'desc').skip(page * size).limit(size).get()
  const cmap = await toHttp(res.data.map(x => x.cover))
  const list = res.data.map(x => ({ _id: x._id, title: x.title, cover: cmap[x.cover] || '', typeLabel: TYPE[x.type] || '' }))
  return { ok: true, list, hasMore: res.data.length === size }
}