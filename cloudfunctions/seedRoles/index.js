// ===== 云函数 seedRoles —— 种/更新角色表（六称号）。可重复跑，跑完更新名称权限 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// roleKey 不变（兼容历史数据），只改显示名 name 与权限 perms
const ROLES = [
  { key: 'chief',   name: '玄灵', perms: ['manageAll', 'manageMembers'], scope: 'all' },   // 小程序/团队负责人（最高，受保护）
  { key: 'manager', name: '止灵', perms: ['manageAll', 'manageMembers'], scope: 'all' },   // 内部管理
  { key: 'elder',   name: '襾灵', perms: ['viewAll'], scope: 'all' },   // 退位负责人 / 顾问（只读，受保护）
  { key: 'steward', name: '亓灵', perms: ['manageVenue'], scope: 'venue' },                // 节点负责人
  { key: 'member',  name: '仓灵', perms: ['postMoment'], scope: 'all' }                     // 正式成员（可发村子近况）
  // 少灵 = 无任何角色的注册成员，不入表
]

exports.main = async () => {
  const updated = [], created = []
  for (const r of ROLES) {
    const ex = await db.collection('roles').where({ key: r.key }).get()
    if (ex.data.length) {
      await db.collection('roles').doc(ex.data[0]._id).update({ data: { name: r.name, perms: r.perms, scope: r.scope, updatedAt: new Date() } })
      updated.push(r.key)
    } else {
      await db.collection('roles').add({ data: Object.assign({}, r, { createdAt: new Date() }) })
      created.push(r.key)
    }
  }
  return { ok: true, created, updated }
}