# powerbi-visuals-api 版本变更日志

> **权威来源**：`visual/DateRangeSlicer/node_modules/powerbi-visuals-api/CHANGELOG.md`
> （本项目安装 `~5.4.0`，以下为该包自带的官方 changelog）

## 5.4.0（本项目当前版本）
- `DataViewMetadata` 新增 `isDataFilterApplied`：布尔值，标识是否有筛选影响该视觉

## 5.3.0
- `SelectionId` 的 update-fix（matrix dataView）
  - ⚠️ selectionId 核心数据可能变化，旧 API 持久化的 selectionIds/identityIndex 在 matrix dataView 下可能失效
- `downloadService` 新增 `exportVisualsContentExtended`：返回扩展的下载结果信息
- `VisualUpdateType` 扩展 3 个新类型：`FormattingSubSelectionChange`、`FormatModeChange`、`FilterOptionsChange`

## 5.2.0
- capabilities schema 新增 `dataReductionCustomization`：声明式自定义数据缩减行为

## 5.1.0
- 新增 Subtotal position type API
- 新增 Custom Sorting API（`applyCustomSort`）
- 新增 formatting pane `FormattingModel` 接口

## 4.7.0
- 新增 drill API（`host.drill`）

## 4.6.0
- capabilities schema 新增 `privileges`

## 4.0.0
- `openModalDialog` 增强：允许定义对话框的 size、position 和 title

## 3.8.3
- `supportEnhancedTooltips`：作为 capability 启用现代视觉工具提示（含数据点钻取操作与更新样式）

## 3.8.2
- `openModalDialog`：显示交互式模态对话框窗口

## 3.7.0
- `displayWarningIcon`：显示带自定义文本与详情的警告图标

## 3.6.0
- `supportsEmptyDataView`：作为 capability 启用，即使没有 data roles 也能接收格式属性

## 3.5.1
- `VisualEnumerationInstanceKinds`：新增枚举支持不同格式化类型
- `VisualObjectInstance`：新增 `propertyInstanceKind` 与 `altConstantValueSelector` 支持条件格式

## 3.4.0
- `fetchMoreData`：新增 `aggregateSegments` 参数（默认 true）

## 3.2.0
- `supportsMultiVisualSelection`：多选能力

## 2.6.2
- 允许同时使用两个及以上 dataViewMappings

## 2.6.1
- `fontFamily` 成为 `formatting` 对象类型的必需属性之一
- schema 新增 `supportsMultiVisualSelection`

---

## 本项目用到的关键 API 与引入版本

| API | 引入版本 | 本项目用法 |
|---|---|---|
| `applyJsonFilter` + `AdvancedFilter` | — | 预设模式筛选下发 |
| `BasicFilter`（Is/In） | — | 列表模式筛选下发 |
| `persistProperties` | — | 持久化 currentPreset / customRange |
| `openModalDialog` | 3.8.2（4.0.0 增强） | 已验证可用（归档见 `.codebuddy/archive/`） |
| `switchFocusModeState` | 2.6.0 | **待验证**：能否主动唤起焦点模式 |
| `hostCapabilities.allowModalDialog` | — | 实测 `true` |
| `fetchMoreData` | 3.4.0 | 未使用（capabilities 已设 top:30000） |
| `FormattingModel` | 5.1.0 | 格式面板全部基于此 |
