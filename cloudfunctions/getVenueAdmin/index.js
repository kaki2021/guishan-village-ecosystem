// ===== 云函数 getVenueAdmin —— 列节点供编辑（cover/detail 保留原始 fileID，另给 url 仅预览） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
async function toHttp(fileList) {
  const ids = (fileList || []).filter(x => x && typeof x === 'string' && x.indexOf('cloud://') === 0)
  if (!ids.length) return {}
  try { const r = await cloud.getTempFileURL({ fileList: ids }); const m = {}; r.fileList.forEach(f => { m[f.fileID] = f.tempFileURL || '' }); return m } catch (e) { return {} }
}
async function canManage(openid) {
  if (!openid) return false
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []; if (!grants.length) return false
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  const rmap = {}; rr.data.forEach(r => { rmap[r.key] = r })
  return grants.some(g => { const p = ((rmap[g.roleKey] || {}).perms) || []; return p.indexOf('manageAll') >= 0 || p.indexOf('manageVenue') >= 0 })
}
exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  if (!(await canManage(openid))) return { ok: false, msg: '没有权限' }
  const vs = (await db.collection('venues').orderBy('order', 'asc').get()).data
  const allImg = []; vs.forEach(v => { if (v.cover) allImg.push(v.cover) })
  const im = await toHttp(allImg)
  return {
    ok: true,
    list: vs.map(v => ({
      _id: v._id, name: v.name, brandColor: v.brandColor || '#9c5a3c',
      cover: v.cover || '', coverUrl: im[v.cover] || '',
      intro: v.intro || '', venueType: v.venueType || '', venueTypes: (Array.isArray(v.venueTypes) && v.venueTypes.length) ? v.venueTypes : (v.venueType ? [v.venueType] : []), inviteCode: v.inviteCode || '', music: v.music || '',
      detailHtml: v.detailHtml || '',
      lat: (typeof v.lat === 'number' ? v.lat : ''), lng: (typeof v.lng === 'number' ? v.lng : '')
    }))
  }
}