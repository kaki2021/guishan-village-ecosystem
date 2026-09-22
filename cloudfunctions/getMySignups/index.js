// ===== 云函数 getMySignups —— 我的报名（读 enrolls，未来场次在前） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
function tsOf(ds, ck) { return new Date((ds || '') + 'T' + (ck || '00:00') + ':00').getTime() }
exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  const r = await db.collection('enrolls').where({ _openid: openid, status: 'joined' }).get()
  const now = Date.now()
  const list = r.data.map(e => ({
    activityId: e.activityId, date: e.date, clock: e.clock || '',
    title: e.title || '活动',
    dateLabel: (e.date || '').slice(5).replace('-', '/') + ' ' + (e.date ? WD[new Date(e.date + 'T00:00:00').getDay()] : '') + ' ' + (e.clock || ''),
    past: tsOf(e.date, e.clock) < now - 6 * 3600 * 1000,
    sortTs: tsOf(e.date, e.clock)
  }))
  list.sort((a, b) => b.sortTs - a.sortTs)
  return { ok: true, list }
}