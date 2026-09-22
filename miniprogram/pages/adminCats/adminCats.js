const { call } = require('../../utils/api')
Page({
  data: { wildPending: [], wildApproved: [], activity: [], content: [], venue: [], loaded: false },
  onShow() { this.load() },
  load() {
    call('getCatsAdmin').then(r => {
      if (!r.ok) { wx.showToast({ title: r.msg || '无权限', icon: 'none' }); setTimeout(() => wx.navigateBack(), 800); return }
      this.setData({ wildPending: r.wildPending || [], wildApproved: r.wildApproved || [], activity: r.activity || [], content: r.content || [], venue: r.venue || [], loaded: true })
    }).catch(() => this.setData({ loaded: true }))
  },
  act(payload) { return call('adminCatAct', payload).then(() => this.load()).catch(() => {}) },
  add(e) {
    const kind = e.currentTarget.dataset.kind
    wx.showModal({ title: '新增分类', editable: true, placeholderText: '分类名称', success: r => { if (r.confirm && r.content.trim()) this.act({ kind, action: 'add', name: r.content.trim() }) } })
  },
  rename(e) {
    const { kind, key, name } = e.currentTarget.dataset
    wx.showModal({ title: '改名', editable: true, content: name, success: r => { if (r.confirm && r.content.trim()) this.act({ kind, key, action: 'rename', name: r.content.trim() }) } })
  },
  del(e) {
    const { kind, key } = e.currentTarget.dataset
    wx.showModal({ title: '删除分类', content: '用此分类的内容会失去标签名，确定？', success: r => { if (r.confirm) this.act({ kind, key, action: 'delete' }) } })
  },
  approve(e) { this.act({ kind: 'wild', key: e.currentTarget.dataset.key, action: 'approve' }) },
  merge(e) {
    const key = e.currentTarget.dataset.key
    const targets = this.data.wildApproved.filter(t => t.key !== key)
    if (!targets.length) return wx.showToast({ title: '无可并入标签', icon: 'none' })
    wx.showActionSheet({ itemList: targets.map(t => (t.icon ? t.icon + ' ' : '') + t.name), success: res => this.act({ kind: 'wild', key, action: 'merge', intoKey: targets[res.tapIndex].key }) })
  }
})
