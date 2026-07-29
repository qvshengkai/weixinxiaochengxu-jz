// app.js
App({
  globalData: {
    openid: null,
    // 云开发环境 ID（微信开发者工具 -> 云开发 -> 环境设置）
    env: 'cloud1-d2g32eu370f4219df',
    // 隐私授权：resolve 回调与当前活动页面的隐私组件实例
    privacyResolve: null,
    activePrivacyComp: null
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('当前基础库不支持云开发，请使用 2.2.3 或以上版本');
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true
    });
    this.ensureLogin();

    // 隐私合规：监听隐私接口调用，触发授权弹窗（app.json 已开启 __usePrivacyCheck__）
    if (wx.onNeedPrivacyAuthorize) {
      wx.onNeedPrivacyAuthorize((resolve) => {
        const app = getApp();
        app.globalData.privacyResolve = resolve;
        if (app.globalData.activePrivacyComp) {
          app.globalData.activePrivacyComp.setData({ show: true });
        }
      });
    }
  },

  // 调用 login 云函数拿到 openid（无需用户授权，静默登录）
  ensureLogin() {
    wx.cloud.callFunction({ name: 'login' })
      .then(res => {
        this.globalData.openid = res.result.openid;
      })
      .catch(err => console.error('login failed', err));
  }
});
