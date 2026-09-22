// ===== 云函数 remindEnrolls —— 定时：活动开始前2小时给已授权报名者推订阅消息 =====
// 由定时触发器每10分钟调用一次。也可手动调用测试。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const TEMPLATE_ID = process.env.SUBSCRIBE_TEMPLATE_ID || ''
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
function tsOf(ds, ck) { return new Date((ds || '') + 'T' + (ck || '00:00') + ':00').getTime() }
// 字段长度限制：thing 类 ≤20字符，截断保护
function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s }

exports.main = async () => {
  if (!TEMPLATE_ID) return { ok: false, sent: 0, msg: '未配置 SUBSCRIBE_TEMPLATE_ID' }
  const now = Date.now()
  const windowStart = now + 110 * 60 * 1000  // 距开始 110~120 分钟的场次（2小时±10分钟窗口，配合10分钟定时）
  const windowEnd = now + 130 * 60 * 1000

  // 取所有还没通知、且已订阅、状态 joined 的报名
  const er = await db.collection('enrolls').where({ status: 'joined', subscribed: true, notified: _.neq(true) }).get()
  if (!er.data.length) return { ok: true, sent: 0, msg: '无待提醒' }

  // 节点名缓存
  const vids = Array.from(new Set(er.data.map(e => e.venueId).filter(Boolean)))
  let vmap = {}
  if (vids.length) { try { (await db.collection('venues').where({ _id: _.in(vids) }).get()).data.forEach(v => { vmap[v._id] = v.name }) } catch (e) {} }

  let sent = 0
  for (const e of er.data) {
    const startTs = tsOf(e.date, e.clock)
    // 只推"距开始约2小时"的；已过期的标记掉不再推
    if (startTs < now) { await db.collection('enrolls').doc(e._id).update({ data: { notified: true } }).catch(() => {}); continue }
    if (startTs < windowStart || startTs > windowEnd) continue

    const venueName = vmap[e.venueId] || '归山村落'
    const wd = e.date ? WD[new Date(e.date + 'T00:00:00').getDay()] : ''
    const timeText = (e.date || '').replace(/-/g, '.') + ' ' + wd + ' ' + (e.clock || '')
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: e._openid,
        templateId: TEMPLATE_ID,
        page: 'pages/session/session?aid=' + e.activityId + '&date=' + e.date,
        data: {
          thing22: { value: clip(e.title || '活动', 20) },
          time24: { value: clip(timeText, 20) },
          thing35: { value: clip(venueName, 20) },
          thing4: { value: '活动约2小时后开始，记得准时来' }
        }
      })
      await db.collection('enrolls').doc(e._id).update({ data: { notified: true } })
      sent++
    } catch (err) {
      // 推送失败（如用户已取消订阅授权）：标记 notified 避免反复重试
      await db.collection('enrolls').doc(e._id).update({ data: { notified: true, notifyErr: (err && err.errCode) || -1 } }).catch(() => {})
    }
  }
  return { ok: true, sent }
}
