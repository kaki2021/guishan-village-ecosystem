// ===== 云函数 resetMembers —— 一次性：成员体系重置，只保留指定玄灵，给其发 FCL-000001 =====
// 用法二选一：
//  A) 小程序里由玄灵本人调用（自动认 openid）
//  B) 云端测试：传 { keepOpenid: "你的openid" } 指定保留谁（从数据库 users 里复制你那条的 _openid）
// 安全：保留对象必须是玄灵；其余所有人清成少灵并清除编号。跑一次即可，跑完可删。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const ctxOpenid = cloud.getWXContext().OPENID
  const keepOpenid = (event && event.keepOpenid) || ctxOpenid
  if (!keepOpenid) return { ok: false, msg: '无法确定保留对象：请在小程序里调用，或传 keepOpenid 参数' }

  const me = (await db.collection('users').where({ _openid: keepOpenid }).get()).data[0]
  if (!me) return { ok: false, msg: '未找到该账号，请检查 keepOpenid 是否正确' }
  const myKeys = (me.roles || []).map(g => g.roleKey)
  if (myKeys.indexOf('chief') < 0) return { ok: false, msg: '保留对象必须是玄灵' }

  const all = (await db.collection('users').get()).data
  let cleared = 0
  for (const u of all) {
    if (u._openid === keepOpenid) continue
    const needClear = (u.roles && u.roles.length) || u.fclNo || u.fclSeq
    if (!needClear) continue
    await db.collection('users').doc(u._id).update({ data: { roles: [], fclNo: '', fclSeq: 0 } })
    cleared++
  }

  await db.collection('users').doc(me._id).update({ data: { fclNo: 'FCL-000001', fclSeq: 1, fclAt: new Date() } })

  try { await db.collection('counters').doc('fcl').set({ data: { seq: 1 } }) }
  catch (e) { try { await db.collection('counters').doc('fcl').update({ data: { seq: 1 } }) } catch (e2) {} }

  return { ok: true, cleared, kept: me.nickName || '', you: 'FCL-000001' }
}