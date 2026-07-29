// components/privacy-modal/privacy-modal.js
// 隐私授权弹窗：首次进入或调用隐私接口时，弹出《隐私保护指引》同意框。
// 依赖 app.json 的 __usePrivacyCheck__: true 与 app.js 的全局监听。
Component({
  options: {
    styleIsolation: 'shared',
    multipleSlots: false
  },

  data: {
    show: false,
    privacyContractName: '《隐私保护指引》'
  },

  lifetimes: {
    attached() {
      const app = getApp();
      if (!app) return;
      // 注册为当前活动页面的隐私组件，供 app.js 全局监听回调触发显示
      app.globalData.activePrivacyComp = this;

      // 首次进入：检测是否需要授权（冷启动也可能处于未授权状态）
      if (wx.getPrivacySetting) {
        wx.getPrivacySetting({
          success: (res) => {
            if (res.needAuthorization) {
              this.setData({
                show: true,
                privacyContractName: res.privacyContractName || '《隐私保护指引》'
              });
            }
          },
          fail: () => {}
        });
      }
    },

    detached() {
      const app = getApp();
      if (app && app.globalData.activePrivacyComp === this) {
        app.globalData.activePrivacyComp = null;
      }
    }
  },

  methods: {
    // 占位：阻止遮罩点击冒泡，不关闭弹窗
    noop() {},

    // 打开微信官方隐私协议全文
    openContract() {
      if (wx.openPrivacyContract) {
        wx.openPrivacyContract({
          fail: () => wx.showToast({ title: '打开失败', icon: 'none' })
        });
      }
    },

    // 用户点击「同意并继续」：必须使用 open-type="agreePrivacyAuthorization" 的按钮，
    // 微信才会记录授权状态，避免每次调用隐私接口都重新弹窗。
    agree(e) {
      const app = getApp();
      if (app && app.globalData.privacyResolve) {
        app.globalData.privacyResolve({ event: 'agree', buttonId: 'agree-btn' });
        app.globalData.privacyResolve = null;
      }
      this.setData({ show: false });
    }
  }
});
