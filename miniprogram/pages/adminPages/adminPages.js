const { call } = require('../../utils/api')
Page({
  data: { pages: [], pIndex: 0, cur: null, preview: '', saving: false, loaded: false },
  onLoad() {
    call('getPageAdmin').then(r => {
      if (!r.ok) { wx.showToast({ title: r.msg || '无权限', icon: 'none' }); setTimeout(() => wx.navigateBack(), 800); return }
      const pages = r.list || []
      this.setData({ pages, loaded: true })
      if (pages.length) this.pick(0)
    }).catch(() => this.setData({ loaded: true }))
  },
  pick(i) { this.setData({ pIndex: i, cur: JSON.parse(JSON.stringify(this.data.pages[i])), preview: '' }) },
  onPagePick(e) { this.pick(+e.detail.value) },
  setF(e) { const f = e.currentTarget.dataset.f; this.setData({ ['cur.' + f]: e.detail.value }) },
  // 传图：上传得 fileID(cloud://)，把 <img> 追加到 html 框
  addImg() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], success: r => {
      wx.showLoading({ title: '上传中' })
      const temp = r.tempFiles[0].tempFilePath
      const m = temp.match(/\.(png|jpg|jpeg)$/i), ext = m ? m[0] : '.jpg'
      wx.cloud.uploadFile({ cloudPath: 'pages/' + Date.now() + '-' + Math.floor(Math.random() * 1e4) + ext, filePath: temp })
        .then(res => {
          wx.hideLoading()
          call('fileLedger', { action: 'record', fileID: res.fileID, biz: 'page-img' }).catch(()=>{})
          const tag = '<img src="' + res.fileID + '" style="width:100%;border-radius:8px;margin:8px 0">'
          this.setData({ 'cur.html': (this.data.cur.html || '') + '\n' + tag })
          wx.showToast({ title: '图片已插入到末尾', icon: 'none' })
        }).catch(() => { wx.hideLoading(); wx.showToast({ title: '上传失败', icon: 'none' }) })
    } })
  },
  doPreview() { this.setData({ preview: this.data.cur.html || '' }) },
  move(e) {
    const dir = e.currentTarget.dataset.dir
    const c = this.data.cur; if (!c) return
    call('movePage', { key: c.key, dir }).then(r => {
      if (!r.ok) return wx.showToast({ title: r.msg || '到边界了', icon: 'none' })
      this.reload(c.key)
    }).catch(() => wx.showToast({ title: '移动失败，请稍后再试', icon: 'none' }))
  },
  newPage() {
    call('createPage').then(r => {
      if (!r.ok) return wx.showToast({ title: r.msg || '失败', icon: 'none' })
      wx.showToast({ title: '已新建', icon: 'none' })
      this.reload(r.key)
    }).catch(() => wx.showToast({ title: '失败', icon: 'none' }))
  },
  delPage() {
    const c = this.data.cur; if (!c) return
    wx.showModal({
      title: '删除页面', content: '确定删除"' + (c.navTitle || '此页') + '"？首页对应的卡片也会消失。',
      success: r => {
        if (!r.confirm) return
        call('deletePage', { key: c.key }).then(res => {
          if (!res.ok) return wx.showToast({ title: res.msg || '失败', icon: 'none' })
          wx.showToast({ title: '已删除', icon: 'none' }); this.reload()
        }).catch(() => wx.showToast({ title: '失败', icon: 'none' }))
      }
    })
  },
  reload(focusKey) {
    call('getPageAdmin').then(r => {
      if (!r.ok) return
      const pages = r.list || []
      let i = 0
      if (focusKey) { const f = pages.findIndex(p => p.key === focusKey); if (f >= 0) i = f }
      this.setData({ pages })
      if (pages.length) this.pick(i)
    })
  },
  save() {
    if (this.data.saving) return
    const c = this.data.cur
    this.setData({ saving: true })
    call('savePage', { key: c.key, navTitle: c.navTitle, cardTitle: c.cardTitle, cardSub: c.cardSub, html: c.html })
      .then(r => {
        this.setData({ saving: false })
        if (!r.ok) return wx.showToast({ title: r.msg || '失败', icon: 'none' })
        wx.showToast({ title: '已保存，即时生效', icon: 'none' })
        const pages = this.data.pages.slice(); pages[this.data.pIndex] = JSON.parse(JSON.stringify(c)); this.setData({ pages })
      }).catch(() => this.setData({ saving: false }))
  }
})
