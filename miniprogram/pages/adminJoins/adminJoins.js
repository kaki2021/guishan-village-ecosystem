const { call } = require('../../utils/api')
Page({
  data: { list: [], loaded: false },
  onShow() {
    call('getJoins').then(r => {
      if (!r.ok) { wx.showToast({ title: r.msg || '无权限', icon: 'none' }); setTimeout(() => wx.navigateBack(), 800); return }
      this.setData({ list: r.list || [], loaded: true })
    }).catch(() => this.setData({ loaded: true }))
  },
  copy(e) { wx.setClipboardData({ data: e.currentTarget.dataset.v }) },
  callPhone(e) { const p = e.currentTarget.dataset.p; if (p) wx.makePhoneCall({ phoneNumber: p }) }
})