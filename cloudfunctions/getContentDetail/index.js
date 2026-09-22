// ===== 云函数 getContentDetail —— 内容详情（动态内容类型标签） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function htmlCloudToHttp(html) {
  if (!html) return ''
  const ids = []; const re = /cloud:\/\/[^\s"')]+/g; let m
  while ((m = re.exec(html)) !== null) ids.push(m[0])
  if (!ids.length) return html
  try { const r = await cloud.getTempFileURL({ fileList: Array.from(new Set(ids)) }); const map = {}; r.fileList.forEach(f => { map[f.fileID] = f.tempFileURL || '' }); return html.replace(re, x => map[x] || x) } catch (e) { return html }
}
async function toHttp(fileList) {
  const ids = (fileList || []).filter(x => x && typeof x === 'string' && x.indexOf('cloud://') === 0)
  if (!ids.length) return {}
  try { const r = await cloud.getTempFileURL({ fileList: ids }); const m = {}; r.fileList.forEach(f => { m[f.fileID] = f.tempFileURL || '' }); return m } catch (e) { return {} }
}
exports.main = async (event) => {
  const { id } = event || {}
  if (!id) return { ok: false, msg: '缺少参数' }
  let content
  try { content = (await db.collection('contents').doc(id).get()).data } catch (e) { return { ok: false, msg: '内容不存在' } }
  if (!content || content.status !== 'published') return { ok: false, msg: '内容不存在' }
  let typeLabel = ''
  try { const c = (await db.collection('categories').where({ kind: 'content', key: content.type }).get()).data[0]; typeLabel = c ? c.name : '' } catch (e) {}
  content.typeLabel = typeLabel
  // 封面转 https
  const cImg = await toHttp([content.cover].filter(Boolean))
  content.cover = cImg[content.cover] || content.cover || ''
  // 正文：优先 bodyHtml；老数据无 bodyHtml 时把 body 数组拼成 html 兜底
  let html = content.bodyHtml || ''
  if (!html && Array.isArray(content.body) && content.body.length) {
    html = content.body.map(b => b.type === 'img' ? ('<img src="' + b.src + '" style="width:100%;border-radius:8px;margin:8px 0">') : ('<p>' + (b.text || '') + '</p>')).join('')
  }
  content.bodyHtml = await htmlCloudToHttp(html)
  delete content.body
  let session = null
  const relatedActivityId = content.relatedActivityId || ''
  if (relatedActivityId) {
    try {
      const a = (await db.collection('activities').doc(relatedActivityId).get()).data
      if (a && a.status === 'open') { let cl = ''; try { const cc = (await db.collection('categories').where({ kind: 'activity', key: a.category }).get()).data[0]; cl = cc ? cc.name : '' } catch (e) {} session = { _id: a._id, title: a.title, categoryLabel: cl, status: a.status } }
    } catch (e) {}
  }
  return { ok: true, content, session }
}
