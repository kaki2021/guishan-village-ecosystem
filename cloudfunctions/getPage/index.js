// ===== 云函数 getPage —— 读理念页（HTML），转换 html 内 cloud:// 图片 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function htmlCloudToHttp(html) {
  if (!html) return ''
  const ids = []; const re = /cloud:\/\/[^\s"')]+/g; let m
  while ((m = re.exec(html)) !== null) ids.push(m[0])
  if (!ids.length) return html
  try {
    const r = await cloud.getTempFileURL({ fileList: Array.from(new Set(ids)) })
    const map = {}; r.fileList.forEach(f => { map[f.fileID] = f.tempFileURL || '' })
    return html.replace(re, s => map[s] || s)
  } catch (e) { return html }
}
exports.main = async (event) => {
  const { key } = event || {}
  if (!key) return { ok: false, msg: '缺少 key' }
  const r = await db.collection('pages').where({ key }).get()
  if (!r.data.length) return { ok: false, msg: '内容不存在' }
  const p = r.data[0]
  const html = await htmlCloudToHttp(p.html || '')
  return { ok: true, page: { key: p.key, navTitle: p.navTitle || '', html } }
}