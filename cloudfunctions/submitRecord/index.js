// ===== 云函数 submitRecord —— 山野记录：仅仓灵及以上可发；文字同步检测 + 图片异步检测 + 新标签落 pending =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function canPost(openid) {
  if (!openid) return false
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []; if (!grants.length) return false
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  const rmap = {}; rr.data.forEach(r => { rmap[r.key] = r })
  // 仓灵(postMoment)、亓灵(manageVenue)、止灵/玄灵/襾灵(manageAll) 可发；少灵不可
  return grants.some(g => { const role = rmap[g.roleKey]; const p = (role && role.perms) || []; return p.indexOf('manageAll') >= 0 || p.indexOf('manageVenue') >= 0 || p.indexOf('postMoment') >= 0 })
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!(await canPost(openid))) return { ok: false, msg: '当前没有发布权限' }
  let { categoryKey, newTagName, newTagIcon, text, images } = event || {}
  text = (text || '').trim()
  newTagName = (newTagName || '').trim().slice(0, 10)
  images = Array.isArray(images) ? images.slice(0, 9) : []
  if (!text && !images.length) return { ok: false, msg: '写点什么或拍张照' }

  // 文字 + 新标签名一起做敏感词检测
  const checkText = [text, newTagName].filter(Boolean).join(' ')
  if (checkText) {
    try { await cloud.openapi.security.msgSecCheck({ content: checkText }) }
    catch (e) { if (e && e.errCode === 87014) return { ok: false, msg: '文字含敏感内容' } }
  }

  // 解析标签：优先用已选的 categoryKey；否则用新标签（已有同名则复用，否则建 pending）
  let key = ''
  if (categoryKey) {
    try { const c = await db.collection('categories').where({ kind: 'wild', key: categoryKey }).count(); if (c.total) key = categoryKey } catch (e) {}
  }
  if (!key && newTagName) {
    const ex = await db.collection('categories').where({ kind: 'wild', name: newTagName }).get()
    if (ex.data.length) key = ex.data[0].key
    else {
      key = 't' + Date.now() + Math.floor(Math.random() * 1000)
      await db.collection('categories').add({ data: { kind: 'wild', key, name: newTagName, icon: (newTagIcon || '🌿'), order: 900, status: 'pending', source: 'ai', createdAt: new Date() } })
    }
  }
  if (!key) return { ok: false, msg: '选个标签吧' }

  // 作者昵称头像冗余
  let nickName = '山客', avatarUrl = ''
  try { const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]; if (u) { nickName = u.nickName || '山客'; avatarUrl = u.avatarUrl || '' } } catch (e) {}

  // 图片异步检测
  const imgChecks = []; const hasImg = images.length > 0
  if (hasImg) {
    try {
      const urls = await cloud.getTempFileURL({ fileList: images })
      for (const f of urls.fileList) {
        if (!f.tempFileURL) continue
        try { const r = await cloud.openapi.security.mediaCheckAsync({ media_url: f.tempFileURL, media_type: 2, version: 2, scene: 4, openid }); imgChecks.push({ traceId: r.trace_id || '', fileID: f.fileID, suggest: 'pending' }) }
        catch (e) { imgChecks.push({ traceId: '', fileID: f.fileID, suggest: 'pending' }) }
      }
    } catch (e) {}
  }

  const add = await db.collection('records').add({ data: {
    _openid: openid, categoryKey: key, text, images, nickName, avatarUrl,
    status: hasImg ? 'checking' : 'public', imgChecks, likeCount: 0, createdAt: new Date()
  } })
  return { ok: true, id: add._id, status: hasImg ? 'checking' : 'public' }
}