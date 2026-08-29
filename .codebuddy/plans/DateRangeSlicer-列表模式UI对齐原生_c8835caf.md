---
name: DateRangeSlicer-列表模式UI对齐原生
overview: 解决列表模式与原生切片器的结构差距（非颜色）：① 排查并强制面板单列（换 GUID 重新导入 + 防御性样式）；② 搜索框紧贴面板；③ 列表值左对齐加固；④ 行间距做成配置项（默认4，范围0-12）；⑤ 面板默认最大高度约7项，超出才滚动；⑥ 不加勾选框。
todos:
  - id: add-listgap-capability
    content: capabilities.json 新增 listGap 属性 + DEFAULTS 与 readSettings 同步
    status: completed
  - id: apply-styles-gap
    content: applyStyles 写入 --drs-list-gap 变量
    status: completed
    dependencies:
      - add-listgap-capability
  - id: less-layout-fixes
    content: 修改 LESS：搜索框去 margin、列表加 max-height/flex-wrap/gap 变量/左对齐加固
    status: completed
    dependencies:
      - apply-styles-gap
  - id: format-panel-gap
    content: getFormattingModel 列表项组新增「行间距」输入
    status: completed
    dependencies:
      - apply-styles-gap
  - id: bump-version-build
    content: pbiviz.json 升 2.8.0.0 + 换 GUID 010 + 构建验证
    status: completed
    dependencies:
      - less-layout-fixes
      - format-panel-gap
  - id: changelog-commit
    content: 补 CHANGELOG 并本地 commit（不 push）
    status: completed
    dependencies:
      - bump-version-build
---

## 用户需求

对比原生 PBI 切片器，调整本视觉（DateRangeSlicer）列表模式的布局结构差距（非颜色，颜色已在 v2.7 处理好）。用户原话要点：

- 列表/预设网格应是单列，但截图显示多列
- 搜索框与列表不够紧贴，需无缝贴合
- 列表值应左对齐
- 滚动条一出现就太长；原生切片器滚动条小而隐约，列表默认只显示前约 7 项高度，超出才出现滚动条
- 列表值行间距缺少配置项，默认应为 4px

澄清结论：
- 不加勾选框，保持当前按钮式选中态（整行背景 + 边框）
- 行间距做成配置项，默认 4px，范围 0-12
- 面板默认最大高度写死为约 7 项，超出才滚动

## 核心功能

1. 单列保障：列表模式严格单列显示（防御性样式 + 换 GUID 让用户重新导入最新版，旧实例缓存是多列根因）
2. 搜索框紧贴：去掉搜索框与列表之间的间距
3. 左对齐加固：列表项文字左对齐，不被居中覆盖
4. 行间距配置：新增「行间距」格式面板项（默认 4，范围 0-12）
5. 面板高度约 7 项：超出才出现细滚动条，滚动条不突兀


## 技术栈

- Power BI Custom Visuals API 5.4.0
- TypeScript + LESS + Webpack
- 无前端框架依赖
- 构建：`cd visual\DateRangeSlicer; npm run package`

## 实现方案

### 总体策略

沿用 v2.7 已建立的「配置项 → CSS 变量 → LESS 引用」链路。本次新增 1 个配置项 `listGap`，通过 CSS 变量 `--drs-list-gap` 驱动列表行间距；通过 LESS 直接给 `.drs-list` 增加 `max-height`（约 7 项）与 `flex-wrap: nowrap` 防御；搜索框 `margin-bottom` 归零实现紧贴。capabilities 变更触发换 GUID（2.7.0.0 → 2.8.0.0）。

### 关键修改点

**1. 多列根因处理（最易误判处）**

当前 `.drs-list` 是 `flex-direction: column`、`.drs-preset-grid` 是 `grid-template-columns: 1fr`，代码层面**不可能多列**。截图多列说明运行的是 GUID 004/005 时代的旧缓存实例。因此：
- 本次因新增 `listGap` 属性必须换 GUID（`DateRangeSlicer20260825009` → `DateRangeSlicer20260825010`），强制 PBI 丢弃内存旧实例，用户重新导入后即可看到单列。
- 防御性样式：在 `.drs-list` 增加 `flex-wrap: nowrap`，彻底杜绝任何情况下的多列回流。

**2. 搜索框紧贴（`.drs-search`）**

当前 `.drs-search { margin-bottom: 6px }` 使其与下方列表分离。改为 `margin-bottom: 0`，并在 `.drs-list` 顶部用极小 `padding-top: 2px` 做视觉呼吸。参考原生切片器：搜索框与列表紧连无空隙。

**3. 左对齐加固（`.drs-list-item`）**

`.drs-list-item` 已是 `text-align: left`。单列后自然左对齐，额外确认不出现 `justify-content: center` 类覆盖。可在 `.drs-list-item` 显式加 `justify-content: flex-start`（其为 flex 容器时）确保稳妥。

**4. 行间距配置（新增 `listGap`）**

走完整链路：
- `capabilities.json`：selection 对象新增 `listGap`（numeric，默认 4）
- `DEFAULTS.selection` 新增 `listGap: 4`
- `readSettings`：新增 `this.settings.selection.listGap = clamp(s.listGap, 0, 12, DEFAULTS.selection.listGap)`
- `applyStyles`：新增 `this.root.style.setProperty("--drs-list-gap", \`${s.listGap}px\`)`
- LESS：`.drs-list { gap: var(--drs-list-gap, 4px); }`
- 格式面板「列表项」组：新增「行间距」数值输入（numUpDown，默认 4，范围 0-12）

**5. 面板高度约 7 项（`.drs-list`）**

当前 `.drs-list` 无 `max-height`，随内容撑高导致滚动条很长。改为：
```
--drs-item-h: 28px;   /* 列表项固定高度，统一管理 */
.drs-list {
    max-height: calc(7 * var(--drs-item-h) + 6 * var(--drs-list-gap, 4px));
    overflow-y: auto;
}
```
这样值 ≤ 7 项时不出现滚动条（或仅极短），> 7 项才出现细滚动条，与原生切片器观感一致。滚动条样式已在 v2.7 做成暗色细条（8px 宽），无需改动。

**6. 不改项**

- 不加勾选框（用户明确）
- 颜色 / 选中态样式保持 v2.7 成果
- 触发器、面板、滚动条组的其它配置保持不变

### 性能与兼容性

- CSS 变量与 `calc()` 零运行时开销，`applyStyles()` 仅在 update 时调用一次
- `listGap` 缺失时 `readSettings` 回落 `DEFAULTS`（旧报表兼容）
- GUID 变更后旧视觉实例需重新导入（capabilities 变更的硬性要求）

### 产物校验

解包 `dist/DateRangeSlicer20260825010.2.8.0.0.pbiviz`，对 `resources/DateRangeSlicer20260825010.pbiviz.json` 做关键词匹配：
- 新 GUID / 2.8.0.0
- `listGap` 属性存在
- `--drs-list-gap` 变量写入
- `.drs-list` 含 `max-height` 与 `flex-wrap: nowrap`
- `.drs-search` 无 `margin-bottom: 6px`

