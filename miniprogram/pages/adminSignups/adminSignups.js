const { call } = require('../../utils/api')
Page({
  data: { title: '', list: [], capacity: 0, loaded: false },
  onLoad(q) {
    call('adminActivitySignups', { activityId: q.id }).then(r => {
      if (!r.ok) { wx.showToast({ title: r.msg || '加载失败', icon: 'none' }); this.setData({ loaded: true }); return }
      this.setData({ title: r.title || '', list: r.list || [], capacity: r.capacity || 0, loaded: true })
    }).catch(() => this.setData({ loaded: true }))
  },
  copyPhone(e) { const p = e.currentTarget.dataset.phone; if (p) wx.setClipboardData({ data: p }) }
})
