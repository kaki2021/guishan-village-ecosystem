const { call } = require('../../utils/api')
function idx(arr, v) { const i = arr.findIndex(x => x.key === v); return i < 0 ? 0 : i }
Page({
  data: {
    venues: [], vIndex: 0, types: [], selectedTypes: [],
    coverFileID: '', coverShow: '', coverNewTemp: '',
    musicFileID: '', musicName: '', musicNewTemp: '',
    intro: '', detailHtml: '', preview: '', lat: '', lng: '', inviteCode: '',
    saving: false, loaded: false
  },
  onLoad() { this.load() },
  load() {
    Promise.all([
      call('getVenueAdmin').then(r => r).catch(() => ({ ok: false })),
      call('listCats', { kind: 'venue' }).then(r => r.list || []).catch(() => [])
    ]).then(([r, types]) => {
      if (!r.ok) { wx.showToast({ title: r.msg || '无权限', icon: 'none' }); setTimeout(() => wx.navigateBack(), 800); return }
      this.setData({ venues: r.list || [], types, loaded: true })
      this.markTypes()
      if ((r.list || []).length) this.fill(0)
    })
  },
  fill(i) {
    const v = this.data.venues[i]; if (!v) return
    this.setData({
      vIndex: i, coverFileID: v.cover || '', coverShow: v.coverUrl || '', coverNewTemp: '',
      musicFileID: v.music || '', musicName: v.music ? '已有音乐' : '', musicNewTemp: '',
      intro: v.intro || '', detailHtml: v.detailHtml || '', preview: '', lat: (v.lat === 0 || v.lat ? v.lat : ''), lng: (v.lng === 0 || v.lng ? v.lng : ''), inviteCode: v.inviteCode || '', selectedTypes: (v.venueTypes && v.venueTypes.length ? v.venueTypes : (v.venueType ? [v.venueType] : []))
    })
    this.markTypes(v.venueTypes && v.venueTypes.length ? v.venueTypes : (v.venueType ? [v.venueType] : []))
  },
  pickVenue(e) { this.fill(+e.detail.value) },
  toggleType(e) {
    const key = e.currentTarget.dataset.key
    const cur = (this.data.selectedTypes || []).slice()
    const i = cur.indexOf(key)
    if (i >= 0) cur.splice(i, 1); else cur.push(key)
    this.setData({ selectedTypes: cur })
    this.markTypes(cur)
  },
  markTypes(sel) {
    const set = sel || this.data.selectedTypes || []
    const types = (this.data.types || []).map(t => Object.assign({}, t, { on: set.indexOf(t.key) >= 0 }))
    this.setData({ types })
  },
  onIntro(e) { this.setData({ intro: e.detail.value }) },
  onHtml(e) { this.setData({ detailHtml: e.detail.value }) },
  onLat(e) { this.setData({ lat: e.detail.value }) },
  onLng(e) { this.setData({ lng: e.detail.value }) },
  chooseCover() { wx.chooseMedia({ count: 1, mediaType: ['image'], success: r => this.setData({ coverShow: r.tempFiles[0].tempFilePath, coverNewTemp: r.tempFiles[0].tempFilePath, coverFileID: '' }) }) },
  delCover() { this.setData({ coverShow: '', coverNewTemp: '', coverFileID: '' }) },
  uploadImg(temp) { const m = temp.match(/\.(png|jpg|jpeg)$/i), ext = m ? m[0] : '.jpg'; return wx.cloud.uploadFile({ cloudPath: 'venues/' + Date.now() + '-' + Math.floor(Math.random() * 1e4) + ext, filePath: temp }).then(r => { const fid = r.fileID; call('fileLedger', { action: 'record', fileID: fid, biz: 'venue-cover' }).catch(()=>{}); return fid }) },
  // 插图：上传得 fileID，把 <img> 追加到 HTML 末尾（渲染时转 https）
  addImg() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], success: r => {
      wx.showLoading({ title: '上传中' })
      this.uploadImg(r.tempFiles[0].tempFilePath).then(fileID => {
        wx.hideLoading()
        const tag = '<img src="' + fileID + '" style="width:100%;border-radius:8px;margin:8px 0">'
        this.setData({ detailHtml: (this.data.detailHtml || '') + '\n' + tag })
        wx.showToast({ title: '图片已插入末尾', icon: 'none' })
      }).catch(() => { wx.hideLoading(); wx.showToast({ title: '上传失败', icon: 'none' }) })
    } })
  },
  doPreview() { this.setData({ preview: this.data.detailHtml || '' }) },
  genCode() {
    const v = this.data.venues[this.data.vIndex]; if (!v) return
    wx.showModal({
      title: this.data.inviteCode ? '重新生成邀请码' : '生成邀请码',
      content: this.data.inviteCode ? '重新生成后，旧邀请码立即失效。确定？' : '为本节点生成一个邀请码，发给想加入的人。',
      success: r => {
        if (!r.confirm) return
        wx.showLoading({ title: '生成中' })
        call('genInviteCode', { venueId: v._id }).then(res => {
          wx.hideLoading()
          if (!res.ok) return wx.showToast({ title: res.msg || '失败', icon: 'none' })
          this.setData({ inviteCode: res.code })
          wx.showToast({ title: '已生成', icon: 'success' })
        }).catch(() => { wx.hideLoading(); wx.showToast({ title: '失败', icon: 'none' }) })
      }
    })
  },
  copyCode() { if (this.data.inviteCode) wx.setClipboardData({ data: this.data.inviteCode }) },
  chooseMusic() {
    wx.chooseMessageFile({ count: 1, type: 'file', extension: ['mp3', 'm4a', 'wav', 'aac'], success: r => {
      const f = r.tempFiles[0]
      if (f.size > 10 * 1024 * 1024) return wx.showToast({ title: '音乐请小于10MB', icon: 'none' })
      this.setData({ musicNewTemp: f.path, musicName: f.name || '已选择音乐', musicFileID: '' })
    } })
  },
  delMusic() { this.setData({ musicNewTemp: '', musicName: '', musicFileID: '' }) },
  uploadMusic(temp) { const m = temp.match(/\.(mp3|m4a|wav|aac)$/i), ext = m ? m[0] : '.mp3'; return wx.cloud.uploadFile({ cloudPath: 'venue-music/' + Date.now() + '-' + Math.floor(Math.random() * 1e4) + ext, filePath: temp }).then(r => { const fid = r.fileID; call('fileLedger', { action: 'record', fileID: fid, biz: 'venue-music' }).catch(()=>{}); return fid }) },
  save() {
    if (this.data.saving) return
    const v = this.data.venues[this.data.vIndex]; if (!v) return
    this.setData({ saving: true })
    const d = this.data
    const coverP = d.coverNewTemp ? this.uploadImg(d.coverNewTemp) : Promise.resolve(d.coverFileID || '')
    const musicP = d.musicNewTemp ? this.uploadMusic(d.musicNewTemp) : Promise.resolve(d.musicFileID || '')
    Promise.all([coverP, musicP]).then(([cover, music]) => call('adminSaveVenue', {
      venueId: v._id, intro: d.intro, venueTypes: d.selectedTypes, cover, music, detailHtml: d.detailHtml, lat: d.lat, lng: d.lng
    })).then((r) => {
      const g = (r && r.diag) || {}
      wx.showModal({
        title: '保存诊断',
        content: '本地框内容长度:' + (d.detailHtml || '').length + '\n后端收到:' + (g.recv_detailHtmlLen||0) + '\n清洗后:' + (g.afterSanitizeLen||0) + '\n已存入:' + (g.saved_detailHtmlLen||0),
        showCancel: false,
        success: () => { wx.showToast({ title: '已保存', icon: 'success' }); setTimeout(() => wx.navigateBack(), 600) }
      })
    }).catch(() => this.setData({ saving: false }))
  }
})
