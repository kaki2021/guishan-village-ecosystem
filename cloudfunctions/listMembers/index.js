// ===== 云函数 listMembers —— 列成员及称号；玄灵/止灵看全部，亓灵只看自己节点的仓灵 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const RANK = { chief: '玄灵', elder: '襾灵', manager: '止灵', steward: '亓灵', member: '仓灵' }
const ORDER = { chief: 6, elder: 6, manager: 5, steward: 4, member: 2 }
async function whoami(openid) {
  if (!openid) return { keys: [], perms: {}, grants: [] }
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const grants = (u && u.roles) || []
  const keys = Array.from(new Set(grants.map(g => g.roleKey)))
  let perms = {}
  if (keys.length) { const rr = await db.collection('roles').where({ key: _.in(keys) }).get(); rr.data.forEach(r => (r.perms || []).forEach(p => { perms[p] = true })) }
  return { keys, perms, grants }
}
exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  const me = await whoami(openid)
  const isChief = me.keys.indexOf('chief') >= 0
  const isManager = me.keys.indexOf('manager') >= 0
  const isSteward = me.keys.indexOf('steward') >= 0
  const myVenueIds = me.grants.filter(g => g.roleKey === 'steward').map(g => g.venueId).filter(Boolean)
  if (!me.perms.manageMembers && !isSteward && !me.perms.viewAll) return { ok: false, msg: '没有成员管理权限' }

  const us = (await db.collection('users').orderBy('createdAt', 'desc').limit(300).get()).data
  const vmap = {}
  try { (await db.collection('venues').get()).data.forEach(v => { vmap[v._id] = v.name }) } catch (e) {}
  // 引荐人昵称映射
  const refIds = []
  us.forEach(u => (u.roles || []).forEach(g => { if (g.referrer) refIds.push(g.referrer) }))
  const refMap = {}
  if (refIds.length) { try { (await db.collection('users').where({ _openid: _.in(Array.from(new Set(refIds))) }).get()).data.forEach(x => { refMap[x._openid] = x.nickName || '' }) } catch (e) {} }

  let list = us.map(u => {
    const grants = u.roles || []
    let top = '', topVenue = '', refferer = ''
    grants.forEach(g => { if (!top || (ORDER[g.roleKey] || 1) > (ORDER[top] || 1)) { top = g.roleKey; topVenue = g.venueId || ''; refferer = g.referrer || '' } })
    return {
      openid: u._openid, nickName: u.nickName || '山客', avatarUrl: u.avatarUrl || '', fclNo: u.fclNo || '',
      roleKey: top || '', rankTitle: top ? (RANK[top] || top) : '少灵',
      venueId: topVenue, venueName: topVenue ? (vmap[topVenue] || '') : '',
      referrerName: refferer ? (refMap[refferer] || '') : '',
      locked: (top === 'chief' || top === 'elder')
    }
  })

  // 亓灵（非止灵/玄灵）：只看自己负责节点的仓灵 + 少灵（可发展成仓灵）
  if (isSteward && !isManager && !isChief) {
    list = list.filter(m => (m.roleKey === 'member' && myVenueIds.indexOf(m.venueId) >= 0) || m.roleKey === '')
  }

  return {
    ok: true, list,
    me: { isChief, isManager, isSteward, myVenueIds }
  }
}