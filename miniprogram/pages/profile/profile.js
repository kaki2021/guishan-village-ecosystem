const { call } = require('../../utils/api')
Page({
  data: { avatarUrl: '', avatarFile: '', nickName: '', saving: false },
  onLoad() {
    const u = getApp().globalData.user
    if (u) this.setData({ nickName: u.nickName || '', avatarUrl: u.avatarUrl || '' })
  },
  onChooseAvatar(e) { this.setData({ avatarUrl: e.detail.avatarUrl, avatarFile: e.detail.avatarUrl }) },
  onNick(e) { this.setData({ nickName: e.detail.value }) },
  save() {
    if (this.data.saving) return
    if (!this.data.nickName.trim()) return wx.showToast({ title: '起个名字吧', icon: 'none' })
    this.setData({ saving: true })
    const finish = (fileId) => {
      const avatarUrl = fileId || (this.data.avatarUrl.indexOf('cloud://') === 0 ? this.data.avatarUrl : '')
      call('updateProfile', { nickName: this.data.nickName, avatarUrl }).then(r => {
        const app = getApp()
        if (app.globalData.user) { app.globalData.user.nickName = r.nickName; app.globalData.user.avatarUrl = r.avatarUrl }
        wx.showToast({ title: '已保存', icon: 'success' }); setTimeout(() => wx.navigateBack(), 600)
      }).catch(() => this.setData({ saving: false }))
    }
    const f = this.data.avatarFile
    if (f && f.indexOf('cloud://') !== 0) {
      const m = f.match(/\.(png|jpg|jpeg)$/i), ext = m ? m[0] : '.png'
      wx.cloud.uploadFile({ cloudPath: 'avatars/' + Date.now() + ext, filePath: f,
        success: res => { call('fileLedger', { action: 'record', fileID: res.fileID, biz: 'avatar' }).catch(()=>{}); finish(res.fileID) },
        fail: () => { wx.showToast({ title: '头像上传失败', icon: 'none' }); this.setData({ saving: false }) } })
    } else { finish('') }
  }
})
