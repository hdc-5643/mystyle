---
name: DateRangeSlicer-样式配置完善
overview: 完善切片器样式配置面板：① 触发器文字色独立于强调色；② 选中态背景+文字色独立可配；③ 移除面板阴影与选中态发光；④ 滚动条暗色化且颜色可配置（轨道+滑块）。标头配置已确认齐全不改。
design:
  styleKeywords:
    - Dark theme
    - Minimal
    - Clean
  fontSystem:
    fontFamily: system-ui
    heading:
      size: 14px
      weight: 600
    subheading:
      size: 12px
      weight: 500
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - "#378ADD"
    background:
      - "#142436"
      - "#0A1428"
    text:
      - "#FFFFFF"
      - "#B4B2A9"
    functional:
      - "#2C4A6B"
todos:
  - id: add-capabilities-and-defaults
    content: capabilities.json 新增 5 个 selection 属性 + DEFAULTS 同步 + readSettings 读取
    status: completed
  - id: fix-apply-styles
    content: 修正 --drs-fg 绑定 + 新增 5 个 CSS 变量写入
    status: completed
    dependencies:
      - add-capabilities-and-defaults
  - id: update-less-styles
    content: 移除 3 处 box-shadow + 选中态改用新变量 + 新增暗色滚动条样式
    status: completed
    dependencies:
      - fix-apply-styles
  - id: update-format-panel
    content: getFormattingModel 新增 5 个 ColorPicker 并重新分组
    status: completed
    dependencies:
      - fix-apply-styles
  - id: bump-version-build-verify
    content: pbiviz.json 版本升至 2.7.0.0 + 换 GUID + 构建验证
    status: completed
    dependencies:
      - update-less-styles
      - update-format-panel
---

## 用户需求

完善 DateRangeSlicer 切片器的样式配置面板，核心诉求：

1. **触发器文字色独立**：当前 `--drs-fg` 被绑成 `accentColor`（强调色），改强调色会把触发器文字也变色。需要独立可配。
2. **选中态颜色独立可配**：选中态的背景色和文字色当前硬编码（`rgba(55,138,221,0.18)` 和 `var(--drs-accent)`），需要独立配置项。
3. **移除阴影**：面板 `box-shadow` 和选中态发光 `box-shadow` 用户明确不要。
4. **滚动条优化**：当前是浏览器默认浅色滚动条，在深色面板里太丑太突兀。需要暗色化 + 颜色可配（轨道色 + 滑块色）。
5. **标头文本不动**：9 项配置已齐全，确认不改。

## 改动范围

- `capabilities.json`：selection 对象新增 5 个属性
- `src/visual.ts`：DEFAULTS 加 5 项、readSettings 读 5 项、applyStyles 写 5 个 CSS 变量 + 修正 `--drs-fg` 绑定、getFormattingModel 加 5 个 ColorPicker
- `style/dateRangeSlicer.less`：移除 3 处 box-shadow、选中态改用新变量、新增暗色滚动条样式
- `pbiviz.json`：version 2.6.0.0 → 2.7.0.0，GUID 末位 008 → 009

## Tech Stack

- Power BI Custom Visuals API 5.4.0
- TypeScript + LESS + Webpack
- 无前端框架依赖
- 构建：`npm run package`（相对路径 cd）

## Implementation Approach

### 核心策略
通过 CSS 自定义属性（CSS Variables）传递配置值，与现有模式完全一致。每个新增配置项走「capabilities → DEFAULTS → readSettings → applyStyles → CSS 变量 → LESS 引用」的完整链路。

### 关键修改点

**1. 修正 `--drs-fg` 绑定（最关键的 bug 修复）**

当前：
```typescript
this.root.style.setProperty("--drs-fg", s.accentColor);  // 触发器文字 = 强调色
```
改为：
```typescript
this.root.style.setProperty("--drs-fg", s.triggerTextColor);  // 独立
```

**2. 选中态变量化**
新增 `--drs-list-active-fg` 和 `--drs-list-active-bg`，替换 LESS 中硬编码的 `rgba(55,138,221,0.18)` 和 `var(--drs-accent)`。

**3. 滚动条暗色化**
新增 `--drs-scrollbar-track` 和 `--drs-scrollbar-thumb`，在 LESS 中添加 `::-webkit-scrollbar` 系列伪元素。滚动条样式应用于 `.drs-panel`、`.drs-list`、`.drs-inline-mode` 三个可滚动区域。

**4. 移除阴影**
- `.drs-panel` 的 `box-shadow: 0 8px 24px rgba(0,0,0,.45)` → 移除
- `.drs-preset.active` 的 `box-shadow: 0 0 8px rgba(55,138,221,0.25)` → 移除
- `.drs-list-item.active` 同上 → 移除

### 性能考量
- CSS 变量方式零运行时开销，`applyStyles()` 只在 update 时调用一次
- 滚动条伪元素是纯 CSS，无 JS 监听
- 不新增 DOM 元素，不改变现有事件绑定

### 兼容性
- 旧报表无新属性时，readSettings 回落 DEFAULTS 默认值
- GUID 变更后旧视觉实例需重新导入（capabilities 变更的硬性要求）

## Design Approach

本次为配置面板功能增强，不涉及 UI 视觉重构。样式改动聚焦于：

1. **移除视觉噪声**：面板阴影和选中态发光去掉，让界面更干净
2. **暗色滚动条**：细窄暗色滑块（6px 宽），与深色面板融为一体，不再突兀
3. **配置面板分组优化**：现有"下拉样式"卡片的 9 个配置项 + 新增 5 个 = 14 项，按功能分为"触发器""面板""列表项""滚动条"4 组更清晰

### 格式面板"下拉样式"卡片分组规划

| 分组 | 配置项 |
|---|---|
| 触发器 | 背景色、文字色（新）、边框颜色、边框粗细、圆角 |
| 面板 | 下拉面板背景色、下拉面板文字色 |
| 列表项 | 悬浮文字色、悬浮背景色、选中文字色（新）、选中背景色（新）、强调色 |
| 滚动条 | 轨道色（新）、滑块色（新） |

## Agent Extensions

### SubAgent
- **code-explorer**
  - Purpose: 在实施前用 LSP 语义分析验证 `applyStyles()` 和 `getFormattingModel()` 的完整调用链，确认无遗漏的 CSS 变量引用点
  - Expected outcome: 确认所有 `--drs-*` 变量的引用位置，确保新增变量无遗漏、移除的 box-shadow 无副作用
