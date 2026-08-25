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
