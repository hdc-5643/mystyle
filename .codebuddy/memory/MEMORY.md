# 项目长期记忆：营收概况 / Power BI 视觉对象开发

> **合流说明**（2026-08-29）：本文件合并了 `.workbuddy/memory/MEMORY.md`（8/22–8/28）与
> `.codebuddy/memory/` 的新增内容。`.workbuddy/memory/` 保留为只读历史档案。
> 历史日记（8/22–8/28）见 `.workbuddy/memory/2026-08-*.md`，近期日记见 `.codebuddy/memory/`。

## ⚠️ 三条铁律（2026-08-29 立，优先级最高）

### 1. Python 解释器一律用 `.venv`
- **本项目一律使用 `.venv/Scripts/python.exe`**，禁止用系统 python / miniconda
- 运行脚本：`.venv/Scripts/python.exe <script>`
- 安装依赖：`.venv/Scripts/python.exe -m pip install <pkg>`（清华源可能 403，用 `-i https://pypi.org/simple`）
- 装完必须把直接依赖追加到 `requirements.txt`（只写直接依赖，不冻传递依赖）
- 原因：项目已自包含 venv（python 3.13.12），用系统解释器会导致依赖装错位置、换机器跑不起来
- 知识库脚本已内置解释器守卫，用错解释器会直接退出并提示

### 2. 技能一律建在 `.workbuddy/skills/`
- 现有 2 个技能（`pbi-custom-visual-dev` + `pbi-theme-design`）在此，已入 git
- 创建技能后若落在 `.codebuddy/skills/`，立即移动到 `.workbuddy/skills/`

### 3. 接口签名以本地 typings 为准
- 权威来源：`visual/DateRangeSlicer/node_modules/powerbi-visuals-api/src/visuals-api.d.ts`
- 官方 PDF 含已废弃成员（如 `acquireAADTokenService`），不可作为签名依据
- 速查见 `visual/powerbi-visual-kb/api/visual-host.md`

## 文件与命名约定
- **PBI 主题文件命名格式**：`PBI-Style-"主题".json`（例如 `PBI-Style-深蓝暗色.json`）
- 所有主题/schema 文件在 `theme\` 子目录，HTML 在 `html\`，校验脚本 `validate_theme.py` 与 `requirements.txt` 在项目根
- 校验脚本运行：`.venv/Scripts/python.exe validate_theme.py [主题文件路径]`
- 依赖锁定在 `requirements.txt`；venv 在 `.venv`（python 3.13.12，被 .gitignore 忽略）
- **git clone 后 .venv 不存在**，需重建：`<python 3.13> -m venv .venv` + `.venv/Scripts/python.exe -m pip install -r requirements.txt`

## 设计语言（深蓝暗色主题）
- 页面 `#0A1428`、顶栏/导航壳 `#081426`（8/27 订正，原 `#0F1B30`）、卡片 `#142436`、高亮面板 `#1A2D44`、次级面板 `#111E33`、网格线/分隔 `#1E3A5F`、边框 `#2C4A6B`
- 主色 `#378ADD`、辅色 `#7F77DD`、浅紫 `#AFA9EC`、正向 `#5DCAA5`、负向 `#F0997B`、次级文字 `#B4B2A9`、极弱 `#5F5E5A`、更深 `#060D17`
- 页面导航器默认背景 = 顶栏色 `#081426`；书签导航器默认背景 = `#0A1428`

## 主题设计约定（用户明确要求）
- **改主题 JSON 必须对照 `theme/reportThemeSchema-2.143.json`**，改完用 `validate_theme.py` 校验通过才算完成
- schema 文件带 UTF-8 BOM，读取需用 `utf-8-sig`
- **schema 校验通过 ≠ 运行时生效**：RS 版 2.143 的 pageNavigator `shape` card 圆角疑似 bug，已搁置

## 切片器与筛选器
- 单选/切换类筛选：优先用书签导航器或按钮组 + 书签/字段参数
- **原生切片器圆角限制**：格式面板只有「轮廓」卡片，没有圆角选项
- 多选/类别筛选：可用 Chiclet Slicer 或本项目 DateRangeSlicer 的列表模式

## DateRangeSlicer 自定义视觉（当前 v2.6.0.0，8/29 更新）
- 路径 `visual/DateRangeSlicer/`，GUID `DateRangeSlicer20260825008`
- **双模式**（格式面板「切片器模式」切换）：
  - **预设区间**（默认）：单列 5 个预设（本月/上月/近7/近15/近30），AdvancedFilter 介于筛选
  - **值列表**：字段唯一值多选，日期/文本均可，BasicFilter(Is/In) 下发，含搜索框与「（全选）」
- 布局：标头与触发器固定贴视觉对象顶部（v2.4.4）；面板宽度 = 触发器宽度（v2.5.1）
- 浮层在 iframe 内（无法突破），空间不足自动翻转/限高滚动/极矮兜底
- 回收机制：点预设/再点触发器/Esc/点视觉内空白/失焦均收起
- 构建：`cd visual\DateRangeSlicer; npm run package`（必须相对路径，PowerShell 遇中文路径报错）
- 导入：改 capabilities 后必须换 GUID，否则 PBI Desktop 沿用内存旧实例
- 详细坑点见 `.workbuddy/skills/pbi-custom-visual-dev/SKILL.md`
- **官方知识库**：`visual/powerbi-visual-kb/`（PDF 全文 + API 速查，AI 入口 `00-INDEX.md`）

## iframe 限制（已验证的硬约束）
- 浮层无法突破 iframe 边界：Portal / Top Layer / z-index 全部无效
- `openModalDialog` 可浮出，但外观是"对话框"不是"下拉"（完整用法归档 `.codebuddy/archive/`）
- 原生 `<select>` 弹出层由 OS 渲染，**可突破 iframe**（v2.3.1 验证过，但 option 样式不可控）
- 点画布别处事件不跨 iframe → 面板回收靠 `window blur`
- 视觉无法直接改变自身尺寸（`viewport` 是只读输入）→ 可尝试 `switchFocusModeState` 唤起焦点模式（待实测）

## 工作约定（用户明确要求，8/23）
- **所有生成文件一律放在项目空间**，不要放到用户级
- 适用对象：skill、文档、脚本、临时产物等一切文件

## Power BI Modeling MCP
- 配置：`~/.workbuddy/mcp.json`，用 `npx -y @microsoft/powerbi-modeling-mcp@latest --start`
- **能力边界**：连的是 Analysis Services，**只读/改 model**，**读不到 report/visual 格式配置**

## PBIRS 环境限制
- 用户用 PBIRS（Report Server）版 PBI Desktop 2.143（2025年5月）
- 大概率不支持 .pbip 项目格式，无法走 PBIP 反查 `visual.json`

## 业务命名（待用户拍板统一）
- 同一业务实体三种写法并存：猿推库 / 猪推库 / 波推库，以客户口径为准

## 远程仓库
- `origin` → `https://github.com/hdc-5643/mystyle.git`
- 本地有 7 个未 push 的 commit（截至 8/29）
- dax/html/model 目录已由用户清理删除（8/29 确认）
