---
name: DateRangeSlicer-列表与触发器左对齐
overview: 让值列表模式下面板内的搜索框、列表项的内容左边缘与触发器文字左边缘对齐（去掉面板左右 padding，搜索框/列表项保留 8px 左内边距使文字对齐；checkbox 保留自身内边距）。同时保证无搜索框时列表项同样对齐。
todos:
  - id: panel-padding
    content: 修改 .drs-panel 的 padding:10px 为 padding:10px 0，去掉左右内边距
    status: completed
  - id: bump-version-build
    content: pbiviz.json 升 2.8.0.4 + 构建验证 + 清理旧 2.8.0.3 产物
    status: in_progress
    dependencies:
      - panel-padding
  - id: changelog-commit
    content: 补 CHANGELOG 并本地 commit（不 push）
    status: pending
    dependencies:
      - bump-version-build
---

## 用户需求

用户贴图指出值列表模式下，搜索框和列表项整体比顶部触发器缩进了一截（面板 10px 左右 padding 所致），希望搜索框与列表项能和触发器左边缘对齐，并考虑到「没有搜索框时列表项也要对齐」的情况。

## 核心功能

1. **搜索框左对齐**：去掉面板左右内边距后，搜索框文字左缘与触发器文字左缘（距面板左边界 8px）对齐。
2. **列表项左对齐（含无搜索框场景）**：列表项（含 checkbox）左缘同样与触发器文字左缘对齐；关闭搜索框后，列表项作为面板首个可见子元素依然对齐。
3. **checkbox 保留自身内边距**：列表项文字仍保留 28px 左内边距（给 checkbox 留位），不作为「贴最左边界」处理，符合用户确认结论。
4. **预设模式一致性**：预设项同在面板内，去掉左右 padding 后自然左移，与触发器对齐，行为一致。


## 技术栈

- Power BI Custom Visuals API 5.4.0
- TypeScript + LESS + Webpack
- 无前端框架依赖
- 构建：`cd visual\DateRangeSlicer; npm run package`（PowerShell 中文路径需 `cmd /d /c "chcp 65001 >nul & cd /d <中文路径> && npm run package"`）

## 实现方案

### 总体策略

本次为**纯 LESS 样式调整**，不涉及 TypeScript 逻辑、capabilities 或 GUID 变更。核心是把 `.drs-panel` 的四边 `padding: 10px` 改为只保留上下 padding（左右归零），使面板内容区左边缘与触发器左边缘重合；搜索框与列表项自身左右内边距保持不变，从而其文字/checkbox 左缘自然与触发器文字左缘（距面板左边界 8px）对齐。

### 关键修改点

**1. 面板左右 padding 归零（`.drs-panel`）**

当前：
```
padding: 10px;
```
改为：
```
padding: 10px 0;
```
原因：面板 `width: 100%`（相对 `.drs-body`，等于触发器宽），`box-sizing: border-box`。原 `padding: 10px` 让内部搜索框/列表项整体内缩 10px，导致视觉上比触发器文字右偏 10px。改为 `10px 0` 后，上下保留 10px 呼吸间距，左右去掉，内容区左缘 = 面板左边框内侧 = 触发器左缘。

**2. 搜索框内边距不动（`.drs-search`）**

保持 `padding: 0 8px`。去掉面板左右 padding 后，搜索框文字距面板左边界 = 8px，与触发器 `padding: 0 8px` 的文字左缘 8px 完全相等，达成对齐。无需加 `margin`（加 margin 反而会变成 16px，破坏对齐）。

**3. 列表项内边距与 checkbox 不动（`.drs-list-item` / `::before`）**

保持 `padding: 0 8px 0 28px`，checkbox `::before { left: 8px }`。去掉面板左右 padding 后：
- checkbox 左缘距面板左边界 = 8px，与触发器文字 8px 对齐
- 列表项文字距左 = 28px（checkbox 留位），符合「checkbox 保留自身内边距」的确认答案

**4. 无搜索框场景**

`searchEl` 被 `display:none` 时仍在 DOM，`.drs-list` 为 `width:100%` 占满面板内容区，列表项左缘同样到达面板左边界，对齐不变。`.drs-list` 的 `padding-top: 2px` 仅为搜索框与首行呼吸，无搜索框时顶部 2px 空白可接受（视觉无碍）。

**5. 预设模式一致性**

`.drs-preset`（`padding: 0 10px`）同在面板内，去掉左右 padding 后自动左移与触发器对齐，无需额外处理，行为天然一致。

**6. 不改项**

- 触发器样式、搜索框/列表项/预设项自身左右内边距、checkbox 位置均不变
- 滚动条（右侧 8px 暗色）不变，不影响左对齐
- 配色、选中态、行间距（2px 默认）等 v2.8 既有成果全部保留
- capabilities 不变 → GUID 保持 `DateRangeSlicer20260825010`

### 版本与产物

- bump 补丁版本 `2.8.0.3` → `2.8.0.4`（同 GUID 010），强制 PBI 重新加载更新
- 清理 dist 中被取代的 `2.8.0.3` pbiviz 产物，避免误导入
- 构建产物：`dist/DateRangeSlicer20260825010.2.8.0.4.pbiviz`

### 性能与兼容性

- 纯 CSS padding 变更，零运行时开销，`applyStyles()` 不改动
- 旧报表兼容：样式仅收紧内容区，不影响任何 JS 逻辑与筛选行为
- GUID 不变，旧视觉实例重新导入（或覆盖导入）即生效

### 产物校验

解包 `dist/DateRangeSlicer20260825010.2.8.0.4.pbiviz`，对 `resources/DateRangeSlicer20260825010.pbiviz.json` 做关键词匹配：
- `.drs-panel` 的 `padding` 为 `10px 0`（或压缩形态）
- `.drs-search` 的 `padding:0 8px` 保持不变
- `.drs-list-item` 的 `padding:0 8px 0 28px` 保持不变
- 版本号 `2.8.0.4` / GUID `DateRangeSlicer20260825010` 存在

