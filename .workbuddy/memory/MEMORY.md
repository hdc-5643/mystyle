# 项目长期记忆：营收概况 / Power BI 主题

## 文件与命名约定
- **PBI 主题文件命名格式**：`PBI-Style-"主题".json`（例如 `PBI-Style-深蓝暗色.json`）。首个主题文件由 `主题-通用版.json` 重命名为 `PBI-Style-深蓝暗色.json`（2026-08-22）。后续所有 PBI 主题文件一律沿用此格式。
- **所有主题/schema 文件在 `mystyle\theme\` 子目录**（不在项目根；git clone 后结构如此）。HTML 在 `mystyle\html\`，校验脚本 `validate_theme.py` 与 `requirements.txt` 在项目根 `mystyle\`。
- 校验脚本 `validate_theme.py` 默认校验 `theme/PBI-Style-深蓝暗色.json`，可传参校验其他主题；运行：`.venv/Scripts/python.exe validate_theme.py`（脚本内 SCHEMA/DEFAULT_THEME 已指向 `theme\` 子目录）。
- 依赖锁定在 `requirements.txt`（`jsonschema==4.26.0`）；venv 在 `mystyle/.venv`（managed python 3.13.12，项目内自包含）。**git clone 后 .venv 不存在**（被 .gitignore 忽略），需重建：`<managed python 3.13.12> -m venv .venv` 然后 `.venv/Scripts/python.exe -m pip install -r requirements.txt`。

## 设计语言（深蓝暗色主题，对齐顶部导航版 HTML）
- 页面 `#0A1428`、顶栏/导航壳 `#081426`（2026-08-27 订正，原 `#0F1B30`）、卡片 `#142436`、高亮面板 `#1A2D44`、次级面板 `#111E33`、网格线/分隔 `#1E3A5F`、边框 `#2C4A6B`。
- 主色 `#378ADD`、辅色 `#7F77DD`、浅紫 `#AFA9EC`、正向 `#5DCAA5`、负向 `#F0997B`、次级文字 `#B4B2A9`、极弱 `#5F5E5A`、更深 `#060D17`。
- 页面导航器默认背景 = 顶栏色 `#081426`（2026-08-27 订正，原 `#0F1B30`；非页面底色 `#0A1428`）；书签导航器默认背景 = `#0A1428`。

## 切片器与筛选器
- 单选/切换类筛选：优先不用原生切片器，改用**书签导航器**或**按钮组 + 书签/字段参数**，可控性最高、最接近 HTML 药丸/胶囊风格。
- **原生切片器圆角限制**（2026-08-25 验证）：PBI 原生切片器格式面板只有「轮廓」卡片能改边框颜色/宽度/透明度，**没有圆角选项**——本体固定直角矩形；圆角只能靠主题 JSON 全局 `visualOutline` 设，但 RS 2.143 切片器多半不吃该值。这是走书签导航器路线的核心补充论据之一。
- 多选/类别筛选：可用 **Chiclet Slicer** 自定义视觉（免费，药丸/标签云）。
- **DateRangeSlicer 自定义视觉**：只保留「介于」样式（圆角深色日期输入框，好用）；「下拉」样式（v1.1–v1.5 多版本迭代后）放弃——自定义 DOM 弹层飘不出 sandboxed iframe（CalendarPro 作者亦承认），原生 `<select>` 单选能漂浮但多选变列表框形态差距大。多选日期走书签导航器，单选日期可装 PBI 原生切片器接受圆角不可改。
- 原生切片器主题兜底：`slicer` / `advancedSlicerVisual` / `textSlicer` 已写入 `PBI-Style-深蓝暗色.json`，容器背景 `#142436`、边框隐藏、圆角 6px、文字 `#B4B2A9`、日期切片器隐藏原生日历图标 (`hideDatePickerButton: true`)。
- 顶栏高度（Power BI 画布 1280 宽，1px≈1px）：品牌+日期行 ≈64px、导航行 ≈48px、下沿 1px `#1E3A5F` 线，矩形形状高度设 112px；顶栏底色用矩形形状填 `#081426`（2026-08-27 订正，原 `#0F1B30`），与导航器叠放分组。

## 工程要点
- 主题 schema 2.143：顶层 `additionalProperties:false`，41 个 token，颜色均为纯 hex；`visualStyles` 支持 `*` 全局与 `report/page` 写法；`pageNavigator`/`bookmarkNavigator` 按 `$id`（default/hover/selected/disabled）分状态填 `fill`/`outline`/`text`/`accentBar`。
- schema 文件带 UTF-8 BOM，读取需用 `utf-8-sig`。

## 主题设计约定（用户明确要求，2026-08-24）
- **后续设计/修改任何主题视图 JSON，都必须参考 `theme\reportThemeSchema-2.143.json`**：所有 property 名、类型、允许值以 schema 为准，改完用 `validate_theme.py` 校验通过才算完成。
- pageNavigator / bookmarkNavigator 的视觉对象自身开关（如 `showHiddenPages`、`orientation` 等）放在 visualStyles → 该视觉对象 → `*` → `*` 数组的 item 里（视觉对象自身样式层）。
- **"视觉对象常规 → 形状"卡片（按钮圆角/形状类型）放在该视觉对象的 `shape` card 里**（不是 `*` item）：pageNavigator 的 `shape` card（schema line 7272）含 `tileShape`（形状枚举）+ `rectangleRoundedCurve`（圆角度数）；要让按钮圆角生效需 `tileShape: "rectangleRoundedByPixel"` + `rectangleRoundedCurve: 6`，只写 `rectangleRoundedCurve` 不设 `tileShape` 不生效。
- 已落地（深蓝暗色-优化）：pageNavigator `showHiddenPages: false`（`*` item）+ `shape` card 设 `tileShape: "rectangleRoundedByPixel"` + `rectangleRoundedCurve: 6`（按钮圆角 6px）。

## 工作约定（用户明确要求，2026-08-23）
- **所有对话中生成的文件一律放在项目空间**（即 `营收概况\.workbuddy\` 下），**不要**放到用户级 `~/.workbuddy\`。
- 适用对象：skill、文档、脚本、临时产物等一切本对话产生的文件。
- 背景：此前误把 `pbi-custom-visual-dev` skill 建在用户级，已纠正移动到 `营收概况\.workbuddy\skills\`；今后默认项目级，即便系统默认建议"用户级"也应优先本项目空间。
- 项目级 skill 目录：`营收概况\.workbuddy\skills\`；主题设计方法论见 `pbi-theme-design` skill，pbiviz 开发见 `pbi-custom-visual-dev` skill。

## Power BI Modeling MCP（2026-08-24）
- MCP 配置：`~/.workbuddy/mcp.json`，用 `npx -y @microsoft/powerbi-modeling-mcp@latest --start`（全局 npx 链路，未固化到项目）。
- 工具引用方式：21 个 deferred tool，命名 `mcp__powerbi-modeling-mcp__{操作类型}`，需先 `ToolSearch` 加载 schema 再 `DeferExecuteTool` 调用；入口参数统一为 `request`，必填 `operation`。
- 典型流程：`connection_operations.ListLocalInstances` 找本地 PBI Desktop 端口 → `Connect` → `database_operations.List` → `measure_operations` 等增删改。
- **能力边界（重要）**：MCP 连的是 Analysis Services（model 引擎），**只读/改 model**（表/度量/关系/计算组/层次结构/透视/安全角色等），**读不到 report/visual 格式配置**（如 pageNavigator 按钮圆角、fill 颜色、border、书签内容等 visual 级格式）——这些在 Report 引擎，不通过 AS 暴露；`ExportTMDL`/`ExportTMSL` 导出也只含 model。要反查 visual 格式 property 名，不能用 MCP。
- **项目内固化方案已搁置**：曾尝试在项目根建 `package.json` 锁 `0.5.0-beta.12` + `npm install` 装到 `mystyle\node_modules\`，但 mcp.json 仍用 `npx @latest` 未引用项目内包；当前 registry/npx缓存/项目内三处版本均为 `0.5.0-beta.12`（巧合），npx 会自动追新，项目内锁版本需手改 mcp.json 切到项目内 bin（`mystyle\node_modules\@microsoft\powerbi-modeling-mcp\index.js`）才真正生效。用户决定暂不切换，已卸载项目内 package.json/package-lock.json/node_modules，保留全局 npx 方式，后续再说。

## 主题 property 验证方法论（2026-08-24，踩坑总结）
- **schema 校验通过 ≠ 运行时生效**：`reportThemeSchema-2.143.json` 是"允许列表"，property 写了不报错不代表 PBI 渲染器会读。**但更要警惕的是层级写错**：同一个 property 名（如 `rectangleRoundedCurve`）在 schema 里可能出现在 `*` item 和 `shape` card 两处，写错层级不生效。
- **PBIRS 环境限制**：用户用 PBIRS（Report Server）版 PBI Desktop 2.143（2025年5月），**大概率不支持 .pbip 项目格式**（云版功能），无法走 PBIP 反查 `visual.json`。
- **RS 版可用的 visual 格式反查方法**（按可信度）：
  1. 手动设置 + 截图反推（最快）：PBI Desktop 里手动设值，看 UI 卡片名/property 名，反推主题写法。
  2. 解压 .pbix/.pbit 看 `Report/Layout`（新版多为压缩二进制，难读；RS 版可能 XML）。
  3. Power BI Modeling MCP（❌ 只管 model，读不到 visual）。
- **pageNavigator 按钮圆角（最终结论：疑似 RS bug，已搁置）**：
  - 第一次写 `*` item 里 `rectangleRoundedCurve` → 不生效（误判"引擎不读"）。
  - 第二次改到 pageNavigator `shape` card（schema line 7272）设 `tileShape: "rectangleRoundedByPixel"` + `rectangleRoundedCurve: 6` → **仍不生效**（重新导入主题 + 重置视觉对象格式后按钮仍无圆角）。
  - 判断：RS 版 2.143 的 pageNavigator `shape` card 主题控制**疑似未实现或 bug**。用户决定先放弃，改用 accentBar + outline 模拟观感。
  - 当前 `PBI-Style-深蓝暗色-优化.json` 的 pageNavigator `shape` card 配置保留（语法对、校验通过、不影响其他），待后续 RS 版本验证。
  - 教训：schema 校验通过 ≠ 层级对 ≠ 运行时生效；property 可能属于 `*` item 或具体 card（shape/border/fill），且即使层级对，RS 版渲染器也可能不实现。

## DateRangeSlicer 自定义视觉（当前 v2.2.0.0，2026-08-26）
- 路径 `mystyle/visual/DateRangeSlicer/`，**只保留「介于」模式**（v1.9 起砍掉下拉：下拉弹层挂 `document.body` 飘不出 sandboxed iframe，已废弃）。
- **v2.2.0.0 回归简版**（用户选 B）：砍掉 v2.0/v2.1 的预设按钮组/三层折叠面板/应用按钮/摘要条，回到**常驻「介于」双深色圆角输入框**（标头可选 + 开始→结束，原生日历），无折叠/预设/应用。手动改输入框即**立即下发** AdvancedFilter。
- **默认当月**：格式面板「默认行为 → 默认本月」开关（默认**开**），首次加载自动套 `[最新日期所在月首日, 最新日期]`（MTD）并下发，随数据刷新跟进；关闭则显示数据边界但不下发（全量）。`style.mode` 已无「下拉」选项。
- 构建：`pbiviz package`（managed node v22.22.2 + 项目内 `node_modules/powerbi-visuals-tools/bin/pbiviz.js`）；导入 PBI Desktop 需先删旧实例再重导。GUID 不变（`DateRangeSlicer20260825004`）热升级。
- 详细坑点与代码模板见项目级 `pbi-custom-visual-dev` skill。

## 业务命名不一致（待用户拍板统一，2026-08-26 发现）
- 同一业务实体在项目内三种写法并存：
  - `mystyle/html/5营收概况_模型关系图.html:41` → "**猿推库**"
  - `mystyle/html/营收分析-顶部导航版.html:216` → "**猪推库**-服务费"
  - 用户截图 + 新效果图 → "**波推库**"
- 来源不同：模型关系图按 AS 表名（"猿推库团长订单"），顶部导航版按 KPI 标签（"猪推库-服务费"），效果图按用户口语截图。
- **以客户口径为准**，待用户确认到底叫哪种，再全局替换（约 5 处 HTML + 度量命名）。

## 收入趋势卡片 HTML 效果图（2026-08-26）
- 文件：`mystyle/html/营收分析-收入趋势效果图.html`，深蓝暗色主题，单卡 SVG 双线带状原型。
- 布局：第 1 行 4 tab(服务费/MCN/星图/总营收) + 右上"详情 →"按钮同行；第 2 行"收入趋势"标题 + 图例(波推库/智趣)两端对齐；主图双折线带状(波推库 #378ADD + 智趣 #7F77DD + 中间 fill-opacity 0.13 差距带)。
- 详情按钮已接跳转逻辑：`window.top.postMessage({type:'navigate', page:'revenue-detail', tab:...}, '*')` 给外壳 React 监听 + `window.open` 兜底（注释保留）；本地预览用 alert 弹 msg 调试。
- **卡内 `⚠️ 口径提示` 条**：Tab 维度(计费类型) vs 图例维度(业务线) 不对齐——解法 A（tab 改 波推库/智趣/合计，推荐）或 解法 B（图例改 服务费/激活金额），待用户拍板再改。
- 上一版 `营收分析-顶部导航版.html` 的"收入趋势"段(line 240-249)仍是"标题 + 5 色图例"老版，未与新版同步。

## 分渠道收益率（异构率）效果图（2026-08-26）
- 文件：`mystyle/html/营收分析-分渠道收益率效果图.html`（早期版本 `营收分析-分渠道毛利率效果图.html` 已被取代，口径误用统一毛利率）。
- **业务口径（用户拍板，重要）**：4 渠道的"率"定义不同，**不可跨组按数值高低排序/统一阈值着色**：
  - **智趣** → 服务费率（服务费 ÷ 订单金额）— 橙系 #EF9F27 / #BA7517
  - **猿推库** → 服务费率（同上）— 橙系 #EF9F27 / #BA7517
  - **MCN** → 佣金率（佣金 ÷ GMV）— 蓝系 #378ADD
  - **星图** → 毛利率（(收入 − 成本) ÷ 收入）— 绿系 #5DCAA5
- **设计原则**：3 个分组（服务费率 / 佣金率 / 毛利率），每组顶部有组名 + 口径说明（如"服务费 ÷ 订单金额"），**只在组内对比**；顶部汇总也是 4 个异构率分别列出，**不合并成"综合毛利率"**（异构率加权无意义）。
- **PBI 落地路径**：HTML Content 视觉对象 + DAX 度量拼字符串（一个 `分渠道收益率_HTML` 度量把 4 个子度量的值拼成完整 HTML 字符串，拖到 HTML Content 视觉对象的"值"字段渲染）。**不用原生条形图**——原生做不了"异构分组+副标+口径说明+独立阈值"这种复合视图。
- **未决**：成本/分成字段是否存在（无成本数据则星图毛利率无法算，需要先补度量）；业务命名"波推库/猿推库/猪推库"仍未统一。
