---
name: pbi-theme-design
displayName: Power BI 主题 JSON 设计方法论
description: 基于已验证的 PBI-Style-深蓝暗色.json，总结 Power BI 主题文件的设计逻辑与可派生方法论——分层色彩阶梯、强调色纪律、文字三级灰度、统一圆角边框、导航器状态机、dataColors 语义色板。当用户要新建/复制/改色一套 PBI 主题、调整 visualStyles 全局或导航器、或想把现有主题换成另一套主色时使用。也可用于理解为什么某套深色主题"能被接受"。
agent_created: true
---

# Power BI 主题 JSON 设计方法论

源自 `PBI-Style-深蓝暗色.json`（已验证：用户基于截图反复评审后接受）。以下内容是**主题文件本身的底层设计逻辑**，不是 HTML 参考（HTML 顶栏只是可选的视觉对齐基准，不参考也能成立）。掌握这套逻辑即可换主色派生任意新主题。

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
- **selected**：底色用强调色（pageNavigator 用 `#1A2D44` + 蓝 outline + **紫 left accentBar 3px**；bookmarkNavigator 直接填充紫 `#7F77DD` + 白字 bold）
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

1. **定基底阶梯**：选一个最深色当页面底，向上推 5 级明度得到 顶栏→卡片→高亮→分隔→边框（保持相邻级差一致）。
2. **定品牌主辅色**：替换 `dataColors[0]`（主）、`[1]`（辅）、`[2]`（主浅版）；选中态强调色建议用辅色。
3. **保留文字三级**：纯白 / 次级灰 / 极弱灰三档换成与新基底对比度达标的灰阶（次级灰建议亮度落在原 `#B4B2A9` 附近）。
4. **保留结构**：radius、border.show、title.show:false、gridlineStyle:dotted、labels 透明底白字、导航器四态机——这些与配色无关，原样保留。
5. **校验**：用 `validate_theme.py`（项目根，schema 2.143）跑一遍，确保 41 个 token、纯 hex、additionalProperties:false 通过。

## 四、常见坑
- 主题只换 `dataColors` 不换阶梯：视觉对象背景仍是旧色，整页割裂 → 阶梯色必须一起换。
- 圆角/边框写进单个视觉而非 `*`/`*`/`*`：导致只有部分视觉生效 → 全局项放通配键。
- pageNavigator 的 default outline 用与底同色（如 `#0F1B30`）实现"隐身边框"，selected 才露强调色——这是故意的。
- 分隔线 `#1E3A5F` 比边框 `#2C4A6B` 更暗，网格线用更暗那档才不会比边框还跳。
