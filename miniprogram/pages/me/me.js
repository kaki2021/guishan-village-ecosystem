const { call } = require('../../utils/api')
const RANK_THEME = {
  '仓灵': { bg: '#07090D', title: '#C89B4B', no: '#BFAE8A', info: '#E8E2D6' },
  '亓灵': { bg: '#4A0F0F', title: '#F2C26B', no: '#E1B97A', info: '#F6E7D0' },
  '止灵': { bg: '#0F3B3A', title: '#D8C07A', no: '#C8B48A', info: '#E9E4D8' },
  '玄灵': { bg: '#F2F0E8', title: '#8A6A3B', no: '#7A6A55', info: '#2F2A24' },
  '襾灵': { bg: '#D8A63A', title: '#4A2E12', no: '#5A3A18', info: '#2F2215' },
  '少灵': { bg: '#5f7060', title: '#fdfdfa', no: '#e3c894', info: '#dde4d9' }
}
Page({
  data: { profile: {}, venues: [], hasAny: false, isAdmin: false, myRoles: [], wildStamps: [], rankTitle: '少灵', fclNo: '', fclSeq: 0, fclDate: '', theme: { bg: '#5f7060', title: '#fdfdfa', no: '#e3c894', info: '#dde4d9' } },
  onShow() { this.load() },
  load() {
    call('getMyProfile').then(r => {
      const vs = r.venues || []
      const fclNo = r.fclNo || ''
      let fclSeq = r.fclSeq || 0
      if (!fclSeq && fclNo) { const m = fclNo.match(/(\d+)/); if (m) fclSeq = parseInt(m[1], 10) }
      this.setData({ profile: r.profile || {}, venues: vs, hasAny: vs.length > 0, isAdmin: !!r.canManage, myRoles: r.myRoles || [], wildStamps: r.wildStamps || [], rankTitle: r.rankTitle || '少灵', fclNo: fclNo, fclSeq: fclSeq, fclDate: r.fclDate || '', theme: RANK_THEME[r.rankTitle || '少灵'] || RANK_THEME['少灵'] })
    }).catch(() => {})
  },
  goProfile() { wx.navigateTo({ url: '/pages/profile/profile' }) },
  openInvite() {
    wx.showModal({
      title: '输入邀请码', editable: true, placeholderText: '如 ABC-DEF',
      success: r => {
        if (!r.confirm || !(r.content || '').trim()) return
        wx.showLoading({ title: '验证中' })
        call('redeemInvite', { code: r.content.trim() }).then(res => {
          wx.hideLoading()
          if (!res.ok) return wx.showToast({ title: res.msg || '邀请码无效', icon: 'none' })
          wx.showModal({ title: '欢迎加入', content: '你已成为「' + res.venueName + '」的仓灵' + (res.fclNo ? ('，编号 ' + res.fclNo) : '') + '。', showCancel: false, success: () => this.load() })
        }).catch(() => { wx.hideLoading(); wx.showToast({ title: '失败', icon: 'none' }) })
      }
    })
  },
  goMine() { wx.navigateTo({ url: '/pages/mysignups/mysignups' }) },
  goGuide() { wx.navigateTo({ url: '/pages/guide/guide' }) },
  goNetwork() { wx.switchTab({ url: '/pages/index/index' }) },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }) }
})
