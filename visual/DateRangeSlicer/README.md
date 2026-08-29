# DateRangeSlicer — 日期区间切片器

Power BI 自定义视觉，提供双模式日期/值筛选。

## 功能

### 预设区间模式（默认）
单列垂直列表，5 个预设：本月 / 上月 / 近7天 / 近15天 / 近30天。选中立即下发 `AdvancedFilter`（介于筛选），预设区间随数据刷新自动跟进。

### 值列表模式
把拖入字段的唯一值列成可搜索的单列列表，支持多选。日期与文本字段均可，用 `BasicFilter`（Is/In）下发。含「（全选）」项和搜索框，降序排列。

格式面板「切片器模式」卡片切换两种模式。

## 布局

- 标头与触发器固定贴视觉对象顶部
- 面板宽度 = 触发器宽度，右边缘贴齐
- 浮层浮在触发器正下方，带阴影与展开动画
- 空间不足自动翻转 / 限高内部滚动 / 极矮退化为流内展开

## 收起方式

点项、再点触发器、Esc、点视觉内非交互空白区、或视觉对象失去焦点。

## 构建

```powershell
cd visual\DateRangeSlicer
npm run package
```

产物在 `dist/DateRangeSlicer20260825008.<version>.pbiviz`。

**注意**：PowerShell 下 `cd` 遇中文路径会报错，须用相对路径。

## 导入

Power BI Desktop → 导入视觉对象 → 选 `dist/` 下的 `.pbiviz`。

改了 `capabilities.json` 后必须换 GUID，否则 PBI Desktop 沿用内存旧实例。

## 技术栈

- Power BI Custom Visuals API 5.4.0
- TypeScript + LESS + Webpack
- 无前端框架依赖

## 当前版本

v2.6.0.0 / GUID `DateRangeSlicer20260825008`

变更历史见 [CHANGELOG.md](./CHANGELOG.md)。
开发知识库见 `visual/powerbi-visual-kb/`。
实战踩坑经验见 `.workbuddy/skills/pbi-custom-visual-dev/SKILL.md`。
