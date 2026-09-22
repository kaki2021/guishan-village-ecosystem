// ===== 云函数 getNetworkHome —— 首页数据：节点 + 最近活动 + 周期活动 + 村子近况 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function toHttp(fileList) {
  const ids = (fileList || []).filter(x => x && typeof x === 'string' && x.indexOf('cloud://') === 0)
  if (!ids.length) return {}
  try { const r = await cloud.getTempFileURL({ fileList: ids }); const m = {}; r.fileList.forEach(f => { m[f.fileID] = f.tempFileURL || '' }); return m } catch (e) { return {} }
}
const _ = db.command
function fmt(d) { if (!d) return ''; const x = new Date(d), p = n => ('0' + n).slice(-2); return `${x.getMonth() + 1}月${x.getDate()}日 ${p(x.getHours())}:${p(x.getMinutes())}` }
async function lbl(kind) { const r = await db.collection('categories').where({ kind, status: 'approved' }).get(); const m = {}; r.data.forEach(c => { m[c.key] = c.name }); return m }

exports.main = async () => {
  const now = new Date()
  const CAT = await lbl('activity'), VT = await lbl('venue')
  const vRes = await db.collection('venues').where({ status: 'active' }).orderBy('order', 'asc').get()
  const vmap = {}; vRes.data.forEach(v => { vmap[v._id] = v })
  const vCovers = await toHttp(vRes.data.map(v => v.cover))
  const venues = vRes.data.map(v => {
    // 兼容：优先用 venueTypes 数组，没有就回退老的单 venueType
    const keys = Array.isArray(v.venueTypes) && v.venueTypes.length ? v.venueTypes : (v.venueType ? [v.venueType] : [])
    return { _id: v._id, name: v.name, brandColor: v.brandColor || '#9c5a3c', cover: vCovers[v.cover] || '', intro: v.intro || '', typeKeys: keys, typeLabels: keys.map(k => VT[k] || '').filter(Boolean), typeLabel: keys.length ? (VT[keys[0]] || '') : '', modules: v.modules || [], address: v.address || '', lat: (typeof v.lat === 'number' ? v.lat : null), lng: (typeof v.lng === 'number' ? v.lng : null) }
  })
  // 筛选用的类型列表：只列"有节点用到"的类型（避免空类型）
  const usedKeys = {}
  venues.forEach(v => v.typeKeys.forEach(k => { usedKeys[k] = true }))
  const venueTypes = Object.keys(usedKeys).map(k => ({ key: k, name: VT[k] || k })).filter(t => t.name)

  // —— 活动：返回活动本身（不展开场次），带规律文案 + 最近一场用于排序/提示 ——
  const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const WEEKS_AHEAD = 4
  const pad2 = n => ('0' + n).slice(-2)
  const ymd = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
  const tsOf = (ds, ck) => new Date((ds || '') + 'T' + (ck || '00:00') + ':00').getTime()
  const nowMs = Date.now(), horizon = nowMs + WEEKS_AHEAD * 7 * 24 * 3600 * 1000
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
  const actsAll = (await db.collection('activities').where({ status: 'open' }).get()).data
  let sessions = []
  actsAll.forEach(a => {
    const nd = nextDate(a)
    if (!nd) return // 没有未来可报场次的不显示
    sessions.push({
      activityId: a._id, title: a.title, venueId: a.venueId,
      venueName: (vmap[a.venueId] || {}).name || '', venueColor: (vmap[a.venueId] || {}).brandColor || '#9c5a3c',
      categoryLabel: CAT[a.category] || '', repeat: a.repeat,
      recurrenceText: a.recurrenceText || ((nd.slice(5).replace('-', '/')) + ' ' + (a.clock || '')),
      sortTs: tsOf(nd, a.clock || '07:00')
    })
  })
  sessions.sort((a, b) => a.sortTs - b.sortTs)
  sessions = sessions.slice(0, 8)

  let moments = []
  try {
    const mRes = await db.collection('records').where({ status: 'public' }).orderBy('createdAt', 'desc').limit(3).get()
    const allImg = []; mRes.data.forEach(m => (m.images || []).forEach(x => allImg.push(x)))
    const im = await toHttp(allImg)
    // 查发布者昵称
    const ops = Array.from(new Set(mRes.data.map(m => m._openid).filter(Boolean)))
    let umap = {}
    if (ops.length) { try { (await db.collection('users').where({ _openid: _.in(ops) }).get()).data.forEach(u => { umap[u._openid] = { nickName: u.nickName || '村里人', avatarUrl: u.avatarUrl || '' } }) } catch (e) {} }
    moments = mRes.data.map(m => ({ _id: m._id, text: m.text || '', images: (m.images || []).map(x => im[x] || x), place: '', tag: '', nickName: (umap[m._openid] || {}).nickName || '村里人', avatarUrl: (umap[m._openid] || {}).avatarUrl || '', timeText: fmt(m.createdAt) }))
  } catch (e) {}

  return { ok: true, venues, venueTypes, sessions, moments }
}