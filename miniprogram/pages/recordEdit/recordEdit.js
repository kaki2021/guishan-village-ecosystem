const { call } = require('../../utils/api')
Page({
  data: { tags: [], catKey: '', newTag: null, text: '', photos: [], submitting: false, recognizing: false, aiTip: '' },
  onLoad() {
    wx.cloud.database().collection('categories').where({ status: 'approved' }).orderBy('order', 'asc').get()
      .then(r => { const tags = r.data || []; this.setData({ tags, catKey: tags.length ? tags[0].key : '' }) }).catch(() => {})
  },
  pickCat(e) { this.setData({ catKey: e.currentTarget.dataset.key, newTag: null, aiTip: '' }) },
  pickNew() { this.setData({ catKey: '' }) }, // 选中 AI 新标签（newTag 已在）
  onText(e) { this.setData({ text: e.detail.value }) },
  choose() {
    const left = 9 - this.data.photos.length
    if (left <= 0) return
    wx.chooseMedia({ count: left, mediaType: ['image'], success: res => {
      const add = res.tempFiles.map(f => ({ temp: f.tempFilePath, fileID: '' }))
      const had = this.data.photos.length
      this.setData({ photos: this.data.photos.concat(add) })
      if (had === 0) this.recognize(true)
    } })
  },
  delPhoto(e) { const i = +e.currentTarget.dataset.i; const p = this.data.photos.slice(); p.splice(i, 1); this.setData({ photos: p }) },
  uploadOne(temp) {
    const m = temp.match(/\.(png|jpg|jpeg)$/i), ext = m ? m[0] : '.jpg'
    return wx.cloud.uploadFile({ cloudPath: 'records/' + Date.now() + '-' + Math.floor(Math.random() * 1e4) + ext, filePath: temp }).then(r => { const fid = r.fileID; call('fileLedger', { action: 'record', fileID: fid, biz: 'record' }).catch(()=>{}); return fid })
  },
  recognize(auto) {
    if (this.data.recognizing || !this.data.photos.length) { if (!auto) wx.showToast({ title: '先拍/选张照片', icon: 'none' }); return }
    this.setData({ recognizing: true, aiTip: 'AI 识别中…' })
    const p0 = this.data.photos[0]
    const go = (fileID) => {
      call('recognizePhoto', { fileID }).then(r => {
        const upd = { recognizing: false }
        if (r.tag) {
          const hit = this.data.tags.find(t => t.name === r.tag)
          if (hit && !r.isNew) { upd.catKey = hit.key; upd.newTag = null } // 复用已有标签
          else { upd.newTag = { name: r.tag, icon: r.icon || '🌿' }; upd.catKey = '' } // AI 提议新标签
          if (r.guess && !this.data.text.trim()) upd.text = r.guess
          upd.aiTip = 'AI 觉得：' + (r.isNew && !hit ? '新标签【' + r.tag + '】 ' : '【' + r.tag + '】 ') + (r.guess || '') + '（可改）'
        } else { upd.aiTip = r.guess || '没认出来，手动选个标签吧' }
        this.setData(upd)
      }).catch(() => this.setData({ recognizing: false, aiTip: '识别没成功，手动选一下也行' }))
    }
    if (p0.fileID) go(p0.fileID)
    else this.uploadOne(p0.temp).then(fid => { const ph = this.data.photos.slice(); ph[0].fileID = fid; this.setData({ photos: ph }); go(fid) }).catch(() => this.setData({ recognizing: false, aiTip: '' }))
  },
  submit() {
    if (this.data.submitting) return
    const d = this.data
    if (!d.catKey && !d.newTag) return wx.showToast({ title: '选个标签', icon: 'none' })
    if (!d.text.trim() && !d.photos.length) return wx.showToast({ title: '写点或拍点', icon: 'none' })
    this.setData({ submitting: true })
    const ups = d.photos.map(p => p.fileID ? Promise.resolve(p.fileID) : this.uploadOne(p.temp))
    Promise.all(ups).then(fileIDs => {
      const payload = { text: d.text, images: fileIDs }
      if (d.catKey) payload.categoryKey = d.catKey
      else { payload.newTagName = d.newTag.name; payload.newTagIcon = d.newTag.icon }
      return call('submitRecord', payload)
    }).then(r => { wx.showToast({ title: r.status === 'checking' ? '已提交·图片审核中' : '已记下', icon: 'none' }); setTimeout(() => wx.navigateBack(), 800) })
      .catch(() => this.setData({ submitting: false }))
  }
})
