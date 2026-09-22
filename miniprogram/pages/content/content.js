const { call } = require('../../utils/api')
Page({
  data: { content: null, session: null },
  onLoad(q) {
    if (!q.id) return
    call('getContentDetail', { id: q.id }).then(r => this.setData({ content: r.content, session: r.session || null })).catch(() => {})
  },
  goSession() { if (this.data.session) wx.navigateTo({ url: '/pages/session/session?aid=' + this.data.session._id }) },
  onShareAppMessage() { const c = this.data.content || {}; return { title: c.title || '归山村落', path: '/pages/content/content?id=' + (c._id || ''), imageUrl: c.cover || '' } }
})
