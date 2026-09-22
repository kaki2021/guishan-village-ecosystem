// ===== 云函数 mediaCheckCallback —— 山野记录图片异步检测结果回调 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function settle(coll, traceId, suggest) {
  const r = await db.collection(coll).where({ 'imgChecks.traceId': traceId }).get()
  if (!r.data.length) return false
  const rec = r.data[0]
  const imgChecks = (rec.imgChecks || []).map(c => c.traceId === traceId ? Object.assign({}, c, { suggest }) : c)
  const anyRisky = imgChecks.some(c => c.suggest === 'risky')
  const allDone = imgChecks.every(c => c.suggest && c.suggest !== 'pending')
  let status = rec.status
  if (anyRisky) status = 'rejected'
  else if (allDone) status = 'public'
  await db.collection(coll).doc(rec._id).update({ data: { imgChecks, status } })
  return true
}

exports.main = async (event) => {
  const traceId = event.trace_id || event.traceId || ''
  const suggest = (event.result && event.result.suggest) || event.suggest || ''
  if (!traceId) return { ok: true }
  await settle('records', traceId, suggest)
  return { ok: true }
}
