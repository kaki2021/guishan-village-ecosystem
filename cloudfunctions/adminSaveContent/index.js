// ===== 云函数 adminSaveContent —— 管理员新建/编辑内容（支持封面图 + 正文配图） =====
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
async function hasPerm(openid, perm, venueId) {
  const ur = await db.collection('users').where({ _openid: openid }).get()
  const u = ur.data[0]; const grants = (u && u.roles) || []
  if (!grants.length) return false
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  const roleMap = {}; rr.data.forEach(r => { roleMap[r.key] = r })
  for (const g of grants) {
    const role = roleMap[g.roleKey]; if (!role) continue
    const perms = role.perms || []
    const permOk = perms.indexOf('manageAll') >= 0 || perms.indexOf('manageVenue') >= 0 || perms.indexOf(perm) >= 0
    const scopeOk = role.scope === 'all' || !g.venueId || g.venueId === venueId
    if (permOk && scopeOk) return true
  }
  return false
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  let { id, venueId, type, title, cover, bodyHtml, solarTerm, relatedActivityId, status } = event || {}
  if (!venueId) return { ok: false, msg: '请选节点' }
  if (!(await hasPerm(openid, 'manageContent', venueId))) return { ok: false, msg: '没有该节点的内容权限' }
  title = (title || '').trim()
  if (!title) return { ok: false, msg: '请填标题' }
  const htmlText = (bodyHtml || '').replace(/<[^>]+>/g, ' ').slice(0, 4000)
  try { await cloud.openapi.security.msgSecCheck({ content: (title + ' ' + htmlText).slice(0, 4000) }) }
  catch (e) { if (e && e.errCode === 87014) return { ok: false, msg: '文字含敏感内容' } }

  const data = {
    venueId, type: type || 'reading', title, cover: cover || '', bodyHtml: sanitizeHtml((bodyHtml || '').slice(0, 20000)),
    solarTerm: solarTerm || '', relatedActivityId: relatedActivityId || '',
    status: status || 'published', updatedAt: new Date()
  }
  if (id) {
    try {
      const old = (await db.collection('contents').doc(id).get()).data
      if (old && old.cover && old.cover !== (cover || '') && old.cover.indexOf('cloud://') === 0) {
        try { await cloud.deleteFile({ fileList: [old.cover] }) } catch (e) {}
        try { const rr = await db.collection('uploads').where({ fileID: old.cover }).get(); for (const d of rr.data) await db.collection('uploads').doc(d._id).update({ data: { status: 'deleted', deletedAt: new Date() } }) } catch (e) {}
      }
    } catch (e) {}
    await db.collection('contents').doc(id).update({ data }); return { ok: true, id }
  }
  data.sortWeight = 0; data.publishedAt = new Date(); data.createdAt = new Date()
  const add = await db.collection('contents').add({ data })
  return { ok: true, id: add._id }
}
