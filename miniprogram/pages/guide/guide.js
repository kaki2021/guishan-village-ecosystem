const { call } = require('../../utils/api')
Page({
  data: {
    msgs: [{ role: 'ai', text: '想在山里寻点什么？随口说说，比如"周末想放松""适合带父母"。', cards: [] }],
    input: '', loading: false,
    chips: ['周末想放松一下', '适合带父母来', '想学点传统的东西']
  },
  onInput(e) { this.setData({ input: e.detail.value }) },
  pickChip(e) { this.ask(e.currentTarget.dataset.q) },
  send() { this.ask(this.data.input) },
  ask(q) {
    q = (q || '').trim()
    if (!q || this.data.loading) return
    const msgs = this.data.msgs.concat([{ role: 'user', text: q, cards: [] }])
    this.setData({ msgs, input: '', loading: true })
    call('aiGuide', { question: q }).then(r => {
      this.setData({ msgs: this.data.msgs.concat([{ role: 'ai', text: r.reply || '', cards: r.cards || [] }]), loading: false })
    }).catch(() => { this.setData({ loading: false }) })
  },
  tapCard(e) {
    const { kind, id } = e.currentTarget.dataset
    if (kind === 'venue') wx.navigateTo({ url: '/pages/venue/venue?id=' + id })
    else if (kind === 'activity' || kind === 'session') wx.navigateTo({ url: '/pages/session/session?aid=' + id })
    else if (kind === 'content') wx.navigateTo({ url: '/pages/content/content?id=' + id })
  }
})
