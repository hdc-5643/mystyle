---
name: DateRangeSlicer-v2.11-间距收敛与滚动条精简
overview: "基于 v2.10.0.0 做三项调整：(1) 预设项默认背景色默认值改为 #193653；(2) 搜索框与输入框底部间距收敛到约 1px（改面板 padding 与列表顶部呼吸）；(3) 滚动条配置仅保留轨道色和滑块色，删除 scrollbarWidth/scrollbarArrowColor/scrollbarShowArrow 三个属性并恢复 LESS 固定样式。换 GUID 012→013、版本 2.10.0.0→2.11.0.0。"
todos:
  - id: defaults-config
    content: "DEFAULTS 改 presetBackground 为 #193653、panelPaddingY 10→1；capabilities 删除 3 个滚动条属性；readSettings/applyStyles 清理对应链路"
    status: completed
  - id: format-panel
    content: getFormattingModel 滚动条组精简为只留轨道色/滑块色
    status: completed
    dependencies:
      - defaults-config
  - id: less-adjust
    content: LESS 改 .drs-panel gap 为 0、.drs-list padding-top 为 1px、滚动条恢复固定宽度+隐藏箭头
    status: completed
  - id: build-verify
    content: pbiviz.json 换 GUID 013 + 2.11.0.0，构建并解包校验关键词
    status: completed
    dependencies:
      - defaults-config
      - format-panel
      - less-adjust
  - id: changelog-commit
    content: 补 CHANGELOG 并本地 commit（不 push），清理旧 2.10.0.0 产物
    status: completed
    dependencies:
      - build-verify
---

## 用户需求

用户要求基于当前 **v2.10.0.0**（commit 515046d）做 **v2.11.0.0** 迭代，共 3 项：

1. **预设项默认背景色默认值改为 `#193653`**  
   当前「下拉样式 → 值 → 预设项默认背景色」默认是 `rgba(255,255,255,0.03)`，用户要求与输入框/面板背景统一为 `#193653`。

2. **搜索框与输入框底部间距缩小到约 1px**  
   当前截图显示搜索框与触发器（输入框）底部之间存在明显空隙。要求收敛到"留个 1px 就好了"。

3. **滚动条配置精简**  
   当前滚动条配置项过多（轨道色、滑块色、宽度、箭头颜色、显示箭头）。用户要求只保留「轨道色」和「滑块色」，其余删除。

4. **版本/GUID 升级**  
   因 capabilities 属性删除/新增，换 GUID `DateRangeSlicer20260825012` → `DateRangeSlicer20260825013`，版本 `2.10.0.0` → `2.11.0.0`。



## 技术栈

- Power BI Custom Visuals API 5.4.0
- TypeScript + LESS + Webpack
- 无前端框架依赖
- 构建命令：`cmd /d /c "chcp 65001 >nul & cd /d c:\Users\hdc\Desktop\营收概况\visual\DateRangeSlicer && npm run package"`

## 实现方案

### 总体策略
沿用既有「capabilities 声明 → DEFAULTS → readSettings → applyStyles(setProperty) → LESS var()」链路。本次为收敛型小改：改 1 个默认值、删 3 个滚动条可配项、收紧面板/列表内边距。JS 交互逻辑完全不动。

### 关键修改点

**1. 预设默认背景改 `#193653`**
- `DEFAULTS.selection.presetBackground`：`rgba(255,255,255,0.03)` → `"#193653"`
- `capabilities.json` 与格式面板保持不变，仅回落默认值变更

**2. 搜索框与输入框底部间距收敛到 1px**
当前间距构成：
- 面板与输入框间距：`panelOffset` = 0px
- 面板上下内边距：`panelPaddingY` = 10px
- 面板 `gap`：10px
- 列表区顶部内边距：2px

计划改为：
- `.drs-panel` 的 `gap: 10px` → `gap: 0`
- `DEFAULTS.selection.panelPaddingY`：`10` → `1`（格式面板仍保留可配，用户后续可调）
- `.drs-list` 的 `padding-top: 2px` → `padding-top: 1px`
- LESS `.drs-panel` 的 fallback 同步：`padding: var(--drs-panel-pad-y, 10px) ...` → `var(--drs-panel-pad-y, 1px) ...`

这样搜索框上边缘距输入框底部 ≈ `panelOffset(0) + panelPaddingY(1) = 1px`；搜索框下边缘距值列表 ≈ `list padding-top(1px)`。

**3. 滚动条配置精简**
删除以下 3 个 capabilities 属性：
- `scrollbarWidth`（滚动条宽度）
- `scrollbarArrowColor`（滚动条箭头颜色）
- `scrollbarShowArrow`（滚动条显示箭头）

同步清理：
- `DEFAULTS.selection` 删除这 3 项
- `readSettings` 删除对应读取
- `applyStyles` 删除 `--drs-scrollbar-w`、`--drs-scrollbar-arrow`、`--drs-scrollbar-arrow-on` 三个 CSS 变量
- `getFormattingModel`「滚动条」组只保留「轨道色」和「滑块色」
- LESS 恢复：
  - `::-webkit-scrollbar` width/height 固定为 `8px`
  - `::-webkit-scrollbar-button` 固定 `display: none; width: 0; height: 0`
  - 保留 `scrollbar-width: thin` 与 `scrollbar-color`（颜色仍由变量驱动）

**4. GUID/版本**
- `pbiviz.json`：`guid` `011` → `013`，`version` `2.10.0.0` → `2.11.0.0`
- `displayName` 改为「日期区间切片器 v2.11-精简滚动条配置」
- `description` 概述本次 3 项调整

## 目录结构

```
visual/DateRangeSlicer/
├── capabilities.json              # [MODIFY] 删除 scrollbarWidth/scrollbarArrowColor/scrollbarShowArrow
├── pbiviz.json                    # [MODIFY] guid 012→013、version→2.11.0.0、displayName/description
├── src/visual.ts                  # [MODIFY] DEFAULTS.presetBackground→#193653、panelPaddingY 10→1；删除 3 项滚动条默认；readSettings/applyStyles 清理；getFormattingModel 滚动条组精简
├── style/dateRangeSlicer.less     # [MODIFY] .drs-panel gap→0、.drs-list padding-top→1px、滚动条恢复固定
├── CHANGELOG.md                   # [MODIFY] 顶部插入 2.11.0.0 条目
└── dist/                          # [MODIFY] 新增 013.2.11.0.0.pbiviz，清理旧 2.10.0.0 产物
```

## 产物校验

解包 `dist/DateRangeSlicer20260825013.2.11.0.0.pbiviz`（zip 格式），校验：
- `presetBackground` 默认值 `#193653`
- 无 `scrollbarWidth`/`scrollbarArrowColor`/`scrollbarShowArrow` 属性
- 无 `--drs-scrollbar-w`/`--drs-scrollbar-arrow`/`--drs-scrollbar-arrow-on` 变量
- `.drs-panel` 的 `gap` 为 `0`
- `.drs-list` 的 `padding-top` 为 `1px`
- `::-webkit-scrollbar` width/height 固定 `8px`
- `::-webkit-scrollbar-button` 固定 `display:none`
- 版本 `2.11.0.0` / GUID `013`

## 性能与兼容性

- CSS 变量删除后 LESS 回归固定值，无运行时开销变化
- 滚动条宽度恢复固定 8px，箭头恢复默认隐藏
- 因删除 capabilities 属性，必须换 GUID；旧报表中已手动调整过这 3 项的值会丢失，回落到固定 8px/隐藏
- 面板上下内边距默认值变为 1px，但 `panelPaddingY` 仍保留可配，用户可调


