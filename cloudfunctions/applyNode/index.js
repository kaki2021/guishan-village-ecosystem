// ===== 云函数 applyNode —— 亓灵申请加新节点（pending，待止灵审核） =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const keys = ((u && u.roles) || []).map(g => g.roleKey)
  const isSteward = keys.indexOf('steward') >= 0, isManager = keys.indexOf('manager') >= 0, isChief = keys.indexOf('chief') >= 0
  if (!(isSteward || isManager || isChief)) return { ok: false, msg: '只有亓灵及以上可以申请加节点' }

  let { name, intro, address } = event || {}
  name = (name || '').trim().slice(0, 30)
  intro = (intro || '').trim().slice(0, 200)
  address = (address || '').trim().slice(0, 100)
  if (!name) return { ok: false, msg: '请填节点名称' }
  try { await cloud.openapi.security.msgSecCheck({ content: (name + ' ' + intro + ' ' + address).trim() }) }
  catch (e) { if (e && e.errCode === 87014) return { ok: false, msg: '内容含敏感信息' } }

  const add = await db.collection('venues').add({ data: {
    name, intro, address, brandColor: '#9c5a3c', venueType: '', detailHtml: '', cover: '',
    modules: [], order: 999, lat: null, lng: null,
    status: 'pending', applicantOpenid: openid, createdAt: new Date()
  } })
  return { ok: true, id: add._id }
}