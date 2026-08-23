# 项目长期记忆：营收概况 / Power BI 主题

## 文件与命名约定
- **PBI 主题文件命名格式**：`PBI-Style-"主题".json`（例如 `PBI-Style-深蓝暗色.json`）。首个主题文件由 `主题-通用版.json` 重命名为 `PBI-Style-深蓝暗色.json`（2026-08-22）。后续所有 PBI 主题文件一律沿用此格式。
- 校验脚本 `validate_theme.py` 默认校验 `PBI-Style-深蓝暗色.json`，可传参校验其他主题；运行：`.venv/Scripts/python.exe validate_theme.py`。
- 依赖锁定在 `requirements.txt`（`jsonschema==4.26.0`）；venv 在 `营收概况/.venv`（managed python 3.13.12），项目完全自包含。

## 设计语言（深蓝暗色主题，对齐顶部导航版 HTML）
- 页面 `#0A1428`、顶栏/导航壳 `#0F1B30`、卡片 `#142436`、高亮面板 `#1A2D44`、次级面板 `#111E33`、网格线/分隔 `#1E3A5F`、边框 `#2C4A6B`。
- 主色 `#378ADD`、辅色 `#7F77DD`、浅紫 `#AFA9EC`、正向 `#5DCAA5`、负向 `#F0997B`、次级文字 `#B4B2A9`、极弱 `#5F5E5A`、更深 `#060D17`。
- 页面导航器默认背景 = 顶栏色 `#0F1B30`（非页面底色 `#0A1428`）；书签导航器默认背景 = `#0A1428`。

## 切片器与筛选器
- 单选/切换类筛选：优先不用原生切片器，改用**书签导航器**或**按钮组 + 书签/字段参数**，可控性最高、最接近 HTML 药丸/胶囊风格。
- 多选/类别筛选：可用 **Chiclet Slicer** 自定义视觉（免费，药丸/标签云）。
- 原生切片器主题兜底：`slicer` / `advancedSlicerVisual` / `textSlicer` 已写入 `PBI-Style-深蓝暗色.json`，容器背景 `#142436`、边框隐藏、圆角 6px、文字 `#B4B2A9`、日期切片器隐藏原生日历图标 (`hideDatePickerButton: true`)。
- 顶栏高度（Power BI 画布 1280 宽，1px≈1px）：品牌+日期行 ≈64px、导航行 ≈48px、下沿 1px `#1E3A5F` 线，矩形形状高度设 112px；顶栏底色用矩形形状填 `#0F1B30`，与导航器叠放分组。

## 工程要点
- 主题 schema 2.143：顶层 `additionalProperties:false`，41 个 token，颜色均为纯 hex；`visualStyles` 支持 `*` 全局与 `report/page` 写法；`pageNavigator`/`bookmarkNavigator` 按 `$id`（default/hover/selected/disabled）分状态填 `fill`/`outline`/`text`/`accentBar`。
- schema 文件带 UTF-8 BOM，读取需用 `utf-8-sig`。

## 工作约定（用户明确要求，2026-08-23）
- **所有对话中生成的文件一律放在项目空间**（即 `营收概况\.workbuddy\` 下），**不要**放到用户级 `~/.workbuddy\`。
- 适用对象：skill、文档、脚本、临时产物等一切本对话产生的文件。
- 背景：此前误把 `pbi-custom-visual-dev` skill 建在用户级，已纠正移动到 `营收概况\.workbuddy\skills\`；今后默认项目级，即便系统默认建议"用户级"也应优先本项目空间。
- 项目级 skill 目录：`营收概况\.workbuddy\skills\`；主题设计方法论见 `pbi-theme-design` skill，pbiviz 开发见 `pbi-custom-visual-dev` skill。
