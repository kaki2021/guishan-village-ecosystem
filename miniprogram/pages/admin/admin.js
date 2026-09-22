const { call } = require('../../utils/api')
function mark(arr) { return (arr || []).map(it => Object.assign({}, it, { hidden: ['closed', 'paused', 'draft'].indexOf(it.raw.status) >= 0 })) }
function markA(arr) { return (arr || []).map(it => Object.assign({}, it, { hidden: ['draft', 'closed', 'paused'].indexOf(it.status) >= 0, repeatLabel: ({ once: '单次', weekly: '每周', daily: '每天', monthly: '每月' }[it.repeat] || '') })) }
Page({
  data: { venues: [], vIndex: 0, venueId: '', venueName: '', activities: [], contents: [], ready: false, canMembers: false, canReviewNodes: false, canApplyNode: false, canManageAll: false, isStewardOnly: false },
  onShow() { this.check() },
  check() {
    call('getMyProfile').then(r => {
      if (!r.canManage) { wx.showToast({ title: '无管理权限', icon: 'none' }); setTimeout(() => wx.navigateBack(), 800); return }
      const roles = r.myRoles || []
      const canManageAll = roles.some(x => x.scope === 'all' || x.roleKey === 'manager' || x.roleKey === 'chief' || x.roleKey === 'elder')
      const isStewardOnly = !canManageAll && roles.some(x => x.roleKey === 'steward')
      this.setData({ ready: true, canMembers: !!r.canManageMembers, canReviewNodes: !!r.canReviewNodes, canApplyNode: !!r.canApplyNode, canManageAll, isStewardOnly }); this.loadVenues()
    }).catch(() => {})
  },
  loadVenues() {
    call('getMyVenues').then(r => {
      const vs = r.venues || []
      this.setData({ venues: vs })
      if (vs.length) { this.setData({ vIndex: 0, venueId: vs[0]._id, venueName: vs[0].name }); this.loadList() }
    }).catch(() => {})
  },
  pickVenue(e) { const i = +e.detail.value, v = this.data.venues[i]; this.setData({ vIndex: i, venueId: v._id, venueName: v.name }); this.loadList() },
  loadList() {
    call('adminListActivities', { venueId: this.data.venueId }).then(r => this.setData({ activities: markA(r.list) })).catch(() => {})
    call('adminList', { venueId: this.data.venueId }).then(r => this.setData({ contents: mark(r.contents) })).catch(() => {})
  },
  goReviewNodes() { wx.navigateTo({ url: '/pages/adminNodes/adminNodes' }) },
  applyNode() {
    wx.showModal({
      title: '申请加节点', editable: true, placeholderText: '节点名称（如 银杏谷营地）',
      success: r => {
        if (!r.confirm || !(r.content || '').trim()) return
        call('applyNode', { name: r.content.trim() }).then(res => {
          if (!res.ok) return wx.showToast({ title: res.msg || '失败', icon: 'none' })
          wx.showModal({ title: '已提交', content: '节点申请已提交，待止灵审核通过后即可上线。你可以稍后在「节点资料」补充介绍。', showCancel: false })
        }).catch(() => wx.showToast({ title: '失败', icon: 'none' }))
      }
    })
  },
  add(e) { wx.navigateTo({ url: `/pages/adminEdit/adminEdit?type=${e.currentTarget.dataset.type}&venueId=${this.data.venueId}&venueName=${encodeURIComponent(this.data.venueName)}` }) },
  edit(e) { const { type, id } = e.currentTarget.dataset; wx.navigateTo({ url: `/pages/adminEdit/adminEdit?type=${type}&venueId=${this.data.venueId}&venueName=${encodeURIComponent(this.data.venueName)}&id=${id}` }) },
  act(e) { const { type, id, action } = e.currentTarget.dataset; call('adminAct', { type, id, action }).then(() => this.loadList()).catch(() => {}) },
  del(e) {
    const { type, id } = e.currentTarget.dataset
    wx.showModal({ title: '删除', content: '删除后不可恢复，确定？', success: res => { if (res.confirm) call('adminAct', { type, id, action: 'delete' }).then(() => this.loadList()).catch(() => {}) } })
  },
  goCats() { wx.navigateTo({ url: '/pages/adminCats/adminCats' }) },
  goVenueEdit() { wx.navigateTo({ url: '/pages/adminVenue/adminVenue' }) },
  goMembers() { wx.navigateTo({ url: '/pages/adminMembers/adminMembers' }) },
  goPages() { wx.navigateTo({ url: '/pages/adminPages/adminPages' }) },
  goJoins() { wx.navigateTo({ url: '/pages/adminJoins/adminJoins' }) },
  viewSignups(e) { const { id, title } = e.currentTarget.dataset; wx.navigateTo({ url: `/pages/adminSignups/adminSignups?id=${id}&title=${encodeURIComponent(title)}` }) }
})
