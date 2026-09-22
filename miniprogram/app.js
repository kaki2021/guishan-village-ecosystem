App({
  globalData: { user: null, openid: '' },
  _cbs: [],
  onLaunch() {
    if (!wx.cloud) { console.error('需基础库 2.2.3+'); return }
    wx.cloud.init({ env: wx.cloud.DYNAMIC_CURRENT_ENV, traceUser: true })
    this.login()
  },
  login() {
    return wx.cloud.callFunction({ name: 'login' }).then(res => {
      const r = res.result || {}
      this.globalData.openid = r.openid || ''
      this.globalData.user = r.user || null
      this._cbs.forEach(cb => cb(r)); this._cbs = []
      return r
    }).catch(e => console.error('login failed', e))
  },
  ready(cb) { this.globalData.user ? cb(this.globalData) : this._cbs.push(cb) }
})