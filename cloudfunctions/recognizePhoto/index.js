// ===== 云函数 recognizePhoto —— AI 看现有标签：优先复用，必要才提议新标签 =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const https = require('https')
const ARK_KEY = process.env.ARK_API_KEY || ''
const ARK_VISION_MODEL = process.env.ARK_VISION_MODEL || ''
const ARK_HOST = 'ark.cn-beijing.volces.com'
const ARK_PATH = '/api/v3/chat/completions'

function arkChat(messages) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ model: ARK_VISION_MODEL, messages, temperature: 0.3 })
    const req = https.request({ host: ARK_HOST, path: ARK_PATH, method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ARK_KEY, 'Content-Length': Buffer.byteLength(payload) } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } }) })
    req.on('error', reject); req.write(payload); req.end()
  })
}

exports.main = async (event) => {
  const { fileID } = event || {}
  if (!fileID) return { ok: false, msg: '缺少图片' }
  if (!ARK_KEY || !ARK_VISION_MODEL) return { ok: false, msg: '识别还没配置好' }

  // 只把正式（approved）标签给 AI 当候选池
  let cats = []
  try { cats = (await db.collection('categories').where({ kind: 'wild', status: 'approved' }).orderBy('order', 'asc').get()).data } catch (e) {}
  const tagList = cats.map(c => c.name).join('、')
  const nameSet = cats.map(c => c.name)

  let url = ''
  try { const t = await cloud.getTempFileURL({ fileList: [fileID] }); url = (t.fileList[0] || {}).tempFileURL || '' } catch (e) {}
  if (!url) return { ok: false, msg: '图片读取失败' }

  try {
    const r = await arkChat([{ role: 'user', content: [
      { type: 'text', text:
        `这是金佛山里拍到的画面（可能是动植物，也可能是风景/天象等场景）。请给它打一个最贴切的"标签"。\n` +
        `已有标签：${tagList || '（暂无）'}。\n` +
        `规则：能用已有标签就直接用；只有明显不属于任何已有标签时，才新造一个简短标签（2-4个字，名词，如"竹林""云海""菌菇""溪流"）。不要造和已有标签意思相近的词。\n` +
        `只输出严格 JSON，无多余文字：{"tag":"标签名","isNew":true或false,"icon":"一个最贴切的emoji","desc":"一句亲切的话描述它"}`
      },
      { type: 'image_url', image_url: { url } }
    ] }])
    let raw = (((r.choices || [])[0] || {}).message || {}).content || ''
    raw = raw.replace(/```json|```/g, '').trim()
    let p = {}
    try { p = JSON.parse(raw) } catch (e) { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]) } catch (e2) {} } }
    let tag = (p.tag || '').toString().trim().slice(0, 10)
    if (!tag) return { ok: true, tag: '', isNew: false, icon: '', guess: (p.desc || raw || '').toString().slice(0, 120) }
    // 名字命中已有标签 → 当复用（无论 AI 说不说 new）
    const hit = nameSet.indexOf(tag) >= 0
    const isNew = hit ? false : !!p.isNew
    return { ok: true, tag, isNew, icon: (p.icon || '').toString().slice(0, 4), guess: (p.desc || '').toString().slice(0, 120) }
  } catch (e) { return { ok: false, msg: '识别走神了，待会再试' } }
}