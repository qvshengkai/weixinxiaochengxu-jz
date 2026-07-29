Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/record/record', text: '首页', icon: '🌙' },
      { pagePath: '/pages/stats/stats', text: '统计', icon: '✨' },
      { pagePath: '/pages/bill/bill', text: '账单', icon: '📖' },
      { pagePath: '/pages/me/me', text: '我的', icon: '☁️' }
    ]
  },
  methods: {
    switchTab(e) {
      const url = e.currentTarget.dataset.path;
      wx.switchTab({ url });
    }
  }
});
