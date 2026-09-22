const { call } = require('../../utils/api')
Page({
  data: {
    markers: [], latitude: 29.02, longitude: 107.18, // 金佛山附近默认中心
    nodes: [], loaded: false, hasGeo: false, sel: null
  },
  onLoad() {
    call('getNetworkHome').then(r => {
      const vs = (r.venues || []).filter(v => typeof v.lat === 'number' && typeof v.lng === 'number')
      if (!vs.length) { this.setData({ loaded: true, hasGeo: false }); return }
      const markers = vs.map((v, i) => ({
        id: i, latitude: v.lat, longitude: v.lng, width: 36, height: 36,
        callout: {
          content: v.name, display: 'ALWAYS', fontSize: 15, borderRadius: 20,
          padding: 12, bgColor: v.brandColor || '#9c5a3c', color: '#ffffff',
          borderWidth: 3, borderColor: '#ffffff', textAlign: 'center', anchorY: -2
        }
      }))
      // 中心取所有点的平均
      const cLat = vs.reduce((s, v) => s + v.lat, 0) / vs.length
      const cLng = vs.reduce((s, v) => s + v.lng, 0) / vs.length
      this.setData({ markers, nodes: vs, latitude: cLat, longitude: cLng, loaded: true, hasGeo: true })
    }).catch(() => this.setData({ loaded: true }))
  },
  onMarkerTap(e) {
    const i = e.detail.markerId
    const v = this.data.nodes[i]; if (v) this.setData({ sel: v })
  },
  goVenue() { const v = this.data.sel; if (v) wx.navigateTo({ url: '/pages/venue/venue?id=' + v._id }) },
  navTo() {
    const v = this.data.sel; if (!v) return
    wx.openLocation({ latitude: v.lat, longitude: v.lng, name: v.name, scale: 14 })
  },
  closeCard() { this.setData({ sel: null }) }
})