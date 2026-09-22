const { call } = require('../../utils/api')
Page({
  data: { activity: null, sessions: [], busyDate: '', subscribeTemplateId: '' },
  onLoad(q) { this.aid = q.aid; this.load() },
  load() {
    if (!this.aid) return
    call('getActivitySession', { activityId: this.aid }).then(r => {
      if (!r.ok) { wx.showToast({ title: r.msg || '加载失败', icon: 'none' }); return }
      this.setData({
        activity: r.activity,
        sessions: r.sessions || [],
        subscribeTemplateId: r.subscribeTemplateId || ''
      })
    }).catch(() => {})
  },
  enroll(e) {
    const date = e.currentTarget.dataset.date
    const s = this.data.sessions.find(x => x.date === date)
    if (!s || this.data.busyDate) return
    if (s.full) return wx.showToast({ title: '这一场已满', icon: 'none' })
    const TMPL = this.data.subscribeTemplateId
    // 未配置订阅模板时仍允许报名，只是不请求消息授权。
    if (!TMPL) return this.doEnroll(date, false)
    wx.requestSubscribeMessage({
      tmplIds: [TMPL],
      success: res => this.doEnroll(date, res[TMPL] === 'accept'),
      fail: () => this.doEnroll(date, false)
    })
  },
  doEnroll(date, subscribed) {
    if (this.data.busyDate) return
    this.setData({ busyDate: date })
    call('enrollActivity', { activityId: this.aid, date, subscribed }).then(r => {
      this.setData({ busyDate: '' })
      if (!r.ok) return wx.showToast({ title: r.msg || '报名失败', icon: 'none' })
      wx.showToast({ title: '报名成功', icon: 'success' })
      this.load()
    }).catch(() => this.setData({ busyDate: '' }))
  },
  cancel(e) {
    const date = e.currentTarget.dataset.date
    wx.showModal({
      title: '取消报名', content: '确定取消这一场的报名？',
      success: r => {
        if (!r.confirm) return
        this.setData({ busyDate: date })
        call('cancelEnroll', { activityId: this.aid, date }).then(res => {
          this.setData({ busyDate: '' })
          if (!res.ok) return wx.showToast({ title: res.msg || '失败', icon: 'none' })
          wx.showToast({ title: '已取消', icon: 'none' })
          this.load()
        }).catch(() => this.setData({ busyDate: '' }))
      }
    })
  },
  onShareAppMessage() {
    const a = this.data.activity || {}
    return { title: (a.title || '归山村落') + (a.venueName ? (' · ' + a.venueName) : ''), path: '/pages/session/session?aid=' + (this.aid || '') }
  }
})
