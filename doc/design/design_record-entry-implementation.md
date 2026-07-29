# 首页记账弹层交互 - 实现计划

> 版本：v1.0
> 创建时间：2026-07-27
> 状态：已完成
> 最后更新：2026-07-27

**目标：** 将首页改为点击触发的底部记账面板，提供纯数字金额键盘、独立语音按钮和面板内分类选择。

**架构：** 以纯函数 `utils/record-entry-state.js` 管理弹层和分类选择状态；`pages/record/record.js` 仅接收用户事件、调用状态转换并保留现有云数据库保存与语音识别逻辑。WXML 只渲染首页入口、记账面板与分类选择层。

**技术栈：** 原生微信小程序 WXML/WXSS/JavaScript，Node.js 内置 `node:test`。

---

### 任务 1：定义并验证交互状态转换

**文件：**

- 新建：`tests/record-entry-state.test.js`
- 新建：`utils/record-entry-state.js`

- [ ] 编写失败测试：验证初始状态关闭两个弹层；打开记账面板后分类层关闭；选择分类后仅关闭分类层并保留记账面板。

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRecordEntryState, transitionRecordEntry } = require('../utils/record-entry-state');

test('selecting a category returns to the amount panel', () => {
  let state = createRecordEntryState('food');
  state = transitionRecordEntry(state, { type: 'OPEN_ENTRY' });
  state = transitionRecordEntry(state, { type: 'OPEN_CATEGORY_PICKER' });
  state = transitionRecordEntry(state, { type: 'SELECT_CATEGORY', categoryId: 'traffic' });
  assert.deepEqual(state, { entryVisible: true, categoryPickerVisible: false, categoryId: 'traffic' });
});
```

- [x] 运行 `node --test tests/record-entry-state.test.js`，确认因模块不存在失败。
- [x] 实现 `createRecordEntryState` 与 `transitionRecordEntry`，仅支持 `OPEN_ENTRY`、`CLOSE_ENTRY`、`OPEN_CATEGORY_PICKER`、`CLOSE_CATEGORY_PICKER`、`SELECT_CATEGORY`。
- [x] 再次运行同一命令，确认通过。

### 任务 2：首页入口、底部记账面板与分类层

**文件：**

- 修改：`pages/record/record.js`
- 修改：`pages/record/record.wxml`
- 修改：`pages/record/record.wxss`
- 修改：`components/amount-keyboard/amount-keyboard.wxml`
- 修改：`components/amount-keyboard/amount-keyboard.wxss`

- [x] 将页面数据加入 `entryVisible`、`categoryPickerVisible`，并通过任务 1 的纯函数处理打开、关闭和分类选择。
- [x] 用底部“记一笔”入口替换首页常驻键盘；点击后显示包含金额、分类、日期、备注、纯数字键盘、语音与保存按钮的底部面板。
- [x] 让分类字段打开分类选择层；选择后关闭该层并回到金额面板。
- [x] 保留现有 `startVoice`、`applyVoice`、`save` 数据语义；保存成功后关闭面板，失败时保留用户输入。
- [x] 键盘组件只保留 `0-9`、`.`、`del` 键；语音与保存移至页面面板的独立按钮。

### 任务 3：静态与行为验证

**文件：**

- 修改：`doc/prototype/prototype_record-entry-interaction.md`

- [x] 运行 `node --test tests/record-entry-state.test.js`。
- [x] 运行 `node --check pages/record/record.js`、`node --check utils/record-entry-state.js`、`node --check components/amount-keyboard/amount-keyboard.js`。
- [x] 检查 WXML 中：首页无常驻 `amount-keyboard`，仅底部面板内使用；语音按钮在首页入口和面板内均存在；分类选择层有关闭路径。
- [x] 将原型文档状态更新为已确认并写入已实现范围。

---
## 验收标准

- 首页首次进入不展示完整数字键盘。
- 点击“记一笔”打开底部面板；点遮罩或取消可关闭。
- 分类选择不跳转页面，选中分类后返回金额输入。
- 首页与弹层的语音入口都复用原有语音识别并只回填、不自动保存。
- 保存成功关闭面板；保存失败保留当前表单。
