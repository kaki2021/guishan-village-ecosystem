// ===== 云函数 login —— 放进 cloudfunctions/login/index.js =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const wx = cloud.getWXContext()
  const openid = wx.OPENID
  const unionid = wx.UNIONID || ''
  const users = db.collection('users')
  const res = await users.where({ _openid: openid }).get()
  let user
  if (res.data.length === 0) {
    const now = new Date()
    const add = await users.add({ data: {
      _openid: openid, unionid, phone: '', nickName: '', avatarUrl: '',
      createdAt: now, updatedAt: now
    } })
    user = (await users.doc(add._id).get()).data
  } else {
    user = res.data[0]
    if (unionid && !user.unionid) {
      await users.doc(user._id).update({ data: { unionid, updatedAt: new Date() } })
      user.unionid = unionid
    }
  }
  return { ok: true, openid, user }
}