// ===== 云函数 getVenueHome —— 节点空间：内容/活动/周期（动态标签） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function htmlCloudToHttp(html) {
  if (!html) return ''
  const ids = []; const re = /cloud:\/\/[^\s"')]+/g; let m
  while ((m = re.exec(html)) !== null) ids.push(m[0])
  if (!ids.length) return html
  try { const r = await cloud.getTempFileURL({ fileList: Array.from(new Set(ids)) }); const map = {}; r.fileList.forEach(f => { map[f.fileID] = f.tempFileURL || '' }); return html.replace(re, s => map[s] || s) } catch (e) { return html }
}
async function toHttp(fileList) {
  const ids = (fileList || []).filter(x => x && typeof x === 'string' && x.indexOf('cloud://') === 0)
  if (!ids.length) return {}
  try { const r = await cloud.getTempFileURL({ fileList: ids }); const m = {}; r.fileList.forEach(f => { m[f.fileID] = f.tempFileURL || '' }); return m } catch (e) { return {} }
}
const _ = db.command
function fmt(d) { if (!d) return ''; const x = new Date(d), p = n => ('0' + n).slice(-2); return `${x.getMonth() + 1}月${x.getDate()}日 ${p(x.getHours())}:${p(x.getMinutes())}` }
async function lbl(kind) { const r = await db.collection('categories').where({ kind, status: 'approved' }).get(); const m = {}; r.data.forEach(c => { m[c.key] = c.name }); return m }

exports.main = async (event) => {
  const { venueId } = event || {}
  if (!venueId) return { ok: false, msg: '缺少节点' }
  let venue
  try { venue = (await db.collection('venues').doc(venueId).get()).data } catch (e) { return { ok: false, msg: '节点不存在' } }
  if (!venue) return { ok: false, msg: '节点不存在' }
  const now = new Date()
  const CAT = await lbl('activity'), TYPE = await lbl('content'), VT = await lbl('venue')
  const cRes = await db.collection('contents').where({ venueId, status: 'published' }).orderBy('sortWeight', 'desc').orderBy('publishedAt', 'desc').limit(6).get()
  const fCovers = await toHttp(cRes.data.map(x => x.cover))
  const featured = cRes.data.map(x => ({ _id: x._id, title: x.title, cover: fCovers[x.cover] || '', typeLabel: TYPE[x.type] || '' }))
  // —— 活动：返回活动本身（不展开场次），带规律文案 ——
  const pad2 = n => ('0' + n).slice(-2)
  const ymd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
  const tsOf = (ds, ck) => new Date((ds || '') + 'T' + (ck || '00:00') + ':00').getTime()
  const nowMs = Date.now(), horizon = nowMs + 4 * 7 * 24 * 3600 * 1000
  function nextDate(a) {
    const ck = a.clock || '07:00'
    if (a.repeat === 'once') return (a.date && tsOf(a.date, ck) >= nowMs - 6 * 3600 * 1000) ? a.date : ''
    const st = new Date(); st.setHours(0, 0, 0, 0)
    for (let d = new Date(st); d.getTime() <= horizon; d.setDate(d.getDate() + 1)) {
      let hit = false
      if (a.repeat === 'daily') hit = true
      else if (a.repeat === 'weekly') hit = (d.getDay() === Number(a.weekday))
      else if (a.repeat === 'monthly') hit = (d.getDate() === Number(a.monthday))
      if (!hit) continue
      const ds = ymd(d); if (tsOf(ds, ck) >= nowMs - 6 * 3600 * 1000) return ds
    }
    return ''
  }
  const actsV = (await db.collection('activities').where({ venueId, status: 'open' }).get()).data
  let sessions = []
  actsV.forEach(a => {
    const nd = nextDate(a)
    if (!nd) return
    sessions.push({
      activityId: a._id, title: a.title, categoryLabel: CAT[a.category] || '',
      recurrenceText: a.recurrenceText || ((nd.slice(5).replace('-', '/')) + ' ' + (a.clock || '')),
      sortTs: tsOf(nd, a.clock || '07:00')
    })
  })
  sessions.sort((a, b) => a.sortTs - b.sortTs)
  const vCover = (await toHttp([venue.cover]))[venue.cover] || ''
  const vMusic = venue.music ? ((await toHttp([venue.music]))[venue.music] || '') : ''
  const detailHtml = await htmlCloudToHttp(venue.detailHtml || '')
  return { ok: true, venue: { _id: venue._id, name: venue.name, brandColor: venue.brandColor || '#9c5a3c', cover: vCover, intro: venue.intro || '', typeLabel: VT[venue.venueType] || '', detailHtml: detailHtml, address: venue.address || '', modules: venue.modules || [], music: vMusic }, featured, sessions }
}