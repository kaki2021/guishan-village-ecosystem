const { call } = require('../../utils/api')
const { publicContacts } = require('../../config')
const LABELS = { reside: '长期驻留', partner: '成为共创伙伴', node: '带一个节点加入网络' }
const SKILL_GROUPS = [
  { tag: '🔥 现在就缺，来了马上有活', items: ['会种地 / 懂农艺', '会做饭、管厨房', '山地多面手（水电木工、修房）', '会张罗人、能主持议事'] },
  { tag: '⏳ 很快用得上，先认识起来', items: ['开车接驳 / 调度排产', '养殖（鸡鸭鱼猪菌）', '运营营销、拍摄剪辑、写东西', '管台账、理账'] },
  { tag: '🌱 长期欢迎，有这手艺随时来聊', items: ['中医养生 / 调理急救', '自然教育、带孩子共学', '软件、数据、网络', '财务、法务、合作社治理', '活动策划、体验设计', '手艺（木作、陶染、酿造、咖啡、摄影、音乐…）', '堆肥污水 / 生态管护', '会讲故事、会拍、会带气氛'] }
]
Page({
  data: { mode: 'menu', kind: '', kindLabel: '', name: '', wechat: '', phone: '', message: '', skills: [], customSkill: '', skillGroups: SKILL_GROUPS, publicContacts: publicContacts || [], submitting: false },
  pick(e) {
    const act = e.currentTarget.dataset.act
    if (act === 'community') { this.setData({ mode: 'community' }); return }
    this.setData({ mode: 'form', kind: act, kindLabel: LABELS[act] || '', skills: [] })
  },
  back() { this.setData({ mode: 'menu' }) },
  onName(e) { this.setData({ name: e.detail.value }) },
  onWechat(e) { this.setData({ wechat: e.detail.value }) },
  onPhone(e) { this.setData({ phone: e.detail.value }) },
  onMsg(e) { this.setData({ message: e.detail.value }) },
  onCustomSkill(e) { this.setData({ customSkill: e.detail.value }) },
  toggleSkill(e) {
    const s = e.currentTarget.dataset.s
    const arr = this.data.skills.slice()
    const i = arr.indexOf(s)
    if (i >= 0) arr.splice(i, 1); else arr.push(s)
    this.setData({ skills: arr })
  },
  submit() {
    if (this.data.submitting) return
    const d = this.data
    if (!d.name.trim()) return wx.showToast({ title: '留个称呼吧', icon: 'none' })
    if (!d.wechat.trim() && !d.phone.trim()) return wx.showToast({ title: '留个联系方式', icon: 'none' })
    const extra = (d.customSkill || '').split(/[,，、\s]+/).map(x => x.trim()).filter(Boolean)
    const allSkills = d.skills.concat(extra.filter(x => d.skills.indexOf(x) < 0))
    this.setData({ submitting: true })
    call('submitJoin', { kind: d.kind, name: d.name, wechat: d.wechat, phone: d.phone, message: d.message, skills: allSkills })
      .then(() => this.setData({ mode: 'done', submitting: false }))
      .catch(() => this.setData({ submitting: false }))
  },
  callPhone(e) { wx.makePhoneCall({ phoneNumber: e.currentTarget.dataset.p }) },
  saveQr() { wx.previewImage({ urls: ['/images/gongzhonghao-qr.jpg'] }) }
})
