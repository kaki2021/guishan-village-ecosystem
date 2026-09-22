// ===== 云函数 updateProfile —— 保存头像/昵称 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  let { nickName, avatarUrl } = event || {}
  nickName = (nickName || '').trim().slice(0, 20)
  if (nickName) {
    try { await cloud.openapi.security.msgSecCheck({ content: nickName }) }
    catch (e) { if (e && e.errCode === 87014) return { ok: false, msg: '昵称含敏感内容' } }
  }
  const r = await db.collection('users').where({ _openid: openid }).get()
  const data = { updatedAt: new Date() }
  if (nickName) data.nickName = nickName
  if (avatarUrl) data.avatarUrl = avatarUrl
  if (r.data.length) {
    try {
      const old = r.data[0]
      if (avatarUrl && old.avatarUrl && old.avatarUrl !== avatarUrl && old.avatarUrl.indexOf('cloud://') === 0) {
        try { await cloud.deleteFile({ fileList: [old.avatarUrl] }) } catch (e) {}
        try { const rr = await db.collection('uploads').where({ fileID: old.avatarUrl }).get(); for (const d of rr.data) await db.collection('uploads').doc(d._id).update({ data: { status: 'deleted', deletedAt: new Date() } }) } catch (e) {}
      }
    } catch (e) {}
    await db.collection('users').doc(r.data[0]._id).update({ data })
  }
  else await db.collection('users').add({ data: Object.assign({ _openid: openid, phone: '', createdAt: new Date() }, data) })
  const cur = r.data[0] || {}
  return { ok: true, nickName: data.nickName || cur.nickName || '', avatarUrl: data.avatarUrl || cur.avatarUrl || '' }
}