// ===== 云函数 getPageCards —— 首页理念卡（动态，按 order 排，公开） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
exports.main = async () => {
  const r = await db.collection('pages').get()
  const list = r.data.slice().sort((a, b) => (a.order || 999) - (b.order || 999))
  const cards = list.map(p => ({ key: p.key, title: p.cardTitle || '', sub: p.cardSub || '' }))
  return { ok: true, cards }
}