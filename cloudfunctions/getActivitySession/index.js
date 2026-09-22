// ===== 云函数 getActivitySession —— 活动详情 + 未来4周可报场次列表（每场含余位/是否已报） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const SUBSCRIBE_TEMPLATE_ID = process.env.SUBSCRIBE_TEMPLATE_ID || ''
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const WEEKS_AHEAD = 4
function pad2(n) { return ('0' + n).slice(-2) }
function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) }
function tsOf(ds, ck) { return new Date((ds || '') + 'T' + (ck || '00:00') + ':00').getTime() }
async function htmlCloudToHttp(html) {
  if (!html) return ''
  const ids = []; const re = /cloud:\/\/[^\s"')]+/g; let m
  while ((m = re.exec(html)) !== null) ids.push(m[0])
  if (!ids.length) return html
  try { const r = await cloud.getTempFileURL({ fileList: Array.from(new Set(ids)) }); const map = {}; r.fileList.forEach(f => { map[f.fileID] = f.tempFileURL || '' }); return html.replace(re, x => map[x] || x) } catch (e) { return html }
}
async function toHttp(list) {
  const ids = (list || []).filter(x => x && x.indexOf('cloud://') === 0)
  if (!ids.length) return {}
  try { const r = await cloud.getTempFileURL({ fileList: ids }); const m = {}; r.fileList.forEach(f => { m[f.fileID] = f.tempFileURL || '' }); return m } catch (e) { return {} }
}
function expand(a, nowMs, horizon) {
  const out = [], ck = a.clock || '07:00'
  if (a.repeat === 'once') { if (a.date && tsOf(a.date, ck) >= nowMs - 6 * 3600 * 1000) out.push(a.date); return out }
  const st = new Date(); st.setHours(0, 0, 0, 0)
  for (let d = new Date(st); d.getTime() <= horizon; d.setDate(d.getDate() + 1)) {
    let hit = false
    if (a.repeat === 'daily') hit = true
    else if (a.repeat === 'weekly') hit = (d.getDay() === Number(a.weekday))
    else if (a.repeat === 'monthly') hit = (d.getDate() === Number(a.monthday))
    if (!hit) continue
    const ds = ymd(d); if (tsOf(ds, ck) >= nowMs - 6 * 3600 * 1000) out.push(ds)
  }
  return out
}
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  const { activityId } = event || {}
  if (!activityId) return { ok: false, msg: '缺少参数' }
  let a
  try { a = (await db.collection('activities').doc(activityId).get()).data } catch (e) { return { ok: false, msg: '活动不存在' } }
  if (!a || a.status !== 'open') return { ok: false, msg: '活动不存在或未开放' }

  const nowMs = Date.now(), horizon = nowMs + WEEKS_AHEAD * 7 * 24 * 3600 * 1000
  const dates = expand(a, nowMs, horizon)
  const cap = a.capacity || 0

  // 该活动所有报名（算各场余位 + 我报了哪些）
  const er = (await db.collection('enrolls').where({ activityId, status: 'joined' }).get()).data
  const usedMap = {}; const mineSet = {}
  er.forEach(e => { usedMap[e.date] = (usedMap[e.date] || 0) + 1; if (e._openid === openid) mineSet[e.date] = true })

  const venue = a.venueId ? (await db.collection('venues').doc(a.venueId).get().catch(() => ({ data: null }))).data : null
  const coverMap = await toHttp([a.cover].filter(Boolean))

  const sessions = dates.map(d => {
    const used = usedMap[d] || 0
    return {
      date: d, clock: a.clock || '',
      dateLabel: d.slice(5).replace('-', '/') + ' ' + WD[new Date(d + 'T00:00:00').getDay()] + ' ' + (a.clock || ''),
      remain: Math.max(0, cap - used), full: used >= cap, enrolled: !!mineSet[d]
    }
  })

  return {
    ok: true,
    // 模板 ID 会在客户端运行时公开，但不应绑定在公共源码中。
    subscribeTemplateId: SUBSCRIBE_TEMPLATE_ID,
    activity: {
      _id: activityId, title: a.title, repeat: a.repeat,
      venueName: venue ? venue.name : '', cover: coverMap[a.cover] || '',
      introHtml: await htmlCloudToHttp(a.introHtml || ''),
      recurrenceText: a.recurrenceText || '', capacity: cap
    },
    sessions
  }
}
