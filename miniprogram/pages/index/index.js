const { call } = require('../../utils/api')
Page({
  data: {
    venues: [], shownVenues: [], venueTypes: [], curType: '', sessions: [], moments: [], loaded: false,
    heroCards: []
  },
  onLoad() { this.load() },
  onPullDownRefresh() { this.load(true) },
  load(pull) {
    call('getPageCards').then(r => this.setData({ heroCards: r.cards || [] })).catch(() => {})
    call('getNetworkHome').then(r => this.setData({
      venues: r.venues || [], shownVenues: r.venues || [], venueTypes: r.venueTypes || [], sessions: r.sessions || [], moments: r.moments || [], loaded: true
    })).catch(() => {}).then(() => { if (pull) wx.stopPullDownRefresh() })
  },
  goGuide() { wx.navigateTo({ url: '/pages/guide/guide' }) },
  goVenue(e) { wx.navigateTo({ url: '/pages/venue/venue?id=' + e.currentTarget.dataset.id }) },
  goSession(e) { wx.navigateTo({ url: '/pages/session/session?aid=' + e.currentTarget.dataset.aid }) },
  goWild() { wx.switchTab({ url: '/pages/wild/wild' }) },
  previewMo(e) { const { urls, cur } = e.currentTarget.dataset; wx.previewImage({ urls, current: cur }) },
  goManifesto(e) { wx.navigateTo({ url: '/pages/manifesto/manifesto?key=' + e.currentTarget.dataset.key }) },
  goNodesMap() { wx.navigateTo({ url: '/pages/nodesMap/nodesMap' }) },
  filterType(e) {
    const key = e.currentTarget.dataset.key
    const shown = key ? this.data.venues.filter(v => (v.typeKeys || []).indexOf(key) >= 0) : this.data.venues
    this.setData({ curType: key, shownVenues: shown })
  },
  goJoin() { wx.navigateTo({ url: '/pages/join/join' }) },
  onShareAppMessage() { return { title: '归山村落 · 一个随时可以降落的山中网络', path: '/pages/index/index' } },
  onShareTimeline() { return { title: '归山村落 · 山中各处' } }
})
