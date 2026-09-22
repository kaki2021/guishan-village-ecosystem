const { call } = require('../../utils/api')
Page({
  data: { list: [], loaded: false },
  onShow() { this.load() },
  load() { call('getMySignups').then(r => this.setData({ list: r.list || [], loaded: true })).catch(() => this.setData({ loaded: true })) },
  goSession(e) { const { aid, date } = e.currentTarget.dataset; wx.navigateTo({ url: '/pages/session/session?aid=' + aid + '&date=' + date }) },
  goHome() { wx.switchTab({ url: '/pages/index/index' }) }
})
