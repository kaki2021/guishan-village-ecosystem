// ===== 云函数 savePage —— 保存理念页（html，需 manageAll） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// —— HTML 安全清洗：只保留白名单标签，剥离脚本/事件/危险协议 ——
function sanitizeHtml(html) {
  if (!html) return ''
  let s = String(html)
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  s = s.replace(/<object[\s\S]*?<\/object>/gi, '')
  s = s.replace(/<embed[\s\S]*?>/gi, '')
  s = s.replace(/<link[\s\S]*?>/gi, '')
  s = s.replace(/<meta[\s\S]*?>/gi, '')
  s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
  s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, '')
  s = s.replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
  s = s.replace(/javascript:/gi, '')
  s = s.replace(/data:text\/html/gi, '')
  s = s.replace(/vbscript:/gi, '')
  const ALLOW = ['p','br','h1','h2','h3','h4','strong','b','em','i','u','s','img','ul','ol','li','blockquote','div','span','hr','figure','figcaption','table','thead','tbody','tr','td','th']
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, function (m, tag) {
    return ALLOW.indexOf(tag.toLowerCase()) >= 0 ? m : ''
  })
  return s
}

const _ = db.command
async function canEdit(openid) {
  if (!openid) return false
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []; if (!grants.length) return false
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  return rr.data.some(r => (r.perms || []).indexOf('manageAll') >= 0)
}
const S = (v, n) => (typeof v === 'string' ? v : '').slice(0, n)
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!(await canEdit(openid))) return { ok: false, msg: '仅管理员可编辑' }
  const { key } = event || {}
  if (!key) return { ok: false, msg: '缺少 key' }
  const cardTitle = S(event.cardTitle, 40), cardSub = S(event.cardSub, 60), html = sanitizeHtml(S(event.html, 20000)), navTitle = S(event.navTitle, 20)
  // 合规检查纯文本（去标签）
  const text = html.replace(/<[^>]+>/g, ' ').slice(0, 4000)
  try { await cloud.openapi.security.msgSecCheck({ content: (navTitle + ' ' + cardTitle + ' ' + cardSub + ' ' + text).slice(0, 4000) }) }
  catch (e) { if (e && e.errCode === 87014) return { ok: false, msg: '文字含敏感内容' } }
  const data = { cardTitle, cardSub, html, updatedAt: new Date() }
  if (navTitle) data.navTitle = navTitle
  const ex = await db.collection('pages').where({ key }).get()
  if (ex.data.length) await db.collection('pages').doc(ex.data[0]._id).update({ data })
  else await db.collection('pages').add({ data: Object.assign({ key, navTitle: key }, data) })
  return { ok: true }
}