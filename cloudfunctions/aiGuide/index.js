// ===== 云函数 aiGuide —— 山中向导（火山方舟/豆包），放进 cloudfunctions/aiGuide/index.js =====
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const https = require('https')

// ↓↓↓ 用你观天瀑/归山那套同一个火山方舟 Ark 配置。建议在「云函数 → 环境变量」里配，别硬编码 ↓↓↓
const ARK_KEY = process.env.ARK_API_KEY || ''
const ARK_MODEL = process.env.ARK_MODEL || '' // 填你的推理接入点ID(ep-...)或模型名
const ARK_HOST = 'ark.cn-beijing.volces.com'
const ARK_PATH = '/api/v3/chat/completions'

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
function scheduleOf(a) {
  if (a.recurrenceText) return a.recurrenceText
  const clock = a.clock || ''
  if (a.repeat === 'once') return [a.date, clock].filter(Boolean).join(' ')
  if (a.repeat === 'daily') return '每天 ' + clock
  if (a.repeat === 'weekly') return (WD[Number(a.weekday)] || '每周') + ' ' + clock
  if (a.repeat === 'monthly') return '每月 ' + (a.monthday || '') + ' 日 ' + clock
  return clock
}

function arkChat(messages) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ model: ARK_MODEL, messages, temperature: 0.7, max_tokens: 600 })
    const req = https.request({
      host: ARK_HOST, path: ARK_PATH, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ARK_KEY, 'Content-Length': Buffer.byteLength(payload) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } }) })
    req.on('error', reject)
    req.setTimeout(25000, () => { req.destroy(new Error('ark timeout')) })
    req.write(payload); req.end()
  })
}

exports.main = async (event) => {
  const q = ((event || {}).question || '').trim()
  if (!q) return { ok: false, msg: '说说你想要什么吧' }
  if (!ARK_KEY || !ARK_MODEL) return { ok: false, msg: '向导还没配置好（缺 Ark Key 或模型）' }

  const now = Date.now()
  const venues = (await db.collection('venues').where({ status: 'active' }).get()).data
  const activities = (await db.collection('activities').where({ status: 'open' }).limit(100).get()).data
    .filter(a => a.repeat !== 'once' || new Date((a.date || '') + 'T' + (a.clock || '00:00') + ':00').getTime() >= now - 6 * 3600 * 1000)
    .slice(0, 15)
  const contents = (await db.collection('contents').where({ status: 'published' }).orderBy('publishedAt', 'desc').limit(15).get()).data
  const vmap = {}; venues.forEach(v => { vmap[v._id] = v })

  const catalog = {
    venues: venues.map(v => ({ id: v._id, name: v.name, intro: v.intro || '' })),
    activities: activities.map(a => ({ id: a._id, title: a.title, venue: (vmap[a.venueId] || {}).name || '', schedule: scheduleOf(a) })),
    contents: contents.map(c => ({ id: c._id, title: c.title, venue: (vmap[c.venueId] || {}).name || '' }))
  }

  const sys = '你是「归山村落」的山中向导，温和、简洁，像个懂山的朋友。只能从给定清单里推荐，严禁编造不存在的节点/活动/内容，也不要提价格。'
  const user = '访客说：「' + q + '」\n现有清单(JSON)：\n' + JSON.stringify(catalog) +
    '\n只输出一个JSON：{"reply":"两三句向导式回应","picks":[{"kind":"venue|activity|content","id":"清单里的真实id"}]}。picks最多3个、id必须来自清单，没有合适的就空数组。不要输出JSON以外的任何字符。'

  let aiText = ''
  try {
    const r = await arkChat([{ role: 'system', content: sys }, { role: 'user', content: user }])
    aiText = (((r.choices || [])[0] || {}).message || {}).content || ''
  } catch (e) { return { ok: false, msg: '向导走神了，待会再试' } }

  let reply = aiText, picks = []
  try { const j = JSON.parse(aiText.replace(/```json|```/g, '').trim()); reply = j.reply || aiText; picks = Array.isArray(j.picks) ? j.picks : [] } catch (e) {}

  // 用真实数据兜 picks，AI 编的 id 直接丢掉
  const amap = {}; activities.forEach(a => { amap[a._id] = a }); const cmap = {}; contents.forEach(c => { cmap[c._id] = c })
  const cards = []
  picks.forEach(p => {
    if (p.kind === 'venue' && vmap[p.id]) cards.push({ kind: 'venue', id: p.id, title: vmap[p.id].name, sub: vmap[p.id].intro || '' })
    else if (p.kind === 'activity' && amap[p.id]) cards.push({ kind: 'activity', id: p.id, title: amap[p.id].title, sub: ((vmap[amap[p.id].venueId] || {}).name || '') + ' · ' + scheduleOf(amap[p.id]) })
    else if (p.kind === 'content' && cmap[p.id]) cards.push({ kind: 'content', id: p.id, title: cmap[p.id].title, sub: (vmap[cmap[p.id].venueId] || {}).name || '' })
  })

  return { ok: true, reply: reply, cards: cards }
}
