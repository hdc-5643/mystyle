---
name: pbi-theme-design
displayName: Power BI 主题 JSON 设计方法论
description: 基于已验证的 PBI-Style-深蓝暗色.json 与 PBI-Style-浅色.json，总结 Power BI 主题文件的设计逻辑与可派生方法论——分层色彩阶梯（深浅皆可）、强调色纪律、文字三级灰度、统一圆角边框、导航器状态机、dataColors 语义色板。当用户要新建/复制/改色一套 PBI 主题、调整 visualStyles 全局或导航器、或想把现有主题换成另一套主色/切换深浅时使用。也可用于判断某套主题"是否符合报告阅读习惯"。
agent_created: true
---

# Power BI 主题 JSON 设计方法论

源自 `PBI-Style-深蓝暗色.json`（暗色，已验证：用户基于截图反复评审后接受）与 `PBI-Style-浅色.json`（白底范式，用户确认符合报告阅读习惯）。以下内容是**主题文件本身的底层设计逻辑**，不是 HTML 参考（HTML 顶栏只是可选的视觉对齐基准，不参考也能成立）。掌握这套逻辑即可换主色、切深浅派生任意新主题。

> **场景选型铁律**：营收/分析类"报告"（长时间读数字、常打印投屏）→ 用白底范式；大屏墙/监控指挥中心/暗室演示 → 才用暗色。暗色作报告主体不符合阅读习惯（饱和底刺眼、密集表格可读性差、打印退化）。导航壳可暗、报告主体应白。

## 一、主题文件骨架

```jsonc
{
  "name": "PBI-Style-深蓝暗色",
  "dataColors": [/* 8 个系列色，按顺序循环 */],
  "visualStyles": {
    "*": { "*": { "*": [/* 全局默认 */], "categoryAxis":[...], "valueAxis":[...], "labels":[...], "lineStyles":[...], "title":[...], "background":[...], "border":[...] } },
    "page": { "*": { "*":[/* 页面级 */], "background":[...] } },
    "shape": { "*": { "fill":[...], "outline":[...], "border":[...] } },
    "pageNavigator": { "*": { "fill":[...], "outline":[...], "text":[...], "accentBar":[...], "border":[...] } },
    "bookmarkNavigator": { "*": { "fill":[...], "outline":[...], "text":[...], "border":[...] } }
  }
}
```

- 键三级：`visualType` / `themeVariant` / `propertyName`；`*` 为通配。
- `*`/`*`/`*` 是**全局默认**，覆盖所有视觉的通用属性（背景、边框、轴、标签、标题）。
- `page` 单独定义画布背景（最深的一层）。
- `shape` 是矩形/形状视觉（常用来做顶栏背景壳），需单独配 fill。
- `pageNavigator` / `bookmarkNavigator` 用 `$id`（default/hover/selected/disabled）分状态配 fill/outline/text/accentBar。

## 二、为什么这套"能被接受"——底层逻辑

### 1. 分层色彩阶梯（核心，一切层次感的来源）
颜色不是随便选的，而是一组**有秩序的明度阶梯**，每个界面元素落在不同阶梯上，自然产生纵深：

| 层级 | hex | 用途 |
|---|---|---|
| 页面底（最深） | `#0A1428` | 画布背景 |
| 顶栏 / 导航壳 | `#0F1B30` | shape 填充、pageNavigator 默认底 |
| 卡片 | `#142436` | 视觉对象背景、bookmarkNavigator 默认底、hover 底 |
| 高亮面板 | `#1A2D44` | 选中态背景、pageNavigator hover/selected 底 |
| 分隔线 | `#1E3A5F` | 网格线、shape 轮廓、导航器 disabled 底线 |
| 边框线 | `#2C4A6B` | 视觉对象边框、导航器 outline |

**派生规则**：新主题先定这 6 个阶梯色（一套由深到浅的基底），再叠加品牌强调色。阶梯之间的关系（每级明度差、是否同色相）决定整体气质。

### 2. dataColors 8 色板——按"顺序语义"排布
不是 8 个任意色，而是有角色分工，前两个是品牌主辅色：

| # | hex | 角色 |
|---|---|---|
| 1 | `#378ADD` | 主色（主数据系列 / 强调蓝） |
| 2 | `#7F77DD` | 辅色（二级 / 强调紫，选中态左条） |
| 3 | `#AFA9EC` | 主色浅版（延伸序列） |
| 4 | `#5DCAA5` | 正向（涨 / 正向指标 绿） |
| 5 | `#F0997B` | 负向（跌 / 负向指标 橙红） |
| 6 | `#888780` | 极弱灰（弱化 / 中性数据） |
| 7 | `#B4B2A9` | 次级文字灰（也作第 7 序列） |
| 8 | `#5F5E5A` | 最深灰（禁用 / 空状态） |

**逻辑**：品牌色系（1-3）+ 金融语义色（4 涨绿 / 5 跌橙）+ 灰度收尾（6-8）。营收类报表天然需要"涨绿跌橙"，放色板里最省事。

### 3. 文字三级灰度（清晰可读、不抢数据）
- `#FFFFFF` 纯白：数据标签、选中态文本、标题重点
- `#B4B2A9` 次级灰：坐标轴标签、未选中导航文本、轴标题
- `#5F5E5A` / `#888780` 极弱灰：disabled 文本、弱化数据
全局 `categoryAxis`/`valueAxis` labelColor、`labels.color` 一律走这套。

### 4. 统一圆角与边框纪律
- 全局 `border.radius: 8`（视觉对象统一圆角）
- 全局 `border.color: #2C4A6B`，`border.show: true`
- 圆角与边框是"全局一次性定义"，不逐个视觉去调——保证整页一致性。

### 5. 导航器状态机（交互反馈统一）
`pageNavigator` 和 `bookmarkNavigator` 都按 `$id` 四态配色，状态切换视觉连贯：
- **default**：底色用阶梯中的"壳色/卡片色"，文字次级灰
- **hover**：底色升一阶（卡片→高亮），文字变白
- **selected**：底色用高亮面板、强调色只做收口（pageNavigator 用 `#1A2D44` + 蓝 outline + **紫 left accentBar 3px**；bookmarkNavigator 用 `#1A2D44` + 蓝 outline `#378ADD` + 白字 bold，**不再整片填充紫 `#7F77DD`**——避免导航控件抢数据焦点，与 pageNavigator 同规则）
- **disabled**：底色 `#2C4A6B` + transparency 60，文字极弱灰
**逻辑**：选中态永远用强调色收口，hover 永远只升一阶——用户一眼能分出"在哪、选中了没"。

### 6. 其他"被接受"的默认决策
- `title.show: false`：默认关标题，改用页面级标题 / 书签导航承载，避免原生标题重复且难对齐。
- 轴网格线 `gridlineColor: #1E3A5F`（分隔色，不抢眼）；`valueAxis.gridlineStyle: "dotted"`（虚线更轻）。
- `labels.backgroundColor: #00000000`（透明）+ `color: #FFFFFF`：数据标签任何卡片上都可读。
- `lineStyles.strokeWidth: 3`：线视觉统一加粗到 3px，更醒目。
- `verticalSpacing: 8`：视觉对象间距统一 8px，紧凑整齐。
- `labelDisplayUnits: 1`：轴/标签显示原始单位，不自动缩写（营收金额常需精确）。

## 三、如何派生新主题（换色不改结构）

1. **定基底阶梯（具体推导法）**：选一个最深色当页面底，其余 5 档按"**同色相 + 逐档提亮**"生成，相邻档明度差保持均匀（推荐每档相对前一档亮度 +10%~14%，可直接用 HSL 的 L 值递增，如 L=8→14→20→27→35→44）。以深蓝为例：`#0A1428`(L≈8) → `#0F1B30`(≈13) → `#142436`(≈18) → `#1A2D44`(≈25) → `#1E3A5F`(≈33) → `#2C4A6B`(≈43)。**换主题时只换色相、保留这套 L 序列**，纵深感即一致。生成后用对比度检查：页面底 vs 卡片底 ≥ 1.5:1、卡片底 vs 白字 ≥ 7:1。
2. **定品牌主辅色**：替换 `dataColors[0]`（主）、`[1]`（辅）、`[2]`（主浅版）；选中态强调色建议用辅色。
3. **保留文字三级**：纯白 / 次级灰 / 极弱灰三档换成与新基底对比度达标的灰阶（次级灰建议亮度落在原 `#B4B2A9` 附近）。
4. **保留结构（仅这些与配色无关）**：radius(6)、border.show(true)、title.show:false、gridlineStyle:dotted、labels 透明底白字、导航器四态机、textbox 透明底——原样保留。**但要区分**：`border.color`、`gridlineColor`、`shape.fill`、导航器 fill/outline 属于 6 级阶梯，必须随主题换成新阶梯对应档，不能原样保留。**⚠️ 四态仅限导航器**：`pageNavigator` / `bookmarkNavigator` 才有 default/hover/selected/disabled 四态；`shape` 只有 **default 单态**（外加一个 `{ "show": true }` 基对象），绝不可写 hover/pressed/selected——这是常见错误。
5. **校验**：用 `validate_theme.py`（项目根，schema 2.143）跑一遍，确保 41 个 token、纯 hex、additionalProperties:false 通过。

## 四、白底范式标准（报告默认，符合阅读习惯）

暗色是"从深到浅"的阶梯；白底**反转**为"从浅到深"。核心：画布最浅、视觉对象纯白（更亮一档、靠边框浮起）、边框/文字最深。

**1) 白底 6 级阶梯（层级名与暗色一致，方向相反）**
| 层级 | hex | 用途 |
|---|---|---|
| 画布（最浅） | `#F4F6F8` | 页面背景（报告纸面） |
| 卡片 | `#FFFFFF` | 视觉对象背景（纯白，比画布亮一档形成浮起） |
| 高亮面板 | `#EFF6FC` | 选中态底 / 强调区（极浅蓝） |
| 分隔线 | `#EDEFF2` | 网格线（比边框更浅，不抢眼） |
| 边框线 | `#E1E5EA` | 视觉对象边框 / 导航器 outline（浅灰 1px） |
| 顶栏/导航壳 | `#2E3A45` | shape 填充 / pageNavigator 默认底（暖深灰，不冷不跳）；**pageNavigator 嵌在深色顶栏里必须深色样式，不能套白卡样式；shape 作顶栏壳填暖深灰 `#2E3A45` + 白字，勿填白——白底上白 shape 隐形、整层"形状"毫无发挥** |

> **结构色选择逻辑（关键）**：分析型报表里 shape 只负责"框住页面"，不是品牌视觉锤。所以顶栏要**低饱和中性深灰**（如 `#2E3A45`），不要高饱和品牌蓝（太抢眼、像演示型），也不要死黑（像大屏监控）。暖灰比冷灰更温润、不补丁。

**2) 文字三级（白底反转：白→深灰）**
- `#1F2733` 近黑深灰：标题、数据标签、选中态文本
- `#605E5C` 中灰：坐标轴标签、未选导航文本
- `#BFBFBF` 浅灰：disabled 文本

**3) dataColors（白底上饱和度可略高，背景白需数据色够鲜明）**
| # | hex | 角色 |
|---|---|---|
| 1 | `#2E7DD1` | 主色（经典蓝，白底清晰） |
| 2 | `#7C6FD0` | 辅色（紫，选中态 accentBar） |
| 3 | `#A9CDED` | 主色浅版 |
| 4 | `#2FA572` | 涨（绿） |
| 5 | `#E0603C` | 跌（橙红，白底需更实） |
| 6 | `#A8A6A0` | 极弱灰（弱化数据） |
| 7 | `#86847F` | 次级灰（序列7） |
| 8 | `#C4C4C4` | 禁用浅灰（序列8） |

**4) 白底反转要点**：`labels.color` 必须改深（`#1F2733`，否则白底白字看不见）；`gridlineColor` 用比边框更浅的 `#EDEFF2`；导航器 selected 用极浅蓝底 `#EFF6FC` + 主色蓝 outline `#2E7DD1` 收口；disabled 用浅灰底而非透明。radius(6)/border.show/title.show:false/gridlineStyle:dotted/lineStyles 3px/verticalSpacing 8/textbox 透明底 等结构项与暗色通用。**shape 只有 default 单态，不是四态**。

**5) 派生实战范例：白底（完整可抄，已校验通过）**
实际文件 `PBI-Style-浅色.json` 即本范式落地版，画布 `#E6E9ED` + 卡片 `#FFFFFF` + 浅灰边框 `#E1E5EA` + 主蓝 `#2E7DD1`，可直接导入或改色复用。

**6) 导航器必须按"所在容器底色"分别配色（关键，踩过坑，曾写反）**
白底报告里常见布局：**pageNavigator（页面导航器）嵌在深色顶栏壳**（shape `#1F2A37`）内，**bookmarkNavigator（书签导航器）放在白色卡片**内。两者容器底色不同 → 必须用两套样式，**绝不能共用同一套**：
- **pageNavigator（深色容器 / 顶部）**：default/hover/disabled 底 = 与顶栏同色 `#2E3A45`/`#3A4854`（融入隐形，像幽灵标签），文字 `#C5CED6`→`#FFFFFF`；**selected 用白底药丸 `#FFFFFF` + 深灰字 `#2E3A45` bold + 主蓝左条 `#2E7DD1`（accentBar Left 3px）**。在深灰顶栏上，"白底药丸"比"灰底提亮"干净得多——灰块在深底上显脏、边界不清；白底天然浮起，边界锐利。
- **bookmarkNavigator（白色容器 / 卡片内）**：default 白底 `#FFFFFF` + 浅灰边 `#E1E5EA` + 中灰字 `#605E5C`；hover 极浅灰 `#F0F4F8`；selected 极浅蓝 `#EFF6FC` + 主蓝边 `#2E7DD1` + 深灰字 bold；disabled 浅灰 `#F5F5F5`。**若误把书签导航器设成深色样式，放进白卡就成"黑窟窿"——这是之前实测踩的坑。**
> 判断原则：先看这个导航器实际摆在哪个容器里，再决定用深色还是白卡样式；Power BI 主题无法按容器自动切换，同类型只能一套样式，布局别让同一导航器同时出现在深浅两种容器。

## 五、从参考图派生主题（示例：FineReport 零售门户风）

当用户给一张外部报表/门户截图并要求"按这个风格生成主题"时，按以下步骤提取并映射：

**1) 先判断报表类型**
- 如果参考图是「浅色底 + 白色卡片 + 柔和主色 + 大量留白」的门户/分析型报表 → 直接套用"白底范式"结构。
- 不要凭感觉试色，先用分类定结构（见「场景选型铁律」）。

**2) 从图中提取 6 级阶梯**
| 截图元素 | 提取色 | 主题中的用途 |
|---|---|---|
| 画布/页面底 | 最浅的冷灰白 | `page.background` |
| 顶部标题区 / 侧边栏 | 比画布深一点的浅蓝灰 | `shape.fill`（顶栏壳） |
| 卡片 | 纯白 | `visualStyles.*.*.background` |
| 选中/高亮卡片 | 比卡片深一点的极浅品牌色 | 导航器 selected 底、高亮面板 |
| 卡片边框 | 很淡的灰 | `border.color` |
| 网格线/分隔 | 比边框还淡 | `gridlineColor` |

**3) 提取品牌主辅色**
- 看截图中「最重要的数字、标题、图表」用什么色 → 定为 `dataColors[0]`（主色）。
- 看截图中「次要图表、辅助卡片」用什么色 → 定为 `dataColors[1]`（辅色）。
- 主色浅版 = 主色加白/提亮，用于选中态底、序列 3。
- 若截图里有明显的正向/负向语义色（绿/橙）→ 替换 `dataColors[3]`、`[4]`。

**4) 导航器按容器底色配**
- 如果参考图顶部是**浅色蓝灰条**（不是深色壳）→ pageNavigator 用**浅色融入样式**：default/hover/disabled 与顶栏同色、文字中灰、selected 白底药丸 + 主色 outline/accentBar（白药丸在浅底上对比偏弱，需靠蓝边/左条拉出选中感）。
- 如果参考图顶部是**品牌蓝/深色壳**（如 `#3B6CB4`）→ pageNavigator 用**深色融入样式**：default/hover/disabled 与顶栏同色、文字用淡白（`#D6E2F0`）而非灰字（灰字在蓝底上不可读）、selected 白底药丸 + 蓝字 bold + 主色左条 accentBar（白药丸在蓝底上对比最强、边界最锐利，这是比浅底更优的选中态呈现）。
- 书签导航器若放在白卡里 → 用白卡样式（白底 + 浅灰边 + 主色边选中）。

**5) 命名规范**
- 按项目约定：`PBI-Style-{主题}.json`。
- 示例：`PBI-Style-浅蓝FineReport.json`。

**6) 落地文件（已校验通过）**
- `PBI-Style-浅蓝FineReport.json`：画布 `#F3F6F9`、顶栏壳 **品牌蓝 `#3B6CB4`**（方案 B：品牌蓝顶栏 + 白底主体，层次最稳）、卡片白 `#FFFFFF`、主色 `#3B6CB4`、辅色 `#6A9BD5`、正向绿 `#5CB85C`；shape 圆角 6、**仅 default 单态**（无 hover/pressed/selected）；pageNavigator 在蓝顶栏上用白底药丸 + 蓝字选中、文字淡白融入；bookmarkNavigator 白卡蓝边 + selected 带 accentBar；textbox 透明底、默认深灰字。

## 六、常见坑
- 主题只换 `dataColors` 不换阶梯：视觉对象背景仍是旧色，整页割裂 → 阶梯色（含 border.color、gridlineColor、shape.fill、导航器 fill/outline）必须一起换。
- 圆角/边框写进单个视觉而非 `*`/`*`/`*`：导致只有部分视觉生效 → 全局项放通配键。
- pageNavigator 的 default outline 用与底同色（如 `#0F1B30`）实现"隐身边框"，selected 才露强调色——这是故意的。
- 分隔线比边框更暗（深蓝里 `#1E3A5F` < `#2C4A6B`），网格线用更暗那档才不会比边框还跳；换主题时这对"分隔档 L 略低于边框档"的关系要沿用。
- **阶梯色 vs 结构项混淆**：误把 border.color / gridlineColor 当"结构"原样保留 → 它们属于 6 级阶梯第 5/6 档，必须换；真正可保留的结构是 radius、border.show、title.show:false、gridlineStyle、labels 透明底白字。
- **浅色主题未反转**：本方法论默认暗色。做浅色时须反转阶梯——页面底改最浅、边框改最深；文字三级由 白→深灰、次级灰→中灰、极弱灰→浅灰；强调色与页面底对比仍须达标。
- **page 画布背景键名写错导致静默失效**：`visualStyles.page.*.*.background` 结构是 `"background": [ { "color": { "solid": { "color": "#E6E9ED" } }, "transparency": 0 } ]`——外层属性名是 `background`、内层包色必须用 `color`。曾误写成 `"background": { "solid": {...} }`（内层错用 `background` 键），Power BI 解析匹配不到合法字段会**静默丢弃**，画布回退默认白底。注意：page 这支 schema 较宽松、允许未知键，`validate_theme.py` 不会报此错，出问题时优先肉眼核对键名。
- **shape 只有 default 单态（无四态）**：对照 `reportThemeSchema-2.143.json` 与已验证主题 `PBI-Style-深蓝暗色.json` 确认——`shape` 的 fill/outline 仅支持 `default` 一个状态（外加一个 `{ "show": true }` 基对象），**绝不可写 hover/pressed/selected**。只有 `pageNavigator` / `bookmarkNavigator` 才有 default/hover/selected/disabled 四态 `$id`。误给 shape 写四态是常见错误（会导致 JSON 有冗余状态且不生效）。`border.radius` 与全局卡片 radius 保持一致（建议 6px）。
- **导航器格式被手动锁定导致主题不生效**：pageNavigator/bookmarkNavigator 的 fill/outline/text 若在报表格式面板里手动改过（哪怕只是点开过），该属性被锁定，重导主题不再覆盖 → 看起来"主题没生效"。修复：选中导航器→格式→按钮→填充/轮廓/文字→逐项点「重置为默认值」，或直接删除重加导航器后重导主题。
- **textbox 全局字体颜色无法感知容器底色**：textbox 的字体色在主题里只能设一种；若把它放在蓝色 shape 内做标题，需手动将文本颜色改为白色，主题本身无法做到"在蓝底上自动变白、在白底上自动变黑"。
- **主题只覆盖"默认值"属性（覆盖坑）**：导入主题只作用于仍停留在默认值的属性。若画布背景此前被手动改过（含导过旧主题），该属性被锁定，重导主题不生效。处理：选中页面→格式→画布背景→点小回环"重置为默认值"，或手动填目标色，再重导主题。验证时用新建空白页最干净。
