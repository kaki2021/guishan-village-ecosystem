const { call } = require('../../utils/api')
Page({
  data: { list: [], loaded: false, canPost: false },
  onShow() { this.load(); this.loadPerm() },
  onPullDownRefresh() { this.load(true) },
  loadPerm() { call('getMyProfile').then(r => this.setData({ canPost: !!r.canPost })).catch(() => {}) },
  load(pull) {
    call('listRecords', { page: 0, size: 20 }).then(r => this.setData({ list: r.list || [], loaded: true }))
      .catch(() => this.setData({ loaded: true })).then(() => { if (pull) wx.stopPullDownRefresh() })
  },
  add() {
    if (!this.data.canPost) { wx.showToast({ title: '该功能暂仅向村民开放', icon: 'none' }); return }
    wx.navigateTo({ url: '/pages/recordEdit/recordEdit' })
  },
  preview(e) { const { urls, cur } = e.currentTarget.dataset; wx.previewImage({ urls, current: cur }) }
})
