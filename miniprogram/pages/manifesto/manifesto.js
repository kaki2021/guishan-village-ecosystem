const { call } = require('../../utils/api')
Page({
  data: { key: '', navTitle: '', html: '', loaded: false },
  onLoad(q) {
    const key = q.key || 'think'
    call('getPage', { key }).then(r => {
      if (!r.ok) { this.setData({ loaded: true }); return }
      wx.setNavigationBarTitle({ title: r.page.navTitle || '归山理念' })
      this.setData({ key, navTitle: r.page.navTitle, html: r.page.html || '', loaded: true })
    }).catch(() => this.setData({ loaded: true }))
  },
  goJoin() { wx.navigateTo({ url: '/pages/join/join' }) }
})
