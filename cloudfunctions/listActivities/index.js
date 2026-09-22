// ===== 云函数 listActivities —— 列未来可报名场次（单次=自身；周期=未来4周展开）。公开 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const WEEKS_AHEAD = 4

function pad(n) { return ('0' + n).slice(-2) }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) }
// 把 "YYYY-MM-DD" + "HH:mm" 拼成可比较的时间戳（北京时区近似按本地）
function ts(dateStr, clock) { return new Date((dateStr || '') + 'T' + (clock || '00:00') + ':00').getTime() }

// 把一个活动展开成未来若干场次 [{date, clock, ...}]
function expand(act, now, horizon) {
  const out = []
  const clock = act.clock || '07:00'
  if (act.repeat === 'once') {
    if (!act.date) return out
    const t = ts(act.date, clock)
    if (t >= now - 6 * 3600 * 1000) out.push({ date: act.date, clock }) // 已开始6h内仍显示
    return out
  }
  // 重复：从今天起逐天扫到 horizon
  const start = new Date(); start.setHours(0, 0, 0, 0)
  for (let d = new Date(start); d.getTime() <= horizon; d.setDate(d.getDate() + 1)) {
    let hit = false
    if (act.repeat === 'daily') hit = true
    else if (act.repeat === 'weekly') hit = (d.getDay() === Number(act.weekday))
    else if (act.repeat === 'monthly') hit = (d.getDate() === Number(act.monthday))
    if (!hit) continue
    const ds = ymd(d)
    if (ts(ds, clock) >= now - 6 * 3600 * 1000) out.push({ date: ds, clock })
  }
  return out
}

exports.main = async (event) => {
  const { venueId, limit } = event || {}
  const now = Date.now()
  const horizon = now + WEEKS_AHEAD * 7 * 24 * 3600 * 1000

  const w = { status: 'open' }
  if (venueId) w.venueId = venueId
  const acts = (await db.collection('activities').where(w).get()).data

  // 已报名计数：按 activityId+date 统计 enrolls
  const actIds = acts.map(a => a._id)
  let enrollCount = {}
  if (actIds.length) {
    try {
      const er = await db.collection('enrolls').where({ activityId: _.in(actIds), status: 'joined' }).get()
      er.data.forEach(e => { const k = e.activityId + '|' + e.date; enrollCount[k] = (enrollCount[k] || 0) + 1 })
    } catch (e) {}
  }

  // 节点名
  const vIds = Array.from(new Set(acts.map(a => a.venueId).filter(Boolean)))
  let vmap = {}
  if (vIds.length) { const vs = (await db.collection('venues').where({ _id: _.in(vIds) }).get()).data; vs.forEach(v => { vmap[v._id] = v.name }) }

  const sessions = []
  acts.forEach(a => {
    expand(a, now, horizon).forEach(s => {
      const cap = a.capacity || 0
      const used = enrollCount[a._id + '|' + s.date] || 0
      sessions.push({
        activityId: a._id, title: a.title, venueId: a.venueId, venueName: vmap[a.venueId] || '',
        category: a.category || '', cover: a.cover || '', repeat: a.repeat,
        date: s.date, clock: s.clock,
        dateLabel: s.date.slice(5).replace('-', '/') + ' ' + s.clock,
        weekLabel: WD[new Date(s.date + 'T00:00:00').getDay()],
        capacity: cap, remain: Math.max(0, cap - used), full: used >= cap,
        sortTs: ts(s.date, s.clock)
      })
    })
  })
  sessions.sort((a, b) => a.sortTs - b.sortTs)
  const list = (limit && limit > 0) ? sessions.slice(0, limit) : sessions
  return { ok: true, list }
}