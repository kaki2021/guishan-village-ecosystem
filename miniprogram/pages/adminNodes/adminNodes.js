const { call } = require('../../utils/api')
Page({
  data: { list: [], loaded: false },
  onShow() { this.load() },
  load() { call('adminPendingNodes').then(r => { if (!r.ok) { wx.showToast({ title: r.msg || '无权限', icon: 'none' }); setTimeout(() => wx.navigateBack(), 800); return } this.setData({ list: r.list || [], loaded: true }) }).catch(() => this.setData({ loaded: true })) },
  approve(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({ title: '通过审核', content: '通过后该节点上线，申请人成为该节点的亓灵（负责人）。', success: r => { if (r.confirm) this.review(id, 'approve') } })
  },
  reject(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({ title: '驳回', content: '驳回将删除该节点申请，确定？', success: r => { if (r.confirm) this.review(id, 'reject') } })
  },
  review(id, action) {
    call('reviewNode', { id, action }).then(r => {
      if (!r.ok) return wx.showToast({ title: r.msg || '失败', icon: 'none' })
      wx.showToast({ title: action === 'approve' ? '已通过' : '已驳回', icon: 'none' }); this.load()
    }).catch(() => wx.showToast({ title: '失败', icon: 'none' }))
  }
})
