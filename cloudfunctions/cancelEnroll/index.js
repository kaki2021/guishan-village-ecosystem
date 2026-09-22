// ===== 云函数 cancelEnroll —— 取消报名（自己的） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  const { activityId, date } = event || {}
  if (!activityId || !date) return { ok: false, msg: '缺少参数' }
  const r = await db.collection('enrolls').where({ activityId, date, _openid: openid, status: 'joined' }).get()
  if (!r.data.length) return { ok: false, msg: '未报名' }
  await db.collection('enrolls').doc(r.data[0]._id).update({ data: { status: 'cancelled', cancelledAt: new Date() } })
  return { ok: true }
}