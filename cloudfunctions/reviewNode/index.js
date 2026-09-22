// ===== 云函数 reviewNode —— 审核待加节点：通过(open)+申请人设为该节点亓灵 / 驳回(删除)。需 manageAll =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
async function canReview(openid) {
  if (!openid) return false
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const keys = Array.from(new Set(((u && u.roles) || []).map(g => g.roleKey))); if (!keys.length) return false
  const rr = await db.collection('roles').where({ key: _.in(keys) }).get()
  return rr.data.some(r => (r.perms || []).indexOf('manageAll') >= 0)
}
exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!(await canReview(openid))) return { ok: false, msg: '没有审核权限' }
  const { id, action } = event || {} // action: 'approve' | 'reject'
  if (!id) return { ok: false, msg: '缺少节点' }
  let v
  try { v = (await db.collection('venues').doc(id).get()).data } catch (e) { return { ok: false, msg: '节点不存在' } }
  if (!v || v.status !== 'pending') return { ok: false, msg: '该节点不在待审状态' }

  if (action === 'reject') { await db.collection('venues').doc(id).remove(); return { ok: true, rejected: true } }

  // 通过：上线 + 把申请人设成该节点亓灵（若其当前无更高称号）
  await db.collection('venues').doc(id).update({ data: { status: 'active', reviewedAt: new Date() } })
  if (v.applicantOpenid) {
    const au = (await db.collection('users').where({ _openid: v.applicantOpenid }).get()).data[0]
    if (au) {
      const cur = (au.roles || [])
      const keys = cur.map(g => g.roleKey)
      // 已是止灵/玄灵/襾灵就不动；否则追加一个该节点的亓灵身份
      if (keys.indexOf('manager') < 0 && keys.indexOf('chief') < 0 && keys.indexOf('elder') < 0) {
        const exists = cur.some(g => g.roleKey === 'steward' && g.venueId === id)
        const roles = exists ? cur : cur.filter(g => g.roleKey !== 'member').concat([{ roleKey: 'steward', venueId: id }])
        await db.collection('users').doc(au._id).update({ data: { roles } })
      }
    }
  }
  return { ok: true }
}