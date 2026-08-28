## 2.3.6.2
* **修复弹层位置不对（流内展开在 flex 容器里排到触发器旁边）**：改回 `position:absolute` 浮在触发器正下方（真正下拉位置），保留下方空间不足自动翻向上的逻辑，root 去掉 `overflow:auto` 避免干扰浮层。注意：弹层浮出视觉框，若切片器视觉高度不足仍会被 iframe `overflow:hidden` 裁切——**需把视觉元素在报表里拉高（建议 ≥ 触发器 30px + 弹层约 210px ≈ 250px）**，列表即完整显示在触发器正下方。GUID 不变，兼容热加载升级。

## 2.3.6.1
* **修复大面板「点了不弹出/被裁切看不见」**：2.3.6.0 弹层用 `position:absolute` 相对 root 向下展开，若视觉容器高度不足即被 iframe `overflow:hidden` 裁掉，表现为「没有弹出列表」。改回**流内展开**（弹层作为正常元素排在触发器下方），root 加 `overflow:auto`，弹层限高（`视觉高度 - 触发器高度 - 间距`）内部滚动，确保无论视觉多矮列表都可见。2 列网格暗色面板样式保持不变。GUID 不变，兼容热加载升级。

## 2.3.6.0
* **放弃 openModalDialog，改回自定义 div 大面板（2 列网格），类似原图暗色面板样式**：
  * 删除 `src/PresetDialog.ts` 及所有 `openModalDialog`/`DialogAction`/`VisualDialogPositionType` 调用，移除对模态框 API 的依赖。
  * 弹层 `.drs-popup` 改回 `position:absolute` 相对 root 定位，内部用 `.drs-popup-grid`（CSS Grid 2 列）布局 5 个预设选项（本月/上月/近7天/近15天/近30天），选项数为奇数时最后一个自动占满整行。
  * 选项样式改为暗色卡片：默认半透明白底、hover 只变字色（背景轻微提亮）、选中项用强调蓝底+边框+发光，整体接近原图的网格面板观感（不照抄，仅取风格）。
  * 保留自动翻转（下方空间不足翻向上）+ 限高内部滚动，尽量在视觉框内自容纳；hover 只变字色、格式面板控制色等逻辑不变。GUID 不变，兼容热加载升级。

## 2.3.5.0
* **结合方案：默认网页下拉外观 + 矮视觉自动兜底模态框**：
  * 点击触发器先测量视觉可用高度：若 `视觉高度 ≥ 触发器高 + 弹层高(5×38+16)`，则**直接展开视觉内 div 下拉**——无遮罩、紧贴触发器下方、纯网页下拉外观、hover 只变字色完全可控（就是用户要的"下拉样式"）。
  * 仅当视觉容器太矮、div 弹层会超出被 iframe 裁切时，才**自动改用 `openModalDialog`**（DOM 在宿主顶层，不裁切，但带半透明遮罩）。两者共用同一套预设计算、面板控制色、点击套用逻辑。
  * 交互优先级：iframe 内 div 下拉（首选，最像下拉）→ openModalDialog（兜底，不裁切）。GUID 不变，兼容热加载升级。

## 2.3.4.1
* **优化 openModalDialog 弹窗形态，让它更接近下拉列表**：
  * 弹窗标题置空，减少标题栏带来的"弹窗感"；高度从 240 压到官方最小 210。
  * 弹窗内选项行高从 30px 加大到 38px，字号从 12px 加大到 13px，左右内边距 16px；列表自动计算垂直 padding 让 5 个选项刚好撑满 210px 面板，消除大块空白。
  * 位置仍使用 `RelativeToVisual`（相对视觉下方 32px）。注意：弹窗实际落点由 Power BI 宿主控制，Desktop 中可能仍偏向居中，这是官方模态框的硬性限制。

## 2.3.4.0
* **采用官方 `openModalDialog` API，彻底解决下拉被 iframe 裁切**：点击触发器优先调用 `host.openModalDialog`（DOM 渲染在 PowerBI 宿主页面顶层，不受视觉容器 `overflow:hidden` 裁切）。弹窗内列表为纯原生 DOM 组件（`src/PresetDialog.ts`），hover 只变字色、背景默认透明完全可控；弹窗内列表颜色由格式面板「下拉样式」控制（listBackground/listText/listHoverText/listHoverBackground 通过 initialState 传入并写入弹窗内联 CSS 变量）。
  * 触发方式：`RelativeToVisual` 定位（左对齐、触发器下方 32px 偏移），最小 240×210，自带半透明遮罩；用户点选项即 `host.close(OK, {preset})` 回调，visual 收到后套用预设并收起。
  * 类型补充：`powerbi-visuals-api` 5.4.0 本地类型未导出 `openModalDialog` 等接口，已在 `visual.ts` 顶部 `declare module` 补全最小类型声明以通过 tsc。
  * 降级：当 `host.hostCapabilities.allowModalDialog` 为 false（嵌入式分析 / 发布到 Web / 仪表板等禁用环境）时，自动回退到视觉内流内弹层（2.3.3.1 方案）。本期按需求暂不对禁用环境做额外处理。GUID 不变，兼容热加载升级。

## 2.3.3.1
* **修复自绘弹层在 Power BI 视觉 iframe（overflow:hidden）内被裁切、导致「看不到下拉列表」**：原 `position:absolute` 相对 root 向下展开，一旦超出视觉框高度即被裁。改为**流内展开**（弹层作为正常元素排在触发器下方），并对弹层限高（`root 高度 - 触发器高度 - 间距`）+ 内部 `overflow-y:auto` 滚动；root 加 `overflow:auto` 保证内容超出时可在视觉框内滚动查看。弹层始终位于视觉框内，不再被裁。hover 只变字色、格式面板控制等逻辑不变。GUID 不变，兼容热加载升级。

## 2.3.3.0
* **切回自绘 div 下拉，真正解决「悬浮只变字色」的需求**：放弃原生 `<select>`（其 option 的 `:hover` 由系统/OS 渲染，CSS 无法控制，只能整行变灰）。改用自绘 `div` 触发器 + 弹层（视觉自身 DOM 子元素，`position:absolute` 相对 root）。
  - **悬浮效果完全可控**：`.drs-option:hover` 只改 `color`（`--drs-list-hover-fg`，默认 `#B4B2A9` 灰），背景默认透明不变灰；如需整行变灰仍可在面板设「悬浮背景色」。原生的「整行变灰」无法用 CSS 关闭，故换回 div 方案。
  - **对抗 iframe 裁切**：弹层默认向下展开，触发器下方空间不足时自动翻转为向上展开（`.drs-popup-up`）；弹层 `max-height` 限制在 root 高度内并 `overflow-y:auto` 内部滚动，尽量在视觉框内自容纳不被裁。
  - **格式面板新增**：「下拉样式」卡片增加「悬浮文字色」「悬浮背景色」（绑定 `selection.listHoverText` / `listHoverBackground`，下发 `--drs-list-hover-fg` / `--drs-list-hover-bg`）。
  - 点击外部 / Esc 收起（document capture 阶段监听 + trigger `stopPropagation`，复用此前「失去焦点」方案避免开关死循环）；`destroy` 解绑外部监听。预设计算、永远跟随、切页恢复、持久化逻辑不变。GUID 不变，兼容热加载升级。

## 2.3.2.0
* **下拉面板背景/文字色可经格式面板控制**：在「下拉样式」卡片新增「下拉面板背景色」「下拉面板文字色」两个颜色选择器，绑定到 `selection.listBackground` / `selection.listText`，通过 CSS 变量 `--drs-list-bg` / `--drs-list-fg` 应用到原生 `<select>` 的 `<option>` 样式（默认 `#0A1428` / `#FFFFFF`）。其余预设计算、永远跟随、切页恢复逻辑不变。

## 2.3.1.0
* **切换为系统原生下拉（解决自定义 div 下拉在 Power BI sandboxed iframe 内被裁切的问题）**：弃用自绘的 trigger + popup（div/absolute/fixed 方案均无法飞出 iframe 视口），改为 `HTMLSelectElement` 原生 `<select>` 下拉。下拉面板由浏览器/操作系统绘制，可超出视觉 iframe 边界，彻底解决"下拉被视觉框截断"。
  - 5 个 `<option>`：本月/上月/近7天/近15天/近30天，绑定 `change` 事件即时下发 AdvancedFilter。
  - 删除 trigger/popup/option 自绘 DOM 与三道回收监听（document click / window.blur / Esc），逻辑大幅简化；`destroy` 无需解绑外部监听。
  - 样式：`select` 复用 `selection`（下拉样式）的背景/边框/圆角/强调色，option 下拉项强制深色背景（系统原生下拉项样式受限，仅能控制背景/前景色）。
  - 预设计算、永远跟随、切页恢复、持久化逻辑不变。GUID 不变，兼容热加载升级。

## 2.3.0.0
* **折叠下拉预设切片器（按用户选择 A 方案）**：彻底移除双日期输入框 + 叠加层 + `userOverridden` 冻结逻辑，重构为「下拉触发器 + 弹出层 + 预设计算 + 永远跟随状态机」。
  - **5 个动态预设**（按 rangeMax 本地时区计算，顺序即下拉展示顺序）：本月（MTD `[月首日, rangeMax]`）/ 上月 `[上月1号, 上月最后一天]` / 近7天 `[rangeMax-6, rangeMax]` / 近15天 `[rangeMax-14, rangeMax]` / 近30天 `[rangeMax-29, rangeMax]`。
  - **折叠下拉 UI**：常驻触发器胶囊显示当前预设名 + ▼ 箭头，点击展开 5 个选项（覆盖在触发器下方，视觉自身 DOM 子元素，不挂 document.body，绕开 sandboxed iframe 截断）；选项左侧圆点高亮当前选中项；点击选项立即下发并收起；点击外部/Esc 收起。
  - **永远跟随（无冻结）**：每次 `update()` 都按 rangeMax 重算当前预设区间并下发，跨月自动跟进最新月份；移除 `userOverridden` 分流逻辑（仍读取做兼容，不影响逻辑）。
  - **切页恢复**：从 `jsonFilters.conditions` 反推 `[start, end]` 区间（LessThan 的 value 减一天得实际结束日），遍历 5 个预设找天级误差最小者高亮；误差 >3 天视为自定义区间，保持当前预设不变。
  - **外部清除复位**：「清除所有筛选器」后 `lastFilterPresent` 由有到无，回到当前预设并按最新数据重算下发。
  - **当前预设持久化**：`state.currentPreset`（text）通过 `host.persistProperties` 写回，重开报表恢复用户上次选的预设；旧报表无此属性时默认 `thisMonth`。
  - 时区处理完全复用既有 `applyBetweenFilter` 逻辑：本地时区构造 `new Date(y,m,d)`、序列化 `toJSON()`、结束日取次日零点 `LessThan` 语义包含当天。
* capabilities 调整：删除 `style` 对象与 `labels` 卡片；`selection` 重命名为「下拉样式」并移除 `singleSelect/ctrlMultiSelect/showSelectAll`；`state` 新增 `currentPreset`。GUID 不变（`DateRangeSlicer20260825004`），兼容热加载升级。

## 2.2.1.0
* **当月动态跟随（解决 v2.2.0「重开报表冻结旧月」问题）**：新增隐藏内部状态对象 `state.userOverridden`（capabilities 声明但不在 getFormattingModel 中出卡片，故格式面板不可见）。
  - `userOverridden=false`（默认当月态）：重开报表 / 刷新数据 / 切页恢复时，每次都按**最新日期所在月（rangeMax）**重算 `[月首日, 最新日期]`（MTD）并重新下发，自动跟随数据推进到新月份。
  - `userOverridden=true`（用户自定义态）：用户一旦手动改过任一输入框，即 `host.persistProperties` 持久化该标志，此后保留用户钉住的选择，不再跟随默认当月。
  - **清除筛选器复位**：外部「清除所有筛选器」后回到默认当月并 `persistUserOverridden(false)`，重新进入跟随态。
  - 判定逻辑：已有介于型 AdvancedFilter 时按 `userOverridden` 分流（冻结恢复 vs 重算跟随）；非介于型筛选（如其它视觉下发的 Is/In）自动清除并回到默认当月。
* 依赖 v2.2.0 的常驻双输入框 + 默认当月底座，GUID 不变（`DateRangeSlicer20260825004`），兼容热加载升级。

## 2.2.0.0
* **回归简版（按用户选择 B）**：砍掉 v2.0/v2.1 迭代增加的快捷预设按钮组、三层折叠面板、应用按钮、收起态摘要条，回到 v1.9.1.0 的**常驻「介于」双输入框**形态。
  - 布局：标头（可选）→ 开始日期 → 结束日期 两个深色圆角输入框（原生 `date` 日历），始终可见，无折叠/预设/应用。
  - 交互：手动改任一输入框即**立即下发** AdvancedFilter（无待应用状态）。
  - **默认当月**：格式面板「默认行为 → 默认本月」开关（默认 **开**），首次加载自动套 `[最新日期所在月首日, 最新日期]`（MTD）并下发，随数据刷新自动跟进；关闭则显示数据边界但不下发（全量）。
* 删除的能力：`presets` 对象、`默认预设` 下拉、`默认本月` 兼容默认值（true 旧逻辑）、`computePresetRange`/`onPresetClick`/`setActivePreset`/`tryMatchPreset`/`togglePanel`/`collapsePanel`/`updateSummary`/`updatePresetVisibility` 等方法、`style.mode` 的「下拉」选项。
* 保留的能力：`resolveRange` 边界限制、原生 date 日历、暗色输入框样式（边框/圆角/底色 format 可控）、`restoreFilter` 切页恢复、`applyBetweenFilter`。GUID 不变。

## 2.1.1.0
* **交互变更：预设不再即时下发，统一由「应用」确认并收起**。
  - 点预设按钮 / 手动改输入框：仅填值 + 标「待应用」（`pendingApply=true`），**不直接下发筛选**（与手动输入行为一致）。
  - 点「应用」按钮：下发 AdvancedFilter + 更新摘要条文字 + **收起控制面板**（`collapsePanel`）。
  - summary 摘要条仍可作「取消/收起」用：在待应用状态下点它收起面板，筛选保持上次已下发值不变。
* 行为调整：撤回 2.1.0 的「点预设立即生效」与「应用后面板保持展开」两项决策。

## 2.1.0.0
* **三层折叠交互重构**：从 v2.0 的「全展开静态布局」改为参考 Grafana 风格但贴合本项目的折叠结构（无刷新按钮——PBI 自定义视觉无重拉数据语义）：
  - **L1 收起态摘要条**：默认只显示一行 `📅 范围文字 ▼`，点它展开/收起控制面板；范围文字显示预设名（近30天/本月…）或 `MM-DD ~ MM-DD` 自定义区间或「全部」。
  - **L2 控制面板**：展开后含「快捷预设网格 + 深色圆角日期输入框（原生 date 日历）+ 应用按钮」，整体为视觉自身 DOM 子元素（不依赖 `document.body` 浮层，绕开 sandboxed iframe 截断）。
  - **L3 日期选择**：点击输入框弹出原生系统日历。
* **交互确认点（按用户决策）**：点预设按钮**立即生效**（无需再点应用）；手动改输入框后标记 `pendingApply`，需点「应用」才下发；应用后面板**保持展开**（手动点摘要条收起）。
* **默认预设（取代原「默认本月」）**：新增格式面板「默认行为 → 默认预设」下拉（近7天/近30天/本月/上月/全选/无），默认**近30天**，首次加载即套用并下发；旧「默认本月」开关保留为兼容（true 等效默认预设=本月）。

## 2.0.0.0
* **新增快捷预设按钮组**（格式面板 → 快捷预设）：在「介于」双输入框上方新增一行药丸按钮，点击即自动计算起止日期并下发 AdvancedFilter 区间筛选。所有预设基于 `rangeMax`（数据最新日期）本地时区计算。
* **内置 5 个预设**：
  - **近7天**：`[rangeMax-6天, rangeMax]`
  - **近30天**：`[rangeMax-29天, rangeMax]`
  - **本月**：`[rangeMax所在月首日, rangeMax]`（与「默认本月」MTD 语义一致）
  - **上月**：`[上月1号, 上月最后一天]`
  - **全选**：清除筛选（双侧未激活，显示数据边界全量）
* **激活态高亮**：当前生效的预设按钮以强调色边框 + 低透明度底色 + 微阴影标识；用户手动编辑任一输入框后自动清除高亮（回到手动输入态）。
* **切页恢复匹配**：`restoreFilter()` 恢复已保存筛选后，尽力匹配到对应预设并恢复高亮（日期精度到天比对）；不匹配任何预设则无高亮（手动输入态）。
* **默认本月联动**：开启「默认本月」且首次加载时，自动高亮「本月」预设按钮。
* **格式面板控制**：新增「快捷预设」卡片，顶层开关控制整行显隐，每个预设独立 bool 开关控制是否显示（均可单独隐藏）。
* **布局**：预设行位于标头与双输入框之间，flex 横排 + 自动换行，药丸圆角 12px、字号 11px、暗色底 + 边框风格对齐深蓝暗色主题。
* GUID 不变（`DateRangeSlicer20260825004`），兼容热加载升级。

## 1.9.1.0
* **新增「默认本月」开关**（格式面板 → 默认行为 → 默认本月，capsabilities `defaultBehavior.defaultThisMonth`）：开启后，首次加载（且无已保存筛选）或外部清除筛选时，自动将区间套为「最新日期所在月首日 → 最新日期」（Month-To-Date），随数据刷新自动跟进——报表最新数据是 8/25 即默认锁 8/1–8/25，刷新到 9/3 自动变 9/1–9/3，不会选出无数据的未来日期。
* 关闭（默认）时维持原行为：初始两侧未激活、显示数据边界但不下发筛选（全量）。
* **首载即直接下发筛选（非仅视觉占位）**：默认本月开启后，`applyInitialDefault()` 内直接调用 `applyBetweenFilter()` → `host.applyJsonFilter(AdvancedFilter, "general", "filter", FilterAction.merge)`，打开报表时画布数据**已经按本月过滤**，无需用户点任何控件；筛选写入报表后随文件保存持久化。
* 实现要点：`update()` 合并外部清除与首次加载两条分支，统一调用 `applyInitialDefault()`；用本地时区 `new Date(y, m, 1)` 算月首日，复用既有 `applyBetweenFilter()` 下发 `AdvancedFilter`（GreaterThanOrEqual / LessThan），时区处理沿用 v1.8.0 的本地化经验。
* 行为边界：默认本月仅在「无已保存筛选」时套用；用户手动改过区间后，筛选随报表保存持久化，重开不会强行重置（避免覆盖用户选择）。如需「每次刷新强制跟进最新月」需额外加标记位，暂未做。

## 1.9.0.0
* **移除「下拉」显示样式**：彻底删除下拉（原生 `<select>` 单选/多选/全选）分支与 DEBUG 画布调试面板，视觉只保留「介于」区间模式。原因：原生 `<select>` 选一项即关闭是浏览器内置行为、JS 无法阻止（`transient user activation` 已被消费），多选无法常开；且自定义视觉在 sandbox iframe 内、自绘浮层也飞不出视觉框，飘+常开多选为物理死局。
* **输入框样式完全可控（核心价值）**：「介于」双输入框边框色/圆角/底色/强调色由 `selection` 格式卡片驱动（CSS 变量 `--drs-border`/`--drs-radius`/`--drs-bg`/`--drs-accent`），绕开原生切片器输入框样式锁死（主题 schema 的 slicer `date` card 不暴露 border/radius）。
* **格式面板精简**：删除「样式」卡片（不再有介于/下拉切换）与「单选/使用 Ctrl 多选/显示全选项」三个下拉专属开关；「切片器设置」卡片重命名为「输入框样式」，仅保留背景色/边框颜色/边框粗细/圆角/强调色五项。
* 保留「介于」全部既有能力：开始/结束双日期输入框、本地时区边界计算、系统日历可选范围限制、切页筛选恢复、非介于型筛选自动清理、tooltip 本地时区调试信息。

## 1.8.0.0
* **多选保持展开策略重构**：`showPicker()` 在 PBI Desktop Chromium 中确认不生效（方法存在但无效果），替换为三种替代策略依次尝试：A) 延迟 10ms 派发合成 `click` 事件到 select（模拟再次点击触发器）；B) 延迟 30ms `focus()` + 派发 `ArrowDown` 键盘事件；C) 延迟 60ms 纯 `focus()` 兜底。无论哪种成功/失败均优雅降级——最差情况选一项关一次，功能完整不受损。
* **tooltip 时区修复**：调试信息中的 min/max 日期从 `toISOString()`（UTC）改为本地时区格式化显示。此前 UTC 8/24 16:00 在 tooltip 显示为 8/24，但数据实际是北京时间 8/25，导致用户困惑。现直接输出本地时间并标注 `(local)`。
* **BasicFilter 空数组修复**：多选 + 全选项开启 + 未勾选任何个体时，不再发送 `BasicFilter(target, "In", [])`（Power BI 不允许空 values，会导致下游视觉报错 `Encountered invalid QueryInExpression`），统一走 `FilterAction.remove`（无筛选 = 全部数据）。

## 1.7.0.0
* **多选模式改用原生漂浮下拉（A 方案）**：废弃 `<select multiple>` 列表框（无法 OS 级漂浮），统一使用普通 `<select>` + `showPicker()` API 实现伪多选——多选模式下每次 change 后 toggle 选中项、重建 options（✓ 前缀标记已选）、调用 `showPicker()` 强制重新弹开下拉面板，实现与单选模式同等的 OS 级漂浮效果。
* **选项 ✓ 前缀**：多选模式下已选日期项显示 `✓ ` 前缀（对齐原生下拉切片器的勾选视觉效果），未选项无前缀；每次选择后立即重建 options 刷新标记。
* **全选/所有语义**：多选"全选"= 清空 selectedKeys（移除筛选）；单选"所有"= 同上。两者均通过首项 option (`__all__`) 实现。
* **`showPicker()` 降级兼容**：Chrome 86+ / Edge 86+ / PBI Desktop (Chromium) 均支持；不支持的浏览器 try-catch 静默降级为选完即关（功能不受损，只是不再保持展开）。
* 删除 CSS `&[multiple]` 规则（不再使用 multiple 属性）。

## 1.6.0.0
* **单选模式默认态修复**：原生单选 `<select>` 未显式选中时浏览器会默认显示第一项日期，但 `selectedKeys` 为空（无筛选）——显示与筛选不一致。现单选模式固定渲染首项「所有」（value=`__all__`），未选时选中它=无筛选、显示「所有」，对齐原生下拉切片器首行「所有」行为；选具体日期下发 Is 筛选，再选「所有」即清除。
* **列表随数据/开关刷新**：原 options 重建条件只看字段变化，导致同字段刷新数据、切单/多选、开关「全选项」时列表不更新。改为签名比对（`模式|全选项|选项数|首键|末键`），任一变化即重建。
* **多选列表框不再留空行**：`size` 由固定 8 改为 `min(8, 选项数)`，数据不足 8 项时无空白行。
* 「所有/全选」语义统一：单选「所有」与多选「全选」均映射 `selectedKeys` 清空（=移除筛选），`syncNativeSelect` / `applyDropdownFilter` 的“全选态”判定按单/多选分别处理。

## 1.5.0.0
* **下拉样式改用浏览器原生 `<select>` 元素**：单选模式 = 浏览器原生下拉面板（OS 级渲染，真正漂浮在画布上、不受 sandbox/overflow 裁剪）；多选模式 = `<select multiple size=8>` 列表框（容器内显示，Ctrl/Shift 多选）
* 删除自绘弹层（trigger / popup / 搜索框 / 全选行 / checkbox / ClickAway）及相关 CSS，下拉交互完全交给浏览器原生 select
* 「全选」改为 select 第一项 `<option value="__all__">全选</option>`，勾它=清空筛选=全选态
* 删除搜索框相关配置（`searchEnabled`/`searchPlaceholder`）：原生 select 不支持搜索
* 配置互斥：开「单选」后自动隐藏「使用 Ctrl 多选」「显示“全选”项」两个开关（对齐原生切片器树形）
* GUID 变更为 `DateRangeSlicer20260825004`（capabilities 缩减属不兼容更新，强制 PBI 重新加载）

## 1.4.0.0
* 默认值对齐原生下拉切片器：Ctrl 多选=开、显示“全选”项=关、显示搜索框=关（单选仍默认关）
* Ctrl 多选语义重写（A1）：未按住 Ctrl 单击=单选（清空其他、只勾这一行）；Ctrl+单击=仅切换该行（不影响其他），完全对齐原生“使用 Ctrl 选择多项”行为
* 触发器文本对齐原生：空选/全选态显示“所有”；选 1 项显示该日期值；多选（≥2 项）显示“多选”
* 单选→多选模式切换保留已选单选项；多选→单选模式收敛为第一个被选项（radio 不显示多个勾选）
* 弹层关闭范围覆盖整页任意空白（含其他视觉对象内部、画布外），点外部/Esc 收起（原生行为）
* GUID 变更为 `DateRangeSlicer20260825003`（强制 PBI 重新加载，避开 1.3.0.0 实例已固化的旧默认值）

## 1.3.0.0
* 修复下拉弹层未置顶：z-index 提到 int32 上限并加 `transform: translateZ(0)` 强制独立 stacking context，新增 `body > .drs-popup` 全局兜底，确保弹层始终盖在报表画布之上、点击不再穿透（此前点击穿透到报表导致“选了没生效/不收起”的错觉）
* 下拉新增顶部搜索框（原生下拉切片器同款）：输入即过滤下方列表，支持开关“显示搜索框”与“搜索框提示文字”
* 单选模式点选项后弹层收起（原生行为）；多选模式保持展开、可连续勾选，点外部/Esc 收起（原生行为）

## 1.2.0.0
* GUID 变更为 `DateRangeSlicer20260825002`（强制 PBI 重新加载，避免与 1.0.0.0/1.1.0.0 同 GUID 缓存冲突）

## 1.1.0.0
* 新增“下拉”显示样式（格式设置 → 样式 → 显示样式）：字段值下拉列表，等价 Power BI 原生字段值下拉
* 下拉支持单选 / 多选 / 全选：通过“切片器设置”中的“单选”“使用 Ctrl 多选”“显示‘全选’项”开关控制
* 下拉筛选使用 BasicFilter（单选 Is / 多选 In），并支持切页与“清除所有筛选器”后的回显
* 弹出层挂载到 document.body，避免被视觉容器 overflow:hidden 裁剪；点击外部或按 Esc 关闭

## 2.2.2.0
* Updated tooltip utils to avoid moving a stale tooltip when tooltips are disabled

## 2.2.1.0
* json filters bug fix

## 2.2.0.0
* restored Alt + click selection behavior
* fixed viewmode update with forced selection scenario

## 2.1.11.0
* text tailoring disabled by default
* added formatting setting for text tailoring

## 2.1.10.0
* Backward compatibility fix for orientation

## 2.1.0.0
* Removed InteractivityUtils and SelectionManager
* Added TupleFilter and jsonFilers

## 2.0.8.0
* Code refactoring
* Bug fixes

## 2.0.7
* JsonFilter check fix

## 2.0.6
* Formatting models update
* Tooltips toogle added
* Selection filter fix

## 2.0.5
* Metadata null check added to converter

## 2.0.4
* API downgraded to 5.1.0

## 2.0.3
* Capabilities update: category should be filled before others
* API 5.2.0+
* updated powerbi-visuals packages

## 2.0.2
* Updated tools

## 2.0.1
* FIX: select in each of several visuals

## 2.0.0
* Webpack integration
* Azure Pipelines integration
* API 5.1.0+
* updated powerbi-visuals-utils, powerbi-visuals-tools 4.x.x
* d3 v5

## 1.6.4
* Added telemetry for detection of external images in visual

## 1.6.3
* FIX: Last image in column is cut off when the search enabled

## 1.6.2
* Added [Sync slicers](https://docs.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-slicers#sync-and-use-slicers-on-other-pages) support

## 1.6.1
* Image validation was repaired
* Restriction for number of categories was changed from 10k to 1k
* Image bucket can accept only string fields now

## 1.6.0
* High contrast mode
* API 1.13.0

## 1.5.0
* Added localization for all supported languages

## 1.4.10
* FIX: multi select condition fix

## 1.4.9
* FIX: Un-Filtering doesn't work at the initial loading

## 1.4.8
* Add: PBI Bookmarks support

## 1.4.7
* FIX: Images are shown even if Values bucket is not presented

## 1.4.6
* Added an option to show rounded images like in Twitter

## 1.4.5
* Fixed issue: Multi selection doesn't work on mobile devices
* Fixed issue: Incorrect default value for Chiclet Height and Width displayed
* Fixed issue: Performance decrease with a lot of values

## 1.4.4
* Fixed not matching lateral boundaries of search box and headers' outline
* Fixed incorrect default value for Chiclet Height and Width displayed
* Fixed bug when Outline displayed only for bottom part of Header

## 1.4.3
* Added limits for "Columns" and "Rows" fields
* FIX. Text color is not applied to all chiclets after selecting
* FIX. Chiclets change place after switching between "Disabled" options
