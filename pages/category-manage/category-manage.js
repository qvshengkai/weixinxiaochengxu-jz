// pages/category-manage/category-manage.js — 管理自定义分类
const categoryService = require('../../utils/category-service');

const PRESET_EMOJIS = ['🍿','🥤','🍰','🍫','🍪','🍩','🧃','🍦','🍉','🍇','🥑','🍕','🍔','🍟','🌮','🥗','🍱','🥡','🥪','🍖','🥩','🍤','🦪','🍣','🍙','🍘','🍚','🍜','🍝','🍠','🥘','🍲','🥣','🥧','🍮','🍭','🍬','🍡','🍢','🥟','🥠','🥡','☕','🍵','🧋','🍶','🍺','🍷','🥃','🍸','🍹','🧉','🍾','🥄','🍴','🥢','🧂','🥡','🛒','🎁','🎀','🧸','🎮','🎲','🎬','🎤','🎧','🎹','🎸','🎻','🥁','🎷','🎺','🎵','🎶','🏀','⚽','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🏒','🏑','🥍','🏏','⛳','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎯','🎳','🎣','🤿','🎽','🎿','⛷️','🏂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','⛹️','🏊','🏄','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩','🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🏍️','🚲','🛴','🚏','🛣️','🛤️','🚨','🚥','🚦','🛑','🚧','⚓','⛵','🚤','🛳️','⛴️','🛥️','🚢','✈️','🛩️','🛫','🛬','🪂','💺','🚁','🚟','🚠','🚡','🛰️','🚀','🛸','🌍','🌎','🌏','🌐','🗺️','🧭','⛰️','🏔️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🧱','🪨','🪵','🛖','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','♨️','🎠','🎡','🎢','💈','🎪','🛎️','🧳','⌚','⏰','⏱️','⏲️','🕰️','🕛','🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘','🌙','🌚','🌛','🌜','🌡️','☀️','🌝','🌞','🪐','⭐','🌟','🌠','🌌','☁️','⛅','⛈️','🌤️','🌥️','🌦️','🌧️','🌨️','❄️','🌬️','💨','🌪️','🌫️','🌈','☂️','☔','⚡','❄️','🔥','💧','🌊','🎄','✨','🎋','🎍','🎎','🎏','🎐','🎑','🧧','🎀','🎁','🎗️','🎟️','🎫','🎖️','🏆','🏅','🥇','🥈','🥉','⚽','⚾','🥎','🏀','🏐','🏈','🏉','🎾','🥏','🎳','🏏','🏑','🏒','🥍','🏓','🏸','🥊','🥋','🥅','⛳','⛸️','🎣','🤿','🎽','🛹','🛼','🛷','⛷️','🏂','🏋️','🤼','🤸','⛹️','🤺','🤾','🏌️','🏇','⛹️','🏊','🏄','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩','💰','💴','💵','💶','💷','💸','💳','🧾','💹','✉️','📧','💌','📥','📤','📦','🏷️','📪','📫','📬','📭','📮','📯','📜','📃','📄','📑','🧾','📊','📈','📉','🗒️','🗓️','📆','📅','🗑️','📇','🗃️','🗳️','🗄️','📋','📁','📂','🗂️','📰','🗞️','📓','📔','📒','📕','📗','📘','📙','📚','📖','🔖','🧷','🔗','📎','🖇️','📐','📏','🧮','📌','📍','✂️','🖊️','🖋️','✒️','🖌️','🖍️','📝','✏️','🔍','🔎','🔏','🔐','🔒','🔓','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🈳','🈂','🛂','🛃','🛄','🛅','🛗','🚹','🚺','🚼','⚧️','🚻','🚮','🎦','📶','🈁','🔣','ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','#️⃣','*️⃣','⏏️','▶️','⏸️','⏯️','⏹️','⏺️','⏭️','⏮️','⏩','⏪','⏫','⏬','◀️','🔼','🔽','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','⤴️','⤵️','🔀','🔁','🔂','🔄','🔃','🎵','🎶','➕','➖','➗','✖️','💲','💱','™️','©️','®️','〰️','➰','➿','🔚','🔙','🔛','🔝','🔜','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','⬛','⬜','🟥','🟧','🟨','🟩','🟦','🟪','🟫','⬛','⬜','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢','💬','💭','🗯️','♠️','♣️','♥️','♦️','🃏','🎴','🀄','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚','🕛','🕜','🕝','🕞','🕟','🕠','🕡','🕢','🕣','🕤','🕥','🕦','🕧'];

Page({
  data: {
    statusBarH: 20,
    categories: [],
    expenseCats: [],
    incomeCats: [],
    customCount: 0,
    showAdd: false,
    newType: 'expense',
    newName: '',
    newEmoji: '🍿',
    newKeywords: '',
    emojiPage: 0,
    pageSize: 28,
    paginatedEmojis: [],
    totalEmojiPages: 1
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarH: info.statusBarHeight || 20 });
    this.updateEmojiPage(0);
    this.loadCategories();
  },

  updateEmojiPage(page) {
    const pageSize = this.data.pageSize;
    const total = Math.ceil(PRESET_EMOJIS.length / pageSize);
    const start = page * pageSize;
    this.setData({
      emojiPage: page,
      paginatedEmojis: PRESET_EMOJIS.slice(start, start + pageSize),
      totalEmojiPages: total
    });
  },

  onShow() {
    this.loadCategories();
  },

  async loadCategories() {
    try {
      const cats = await categoryService.getCategories();
      const expenseCats = cats.filter(c => c.type === 'expense');
      const incomeCats = cats.filter(c => c.type === 'income');
      const customCount = cats.filter(c => !c.isDefault).length;
      this.setData({ categories: cats, expenseCats, incomeCats, customCount });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goBack() {
    wx.navigateBack();
  },

  toggleAdd() {
    this.setData({ showAdd: !this.data.showAdd });
  },

  onTypeChange(e) {
    this.setData({ newType: e.currentTarget.dataset.type });
  },

  onNameInput(e) {
    this.setData({ newName: e.detail.value });
  },

  onKeywordsInput(e) {
    this.setData({ newKeywords: e.detail.value });
  },

  selectEmoji(e) {
    this.setData({ newEmoji: e.currentTarget.dataset.emoji });
  },

  prevEmoji() {
    const p = this.data.emojiPage;
    if (p > 0) this.updateEmojiPage(p - 1);
  },

  nextEmoji() {
    const p = this.data.emojiPage;
    const max = this.data.totalEmojiPages - 1;
    if (p < max) this.updateEmojiPage(p + 1);
  },

  async saveCategory() {
    const name = this.data.newName.trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }
    if (name.length > 6) {
      wx.showToast({ title: '名称最多 6 个字', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中' });
    try {
      await categoryService.addCategory({
        name,
        emoji: this.data.newEmoji,
        type: this.data.newType,
        keywords: this.data.newKeywords
      });
      wx.hideLoading();
      wx.showToast({ title: '已添加' });
      this.setData({
        showAdd: false,
        newName: '',
        newKeywords: '',
        newEmoji: '🍿',
        newType: 'expense'
      });
      this.loadCategories();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '添加失败', icon: 'none' });
      console.error(e);
    }
  },

  async deleteCategory(e) {
    const id = e.currentTarget.dataset.id;
    const cat = this.data.categories.find(c => c.id === id);
    if (!cat || cat.isDefault) return;
    const res = await wx.showModal({
      title: '删除分类',
      content: `确定删除「${cat.emoji} ${cat.name}」吗？已有记录不会被删除。`,
      confirmColor: '#E4789F'
    });
    if (!res.confirm) return;
    wx.showLoading({ title: '删除中' });
    try {
      const ok = await categoryService.deleteCategory(id);
      wx.hideLoading();
      if (ok) {
        wx.showToast({ title: '已删除' });
        this.loadCategories();
      } else {
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '删除失败', icon: 'none' });
      console.error(e);
    }
  }
});
