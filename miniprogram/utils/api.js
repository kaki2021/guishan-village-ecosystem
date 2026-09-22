function call(name, data) {
  return wx.cloud.callFunction({ name: name, data: data || {} }).then(function (res) {
    var r = res.result
    if (r && r.ok === false) { wx.showToast({ title: r.msg || '操作失败', icon: 'none' }); return Promise.reject(r) }
    return r
  }).catch(function (err) {
    if (!(err && err.ok === false)) wx.showToast({ title: '网络异常', icon: 'none' })
    return Promise.reject(err)
  })
}
module.exports = { call: call }
