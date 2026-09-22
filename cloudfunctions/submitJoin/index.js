// ===== 云函数 submitJoin —— 留加入意向 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const KINDS = ['reside', 'partner', 'node']

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  let { kind, name, wechat, phone, message } = event || {}
  name = (name || '').trim().slice(0, 30)
  wechat = (wechat || '').trim().slice(0, 40)
  phone = (phone || '').trim().slice(0, 20)
  message = (message || '').trim().slice(0, 500)
  if (KINDS.indexOf(kind) < 0) return { ok: false, msg: '类型有误' }
  if (!name) return { ok: false, msg: '留个称呼吧' }
  if (!wechat && !phone) return { ok: false, msg: '留个联系方式吧' }

  try { await cloud.openapi.security.msgSecCheck({ content: [name, wechat, message].filter(Boolean).join(' ') }) }
  catch (e) { if (e && e.errCode === 87014) return { ok: false, msg: '内容含敏感词' } }

  await db.collection('joins').add({ data: { _openid: openid, kind, name, wechat, phone, message, status: 'new', createdAt: new Date() } })
  return { ok: true }
}