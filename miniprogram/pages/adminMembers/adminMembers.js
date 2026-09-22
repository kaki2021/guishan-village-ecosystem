const { call } = require('../../utils/api')
Page({
  data: { list: [], shownList: [], venues: [], me: {}, loaded: false, filterKey: 'titled' },
  onShow() { this.load() },
  load() {
    Promise.all([
      call('listMembers').then(r => r).catch(() => ({ ok: false })),
      call('getMyVenues').then(r => r.venues || []).catch(() => [])
    ]).then(([r, venues]) => {
      if (!r.ok) { wx.showToast({ title: r.msg || '无权限', icon: 'none' }); setTimeout(() => wx.navigateBack(), 800); return }
      this.setData({ list: r.list || [], venues, me: r.me || {}, loaded: true })
      this.applyFilter()
    })
  },
  // 根据"我"的身份，算出我能给目标设哪些称号
  setFilter(e) { this.setData({ filterKey: e.currentTarget.dataset.key }, () => this.applyFilter()) },
  applyFilter() {
    const k = this.data.filterKey
    let shown
    if (k === 'titled') shown = this.data.list.filter(m => m.roleKey && m.roleKey !== '')
    else if (k === 'all') shown = this.data.list
    else shown = this.data.list.filter(m => m.roleKey === k)
    this.setData({ shownList: shown })
  },
  ladderFor() {
    const me = this.data.me
    const L = [{ roleKey: '', name: '少灵（旁观）' }, { roleKey: 'member', name: '仓灵（正式成员）' }]
    if (me.isManager || me.isChief) L.push({ roleKey: 'steward', name: '亓灵（节点负责人）' })
    if (me.isChief) { L.push({ roleKey: 'manager', name: '止灵（内部管理）' }); L.push({ roleKey: 'elder', name: '襾灵（荣誉退位）' }); L.push({ roleKey: 'chief', name: '玄灵（最高，慎用）' }) }
    return L
  },
  tapMember(e) {
    const m = e.currentTarget.dataset.m
    if (m.locked && !this.data.me.isChief) { wx.showToast({ title: m.rankTitle + ' 受保护', icon: 'none' }); return }
    const ladder = this.ladderFor()
    if (!ladder.length) return
    wx.showActionSheet({
      itemList: ladder.map(l => l.name),
      success: res => {
        const pick = ladder[res.tapIndex]
        if (pick.roleKey === 'steward' || pick.roleKey === 'member') this.pickVenueThenSet(m, pick.roleKey)
        else this.confirmSet(m, pick)
      }
    })
  },
  pickVenueThenSet(m, roleKey) {
    const vs = this.data.venues
    if (!vs.length) { if (roleKey === 'member') return this.setRole(m, 'member', ''); return wx.showToast({ title: '无可选节点', icon: 'none' }) }
    wx.showActionSheet({
      itemList: vs.map(v => (roleKey === 'steward' ? '负责：' : '引进到：') + v.name),
      success: res => this.setRole(m, roleKey, vs[res.tapIndex]._id)
    })
  },
  confirmSet(m, pick) {
    if (pick.roleKey === 'chief' || pick.roleKey === 'elder') {
      wx.showModal({ title: '确认', content: '把「' + m.nickName + '」设为' + pick.name + '？此操作较重要。', success: r => { if (r.confirm) this.setRole(m, pick.roleKey, '') } })
    } else this.setRole(m, pick.roleKey, '')
  },
  setRole(m, roleKey, venueId) {
    call('setMemberRole', { targetOpenid: m.openid, roleKey, venueId }).then(r => {
      if (!r.ok) return wx.showToast({ title: r.msg || '失败', icon: 'none' })
      wx.showToast({ title: '已更新', icon: 'success' }); this.load()
    }).catch(() => wx.showToast({ title: '失败', icon: 'none' }))
  },
  abdicate() {
    wx.showModal({
      title: '退位为襾灵', content: '你将从玄灵退位，转为襾灵（荣誉）。退位后不能再管理，确定？',
      success: r => {
        if (!r.confirm) return
        call('abdicate').then(res => {
          if (!res.ok) return wx.showToast({ title: res.msg || '失败', icon: 'none' })
          wx.showToast({ title: '已退位', icon: 'none' }); this.load()
        }).catch(() => wx.showToast({ title: '失败', icon: 'none' }))
      }
    })
  }
})
