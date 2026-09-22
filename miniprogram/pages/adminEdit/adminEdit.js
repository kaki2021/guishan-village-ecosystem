const { call } = require('../../utils/api')
const REPEATS = [{ label: '单次', v: 'once' }, { label: '每周', v: 'weekly' }, { label: '每天', v: 'daily' }, { label: '每月', v: 'monthly' }]
const SS = [{ label: '可报名', v: 'open' }, { label: '草稿', v: 'draft' }]
const CS = [{ label: '已发布', v: 'published' }, { label: '草稿', v: 'draft' }]
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
function idx(arr, v) { const i = arr.findIndex(x => x.v === v); return i < 0 ? 0 : i }

Page({
  data: {
    type: 'activity', venueId: '', venueName: '', id: '',
    CATS: [], TYPES: [], SS, CS, REPEATS, WEEKDAYS,
    title: '',
    // 活动（统一：单次/重复）
    catIndex: 0, repeatIndex: 0, date: '', weekdayIndex: 6, monthday: '', clock: '07:00',
    capacity: '', introHtml: '', ssIndex: 0, introPreview: '',
    cover: '', coverIsCloud: false,
    // 内容
    typeIndex: 0, bodyHtml: '', solarTerm: '', csIndex: 0, preview: '',
    saving: false
  },
  onLoad(q) {
    const type = q.type === 'content' ? 'content' : 'activity'
    this.setData({ type, venueId: q.venueId || '', venueName: decodeURIComponent(q.venueName || ''), id: q.id || '' })
    wx.setNavigationBarTitle({ title: (q.id ? '编辑' : '新建') + (type === 'content' ? '内容' : '活动') })
    const jobs = [
      call('listCats', { kind: 'activity' }).then(r => this.setData({ CATS: (r.list || []).map(c => ({ label: c.name, v: c.key })) })).catch(() => {}),
      call('listCats', { kind: 'content' }).then(r => this.setData({ TYPES: (r.list || []).map(c => ({ label: c.name, v: c.key })) })).catch(() => {})
    ]
    Promise.all(jobs).then(() => { if (q.id) this.prefill() })
  },
  prefill() {
    if (this.data.type === 'activity') {
      call('adminListActivities', { venueId: this.data.venueId }).then(r => {
        const it = (r.list || []).find(x => x._id === this.data.id); if (!it) return
        this.setData({
          title: it.title, catIndex: idx(this.data.CATS, it.category), repeatIndex: idx(REPEATS, it.repeat || 'once'),
          date: it.date || '', weekdayIndex: (it.weekday === 0 || it.weekday) ? Number(it.weekday) : 6,
          monthday: it.monthday ? String(it.monthday) : '', clock: it.clock || '07:00',
          capacity: String(it.capacity || ''), introHtml: it.introHtml || '', ssIndex: idx(SS, it.status),
          cover: it.cover || '', coverIsCloud: !!it.cover
        })
      }).catch(() => {})
    } else {
      call('adminList', { venueId: this.data.venueId }).then(r => {
        const it = (r.contents || []).find(x => x._id === this.data.id); if (!it) return
        const raw = it.raw
        let html = raw.bodyHtml || ''
        if (!html && Array.isArray(raw.body) && raw.body.length) {
          html = raw.body.map(b => b.type === 'img' ? ('<img src="' + b.src + '" style="width:100%;border-radius:8px;margin:8px 0">') : ('<p>' + (b.text || '') + '</p>')).join('')
        }
        this.setData({ title: raw.title, typeIndex: idx(this.data.TYPES, raw.type), bodyHtml: html, solarTerm: raw.solarTerm, csIndex: idx(CS, raw.status), cover: raw.cover || '', coverIsCloud: !!raw.cover })
      }).catch(() => {})
    }
  },
  onTitle(e) { this.setData({ title: e.detail.value }) },
  onCat(e) { this.setData({ catIndex: +e.detail.value }) },
  onRepeat(e) { this.setData({ repeatIndex: +e.detail.value }) },
  onDate(e) { this.setData({ date: e.detail.value }) },
  onWeekday(e) { this.setData({ weekdayIndex: +e.detail.value }) },
  onMonthday(e) { this.setData({ monthday: e.detail.value }) },
  onClock(e) { this.setData({ clock: e.detail.value }) },
  onCap(e) { this.setData({ capacity: e.detail.value }) },
  onSs(e) { this.setData({ ssIndex: +e.detail.value }) },
  // 活动介绍 HTML
  onIntroHtml(e) { this.setData({ introHtml: e.detail.value }) },
  addIntroImg() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], success: r => {
      wx.showLoading({ title: '上传中' })
      this.uploadImg(r.tempFiles[0].tempFilePath).then(fileID => {
        wx.hideLoading()
        const tag = '<img src="' + fileID + '" style="width:100%;border-radius:8px;margin:8px 0">'
        this.setData({ introHtml: (this.data.introHtml || '') + '\n' + tag })
        wx.showToast({ title: '图片已插入末尾', icon: 'none' })
      }).catch(() => { wx.hideLoading(); wx.showToast({ title: '上传失败', icon: 'none' }) })
    } })
  },
  previewIntro() { this.setData({ introPreview: this.data.introHtml || '' }) },
  // 内容
  onType(e) { this.setData({ typeIndex: +e.detail.value }) },
  onBodyHtml(e) { this.setData({ bodyHtml: e.detail.value }) },
  addBodyImg() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], success: r => {
      wx.showLoading({ title: '上传中' })
      this.uploadImg(r.tempFiles[0].tempFilePath).then(fileID => {
        wx.hideLoading()
        const tag = '<img src="' + fileID + '" style="width:100%;border-radius:8px;margin:8px 0">'
        this.setData({ bodyHtml: (this.data.bodyHtml || '') + '\n' + tag })
        wx.showToast({ title: '图片已插入末尾', icon: 'none' })
      }).catch(() => { wx.hideLoading(); wx.showToast({ title: '上传失败', icon: 'none' }) })
    } })
  },
  previewBody() { this.setData({ preview: this.data.bodyHtml || '' }) },
  onTerm(e) { this.setData({ solarTerm: e.detail.value }) },
  onCs(e) { this.setData({ csIndex: +e.detail.value }) },
  // 封面
  chooseCover() { wx.chooseMedia({ count: 1, mediaType: ['image'], success: r => this.setData({ cover: r.tempFiles[0].tempFilePath, coverIsCloud: false }) }) },
  delCover() { this.setData({ cover: '', coverIsCloud: false }) },
  uploadImg(temp) { const m = temp.match(/\.(png|jpg|jpeg)$/i), ext = m ? m[0] : '.jpg'; return wx.cloud.uploadFile({ cloudPath: 'covers/' + Date.now() + '-' + Math.floor(Math.random() * 1e4) + ext, filePath: temp }).then(r => { const fid = r.fileID; call('fileLedger', { action: 'record', fileID: fid, biz: 'edit-img' }).catch(()=>{}); return fid }) },
  coverFileID() { const d = this.data; return (d.cover && !d.coverIsCloud) ? this.uploadImg(d.cover) : Promise.resolve(d.coverIsCloud ? d.cover : '') },
  save() {
    if (this.data.saving) return
    const d = this.data
    if (!d.title.trim()) return wx.showToast({ title: '请填标题', icon: 'none' })
    const repeat = REPEATS[d.repeatIndex].v
    if (d.type === 'activity') {
      if (repeat === 'once' && !d.date) return wx.showToast({ title: '请选日期', icon: 'none' })
      if (!(parseInt(d.capacity, 10) > 0)) return wx.showToast({ title: '请填名额', icon: 'none' })
    }
    this.setData({ saving: true })
    const done = () => { wx.showToast({ title: '已保存', icon: 'success' }); setTimeout(() => wx.navigateBack(), 600) }
    const fail = () => this.setData({ saving: false })

    if (d.type === 'activity') {
      this.coverFileID().then(cover => call('adminSaveActivity', {
        id: d.id || undefined, venueId: d.venueId, title: d.title, category: (d.CATS[d.catIndex] || {}).v,
        repeat, date: d.date, weekday: d.weekdayIndex, monthday: d.monthday, clock: d.clock,
        capacity: d.capacity, introHtml: d.introHtml, cover, status: SS[d.ssIndex].v
      })).then(r => { if (r && r.ok) done(); else { fail(); wx.showToast({ title: (r && r.msg) || '失败', icon: 'none' }) } }).catch(fail)
    } else {
      this.coverFileID().then(cover => call('adminSaveContent', {
        id: d.id || undefined, venueId: d.venueId, type: (d.TYPES[d.typeIndex] || {}).v, title: d.title,
        bodyHtml: d.bodyHtml, cover, solarTerm: d.solarTerm, status: CS[d.csIndex].v
      })).then(r => { if (r && r.ok) done(); else { fail(); wx.showToast({ title: (r && r.msg) || '失败', icon: 'none' }) } }).catch(fail)
    }
  }
})
