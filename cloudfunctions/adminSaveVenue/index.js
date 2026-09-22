// ===== 云函数 adminSaveVenue —— 保存节点资料：封面/简介/类型/图文介绍(HTML) =====
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
async function hasPerm(openid, venueId) {
  if (!openid) return false
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []; if (!grants.length) return false
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  const rmap = {}; rr.data.forEach(r => { rmap[r.key] = r })
  for (const g of grants) {
    const role = rmap[g.roleKey]; if (!role) continue
    const p = role.perms || []
    const permOk = p.indexOf('manageAll') >= 0 || p.indexOf('manageVenue') >= 0
    const scopeOk = role.scope === 'all' || !g.venueId || g.venueId === venueId
    if (permOk && scopeOk) return true
  }
  return false
}
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  let { venueId, intro, venueType, venueTypes, cover, detailHtml, lat, lng, music } = event || {}
  const detailHtml_raw = detailHtml || ''
  if (!venueId) return { ok: false, msg: '缺少节点' }
  if (!(await hasPerm(openid, venueId))) return { ok: false, msg: '没有该节点的管理权限' }
  intro = (intro || '').trim().slice(0, 60)
  const html = sanitizeHtml((detailHtml || '').slice(0, 20000))
  const text = html.replace(/<[^>]+>/g, ' ').slice(0, 4000)
  try { await cloud.openapi.security.msgSecCheck({ content: (intro + ' ' + text).slice(0, 4000) }) }
  catch (e) { if (e && e.errCode === 87014) return { ok: false, msg: '文字含敏感内容' } }
  // 多类型：优先存数组；同时保留单 venueType 兼容旧逻辑（取第一个）
  let types = Array.isArray(venueTypes) ? venueTypes.filter(Boolean) : (venueType ? [venueType] : [])
  const data = { intro, venueTypes: types, venueType: types[0] || '', updatedAt: new Date(), detailHtml: html }
  // 经纬度：能转成合理数字才存（纬度-90~90，经度-180~180），否则清空
  const nlat = parseFloat(lat), nlng = parseFloat(lng)
  if (!isNaN(nlat) && !isNaN(nlng) && nlat >= -90 && nlat <= 90 && nlng >= -180 && nlng <= 180) { data.lat = nlat; data.lng = nlng }
  else if (lat === '' || lng === '' || lat == null) { data.lat = null; data.lng = null }
  if (typeof cover === 'string') data.cover = cover
  if (typeof music === 'string') data.music = music
  // A：换封面/音乐时删旧文件（一对一替换，旧的没用了）
  try {
    const oldDoc = (await db.collection('venues').doc(venueId).get()).data
    const toDel = []
    if (typeof cover === 'string' && oldDoc.cover && oldDoc.cover !== cover && oldDoc.cover.indexOf('cloud://') === 0) toDel.push(oldDoc.cover)
    if (typeof music === 'string' && oldDoc.music && oldDoc.music !== music && oldDoc.music.indexOf('cloud://') === 0) toDel.push(oldDoc.music)
    if (toDel.length) {
      try { await cloud.deleteFile({ fileList: toDel }) } catch (e) {}
      for (const fid of toDel) { try { const r = await db.collection('uploads').where({ fileID: fid }).get(); for (const d of r.data) await db.collection('uploads').doc(d._id).update({ data: { status: 'deleted', deletedAt: new Date() } }) } catch (e) {} }
    }
  } catch (e) {}
  await db.collection('venues').doc(venueId).update({ data })
  // 诊断：返回前端传来了什么、清洗后多长、存完读回多长
  let saved = {}
  try { saved = (await db.collection('venues').doc(venueId).get()).data } catch (e) {}
  return { ok: true, diag: {
    recv_detailHtmlLen: (detailHtml_raw || '').length,
    recv_head: (detailHtml_raw || '').slice(0, 40),
    afterSanitizeLen: html.length,
    saved_introLen: (saved.intro || '').length,
    saved_detailHtmlLen: (saved.detailHtml || '').length
  } }
}