// ===== 云函数 getMyProfile —— 旅人证：荣誉头衔 + 角色称号 + 山野章 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
function titleOf(n) { if (!n || n < 1) return '山客'; if (n < 3) return '旅人'; if (n < 6) return '常客'; return '山友' }
async function actLabels(db) { const r = await db.collection('categories').where({ kind: 'activity', status: 'approved' }).get(); const m = {}; r.data.forEach(c => { m[c.key] = c.name }); return m }

exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  const ur = await db.collection('users').where({ _openid: openid }).get()
  const profile = ur.data.length ? ur.data[0] : null

  // 荣誉头衔层（按当前活动报名）
  const sr = await db.collection('enrolls').where({ _openid: openid, status: 'joined' }).get()
  const activityIds = Array.from(new Set(sr.data.map(s => s.activityId).filter(Boolean)))
  const activityMap = {}
  for (let i = 0; i < activityIds.length; i += 20) {
    const rows = (await db.collection('activities').where({ _id: _.in(activityIds.slice(i, i + 20)) }).get()).data
    rows.forEach(a => { activityMap[a._id] = a })
  }
  const byVenue = {}
  sr.data.forEach(s => { const v = s.venueId || 'unknown'; const category = s.category || ((activityMap[s.activityId] || {}).category || ''); if (!byVenue[v]) byVenue[v] = { count: 0, cats: {} }; byVenue[v].count += 1; if (category) byVenue[v].cats[category] = true })

  // 角色层
  const grants = (profile && profile.roles) || []
  let roleMap = {}
  if (grants.length) { const keys = Array.from(new Set(grants.map(g => g.roleKey))); const rr = await db.collection('roles').where({ key: _.in(keys) }).get(); rr.data.forEach(r => { roleMap[r.key] = r }) }

  const vIds = Array.from(new Set(Object.keys(byVenue).filter(x => x !== 'unknown').concat(grants.map(g => g.venueId).filter(Boolean))))
  const vmap = {}
  if (vIds.length) { const vr = await db.collection('venues').where({ _id: _.in(vIds) }).get(); vr.data.forEach(v => { vmap[v._id] = v }) }

  const CAT_LABEL = await actLabels(db)
  const venues = Object.keys(byVenue).map(vId => {
    const b = byVenue[vId], v = vmap[vId] || {}
    return { venueId: vId, venueName: v.name || '其它', brandColor: v.brandColor || '#9c5a3c', title: titleOf(b.count), signupCount: b.count, stamps: Object.keys(b.cats).map(c => ({ category: c, label: CAT_LABEL[c] || c })) }
  })

  const myRoles = []; let canManage = false, canManageMembers = false, canPost = false, canReviewNodes = false, canApplyNode = false, isReadOnly = false, hasRealManage = false
  const keySet = {}
  grants.forEach(g => {
    const role = roleMap[g.roleKey]; if (!role) return
    keySet[g.roleKey] = true
    const perms = role.perms || []
    if (perms.indexOf('manageAll') >= 0 || perms.indexOf('manageVenue') >= 0 || perms.indexOf('manageContent') >= 0) { canManage = true; hasRealManage = true }
    if (perms.indexOf('viewAll') >= 0) canManage = true
    if (perms.indexOf('manageMembers') >= 0) canManageMembers = true
    if (perms.indexOf('manageAll') >= 0) canReviewNodes = true
    if (perms.indexOf('manageAll') >= 0 || perms.indexOf('manageVenue') >= 0) canApplyNode = true
    if (perms.indexOf('manageAll') >= 0 || perms.indexOf('manageVenue') >= 0 || perms.indexOf('postMoment') >= 0) canPost = true
    myRoles.push({ roleKey: g.roleKey, name: role.name || g.roleKey, scope: role.scope || 'venue', venueId: g.venueId || '', venueName: g.venueId ? ((vmap[g.venueId] || {}).name || '') : '全网' })
  })
  // 称号（按高到低取最高）
  let rankTitle = '少灵'
  if (keySet['chief']) rankTitle = '玄灵'
  else if (keySet['elder']) rankTitle = '襾灵'
  else if (keySet['manager']) rankTitle = '止灵'
  else if (keySet['steward']) rankTitle = '亓灵'
  else if (keySet['member']) rankTitle = '仓灵'

  // 山野章层（按公开记录的分类现算）
  let wildStamps = []
  try {
    const rec = await db.collection('records').where({ _openid: openid, status: 'public' }).get()
    const wc = {}; rec.data.forEach(x => { wc[x.categoryKey] = (wc[x.categoryKey] || 0) + 1 })
    const wkeys = Object.keys(wc)
    if (wkeys.length) {
      const cr = await db.collection('categories').where({ kind: 'wild', key: _.in(wkeys) }).get()
      const cmap = {}; cr.data.forEach(c => { cmap[c.key] = c })
      wildStamps = wkeys.filter(k => cmap[k] && cmap[k].status === 'approved').map(k => ({ key: k, icon: cmap[k].icon || '🌿', label: cmap[k].name || k, count: wc[k] }))
    }
  } catch (e) {}

  const fclNo = (profile && profile.fclNo) || ''
  const fclSeq = (profile && profile.fclSeq) || 0
  let fclDate = ''
  if (profile && profile.fclAt) { const d = new Date(profile.fclAt); fclDate = d.getFullYear() + '.' + ('0'+(d.getMonth()+1)).slice(-2) + '.' + ('0'+d.getDate()).slice(-2) }
  isReadOnly = canManage && !hasRealManage && !canManageMembers
  return { ok: true, profile, venues, myRoles, canManage, canManageMembers, canPost, canReviewNodes, canApplyNode, isReadOnly, rankTitle, wildStamps, fclNo, fclSeq, fclDate }
}
