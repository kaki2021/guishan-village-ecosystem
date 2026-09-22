// ===== 云函数 enrollActivity —— 报名某场次（activityId+date），名额校验 + 防重复 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  let { activityId, date, name, phone, subscribed } = event || {}
  if (!activityId || !date) return { ok: false, msg: '缺少参数' }
  let a
  try { a = (await db.collection('activities').doc(activityId).get()).data } catch (e) { return { ok: false, msg: '活动不存在' } }
  if (!a || a.status !== 'open') return { ok: false, msg: '活动不可报名' }

  name = (name || '').trim().slice(0, 30)
  phone = (phone || '').trim().slice(0, 20)
  if (name || phone) {
    try { await cloud.openapi.security.msgSecCheck({ content: (name + ' ' + phone).trim() }) }
    catch (e) { if (e && e.errCode === 87014) return { ok: false, msg: '信息含敏感内容' } }
  }

  // 防重复
  const exist = await db.collection('enrolls').where({ activityId, date, _openid: openid, status: 'joined' }).get()
  if (exist.data.length) return { ok: false, msg: '你已报名这一场' }

  // 名额校验
  const used = (await db.collection('enrolls').where({ activityId, date, status: 'joined' }).get()).data.length
  if (used >= (a.capacity || 0)) return { ok: false, msg: '这一场已报满' }

  await db.collection('enrolls').add({ data: {
    _openid: openid, activityId, date, clock: a.clock || '',
    title: a.title, venueId: a.venueId || '', category: a.category || '',
    name, phone, status: 'joined',
    subscribed: !!subscribed, notified: false,
    createdAt: new Date()
  } })
  return { ok: true }
}
