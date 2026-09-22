// ===== 云函数 fileLedger —— 文件记账与删除（C记账系统 + A换文件删旧 的后端支撑）=====
// 动作 action：
//   'record'  记一条上传：{ action:'record', fileID, biz, refId }  biz=业务类型(venue-cover/venue-music/avatar/record/content-cover/activity-cover/page-img/html-img)
//   'replace' 换文件删旧：{ action:'replace', oldFileID }  删掉被替换的旧文件（并把uploads标记deleted）
//   'delete'  直接删：{ action:'delete', fileID }
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  const { action } = event || {}

  if (action === 'record') {
    const { fileID, biz, refId } = event
    if (!fileID || fileID.indexOf('cloud://') !== 0) return { ok: false, msg: 'bad fileID' }
    try {
      await db.collection('uploads').add({ data: {
        fileID, biz: biz || '', refId: refId || '', _openid: openid,
        status: 'active', createdAt: new Date()
      } })
    } catch (e) { return { ok: false, msg: 'record fail: ' + (e.message || e) } }
    return { ok: true }
  }

  if (action === 'replace' || action === 'delete') {
    const target = event.oldFileID || event.fileID
    if (!target || target.indexOf('cloud://') !== 0) return { ok: true, skipped: true }
    // 删云存储文件
    try { await cloud.deleteFile({ fileList: [target] }) } catch (e) {}
    // uploads 标记 deleted
    try {
      const r = await db.collection('uploads').where({ fileID: target }).get()
      for (const d of r.data) await db.collection('uploads').doc(d._id).update({ data: { status: 'deleted', deletedAt: new Date() } })
    } catch (e) {}
    return { ok: true }
  }

  return { ok: false, msg: 'unknown action' }
}