const { call } = require('../../utils/api')
Page({
  data: { venue: null, featured: [], sessions: [], color: '#9c5a3c', playing: false },
  onLoad(q) {
    if (!q.id) return
    call('getVenueHome', { venueId: q.id }).then(r => {
      if (!r || !r.ok || !r.venue) {
        wx.showModal({ title: '加载失败', content: (r && r.msg) || '未获取到节点数据', showCancel: false })
        return
      }
      this.setData({ venue: r.venue, featured: r.featured || [], sessions: r.sessions || [], color: (r.venue || {}).brandColor || '#9c5a3c' })
      if (r.venue && r.venue.name) wx.setNavigationBarTitle({ title: r.venue.name })
    }).catch((e) => { wx.showModal({ title: '加载出错', content: String(e && e.errMsg || e), showCancel: false }) })
  },
  toggleMusic() {
    const v = this.data.venue || {}
    if (!v.music) return
    if (this.data.playing) { this.stopMusic(); return }
    if (!this.audio) {
      this.audio = wx.createInnerAudioContext()
      this.audio.src = v.music
      this.audio.loop = true
      this.audio.onError(() => { this.setData({ playing: false }); wx.showToast({ title: '\u64ad\u653e\u5931\u8d25', icon: 'none' }) })
      this.audio.onEnded(() => this.setData({ playing: false }))
    }
    this.audio.play()
    this.setData({ playing: true })
  },
  stopMusic() {
    if (this.audio) { try { this.audio.stop() } catch (e) {} }
    this.setData({ playing: false })
  },
  onHide() { this.stopMusic() },
  onUnload() { if (this.audio) { try { this.audio.destroy() } catch (e) {} this.audio = null } },
  goContent(e) { wx.navigateTo({ url: '/pages/content/content?id=' + e.currentTarget.dataset.id }) },
  goSession(e) { wx.navigateTo({ url: '/pages/session/session?aid=' + e.currentTarget.dataset.aid }) },
  onShareAppMessage() { const v = this.data.venue || {}; return { title: (v.name || '\u5f52\u5c71\u6751\u843d') + (v.intro ? (' \u00b7 ' + v.intro) : ''), path: '/pages/venue/venue?id=' + (v._id || ''), imageUrl: v.cover || '' } },
  onShareTimeline() { const v = this.data.venue || {}; return { title: v.name || '\u5f52\u5c71\u6751\u843d', query: 'id=' + (v._id || '') } }
})
