// ===== 云函数 cleanOrphans —— 基于 uploads 记账表清理孤儿文件 =====
// 逻辑：uploads 表里 status=active 的文件，若不在"数据库在用清单"里 = 孤儿。
// 安全：默认只扫描报告(列出孤儿、不删)；传 { confirm: true } 才真正删除。仅玄灵/止灵可调。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function extractCloudIds(html) {
  if (!html || typeof html !== 'string') return []
  const out = []; const re = /cloud:\/\/[^\s"')]+/g; let m
  while ((m = re.exec(html)) !== null) out.push(m[0])
  return out
}
async function getAll(coll, maxDocs) {
  const limit = 100; let all = [], skip = 0
  while (skip < maxDocs) {
    let r; try { r = await db.collection(coll).skip(skip).limit(limit).get() } catch (e) { break }
    all = all.concat(r.data); if (r.data.length < limit) break; skip += limit
  }
  return all
}
async function whoami(openid) {
  const u = (await db.collection('users').where({ _openid: openid }).get()).data[0]
  const keys = ((u && u.roles) || []).map(g => g.roleKey)
  let perms = {}
  if (keys.length) { const rr = await db.collection('roles').where({ key: db.command.in(keys) }).get(); rr.data.forEach(r => (r.perms || []).forEach(p => { perms[p] = true })) }
  return perms
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  const confirm = !!(event && event.confirm)
  const perms = await whoami(openid)
  if (!perms.manageAll) return { ok: false, msg: '仅管理员可清理' }

  const used = new Set()
  const add = id => { if (id && typeof id === 'string' && id.indexOf('cloud://') === 0) used.add(id) }
  ;(await getAll('users', 5000)).forEach(u => add(u.avatarUrl))
  ;(await getAll('venues', 1000)).forEach(v => { add(v.cover); add(v.music); extractCloudIds(v.detailHtml).forEach(add) })
  ;(await getAll('contents', 2000)).forEach(c => { add(c.cover); extractCloudIds(c.bodyHtml).forEach(add) })
  ;(await getAll('activities', 2000)).forEach(a => { add(a.cover); extractCloudIds(a.introHtml).forEach(add) })
  ;(await getAll('pages', 500)).forEach(p => extractCloudIds(p.html).forEach(add))
  ;(await getAll('categories', 1000)).forEach(c => add(c.icon))
  ;(await getAll('records', 5000)).forEach(r => (r.images || []).forEach(add))

  const ups = (await getAll('uploads', 20000)).filter(u => u.status === 'active')
  const orphans = ups.filter(u => !used.has(u.fileID))

  if (!confirm) {
    return { ok: true, mode: 'report', usedCount: used.size, uploadsActive: ups.length, orphanCount: orphans.length, orphanSample: orphans.slice(0, 20).map(o => ({ fileID: o.fileID, biz: o.biz })) }
  }

  let deleted = 0
  for (let i = 0; i < orphans.length; i += 50) {
    const batch = orphans.slice(i, i + 50)
    try { await cloud.deleteFile({ fileList: batch.map(o => o.fileID) }) } catch (e) {}
    for (const o of batch) { try { await db.collection('uploads').doc(o._id).update({ data: { status: 'deleted', deletedAt: new Date() } }); deleted++ } catch (e) {} }
  }
  return { ok: true, mode: 'deleted', deleted, total: orphans.length }
}