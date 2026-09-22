// ===== 云函数 adminSaveActivity —— 统一活动保存（单次/重复合一，HTML介绍，默认名额） =====
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
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

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

function buildText(repeat, weekday, monthday, clock, date) {
  const t = clock || ''
  if (repeat === 'once') return ((date || '') + ' ' + t).trim()
  if (repeat === 'daily') return ('每天 ' + t).trim()
  if (repeat === 'weekly') { const w = WD[weekday] !== undefined ? WD[weekday] : ''; return ('每' + w + ' ' + t).trim() }
  if (repeat === 'monthly') { const d = monthday ? (monthday + '日') : ''; return ('每月' + d + ' ' + t).trim() }
  return t
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  let { id, venueId, title, category, repeat, date, weekday, monthday, clock, capacity, introHtml, cover, status } = event || {}
  if (!venueId) return { ok: false, msg: '请选节点' }
  if (!(await hasPerm(openid, venueId))) return { ok: false, msg: '没有该节点的管理权限' }
  title = (title || '').trim()
  if (!title) return { ok: false, msg: '请填活动标题' }

  repeat = ['once', 'daily', 'weekly', 'monthly'].indexOf(repeat) >= 0 ? repeat : 'once'
  clock = clock || '07:00'
  capacity = parseInt(capacity, 10) || 0
  if (capacity < 1) return { ok: false, msg: '名额至少 1' }

  if (repeat === 'once' && !date) return { ok: false, msg: '请选日期' }
  weekday = (weekday === 0 || weekday) ? Number(weekday) : ''
  monthday = monthday ? Number(monthday) : ''

  const html = sanitizeHtml((introHtml || '').slice(0, 20000))
  const text = html.replace(/<[^>]+>/g, ' ').slice(0, 4000)
  try { await cloud.openapi.security.msgSecCheck({ content: (title + ' ' + text).slice(0, 4000) }) }
  catch (e) { if (e && e.errCode === 87014) return { ok: false, msg: '文字含敏感内容' } }

  const recurrenceText = buildText(repeat, weekday, monthday, clock, date)
  const data = {
    venueId, title, category: category || 'activity',
    repeat, date: repeat === 'once' ? (date || '') : '', weekday, monthday, clock,
    recurrenceText, capacity, introHtml: html, cover: cover || '',
    status: status || 'open', updatedAt: new Date()
  }
  if (id) {
    try {
      const old = (await db.collection('activities').doc(id).get()).data
      if (old && old.cover && old.cover !== (cover || '') && old.cover.indexOf('cloud://') === 0) {
        try { await cloud.deleteFile({ fileList: [old.cover] }) } catch (e) {}
        try { const rr = await db.collection('uploads').where({ fileID: old.cover }).get(); for (const d of rr.data) await db.collection('uploads').doc(d._id).update({ data: { status: 'deleted', deletedAt: new Date() } }) } catch (e) {}
      }
    } catch (e) {}
    await db.collection('activities').doc(id).update({ data }); return { ok: true, id }
  }
  data.createdAt = new Date()
  const add = await db.collection('activities').add({ data })
  return { ok: true, id: add._id }
}