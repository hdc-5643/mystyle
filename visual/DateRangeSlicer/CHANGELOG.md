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
