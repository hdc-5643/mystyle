---
name: pbi-custom-visual-dev
displayName: Power BI 自定义视觉(pbiviz)开发实战
description: 开发 Power BI 自定义视觉（DateRangeSlicer 等日期/范围切片器）的踩坑经验与可复用工作流，覆盖 input[type=date] 原生行为、筛选下发、格式化模型、时区、主题对齐等硬骨头。当用户要做 PBI 自定义视觉、日期切片器、applyJsonFilter/AdvancedFilter 筛选、Formatting Model 面板，或遇到日历图标/日期格式/占位符/字号不生效等问题时使用。
agent_created: true
---

# Power BI 自定义视觉(pbiviz)开发实战

源自 DateRangeSlicer（日期区间切片器，深色主题对齐 HTML 顶栏）的多轮迭代。下面的坑都是真踩过的，按"现象→根因→解法"给。

## 一、工具链与构建（本项目固定路径）

- **运行时**：用 managed node v22.22.2，不要系统 node。包隔离在 `visual/<Name>/node_modules`。
- **依赖**：`powerbi-visuals-tools ^5.1.1`、`powerbi-visuals-api ~5.4.0`、webpack5、less4。
- **构建**：`npm run package` → 产物 `dist/<GUID>.<version>.pbiviz`。GUID/version 在 `pbiviz.json`。
- **导入**：Power BI Desktop 里"导入视觉对象"选 dist 里的 .pbiviz。改完重新 build 后，**先删画布上的旧视觉实例再重新导入**，否则渲染的仍是旧实例。

### 完整依赖清单（package.json 模板）
新建视觉对象时直接复制下面结构。`name` 必须改成你的视觉名——**注意**：本项目 `visual/DateRangeSlicer/package.json` 仍残留 `@microsoft/powerbi-visuals-chicletslicer`（复制 ChicletSlicer 模板未改），复制模板后请务必改掉；视觉真实 GUID/version 由 `pbiviz.json` 决定，不影响构建。核心必需项：

```json
{
  "name": "your-visual-name",
  "version": "1.0.0.0",
  "scripts": {
    "pbiviz": "pbiviz",
    "start": "pbiviz start",
    "package": "pbiviz package",
    "cert": "pbiviz --install-cert"
  },
  "devDependencies": {
    "powerbi-visuals-tools": "^5.1.1",
    "powerbi-visuals-api": "~5.4.0",
    "typescript": "^5.2.2",
    "webpack": "^5.88.2",
    "ts-loader": "^9.4.4",
    "less": "^4.2.0",
    "css-loader": "^6.8.1",
    "style-loader": "^3.3.3",
    "@types/webpack": "^5.28.2"
  },
  "dependencies": {
    "powerbi-models": "^1.12.6",
    "powerbi-visuals-api": "~5.4.0",
    "powerbi-visuals-utils-colorutils": "^6.0.1",
    "powerbi-visuals-utils-dataviewutils": "^6.0.1",
    "powerbi-visuals-utils-formattingutils": "^6.1.0",
    "powerbi-visuals-utils-svgutils": "^6.0.1",
    "powerbi-visuals-utils-tooltiputils": "^6.0.5",
    "powerbi-visuals-utils-typeutils": "^6.0.1"
  }
}
```
> 按需增删：`d3-array`/`d3-selection`（用 d3 时）、`lodash.*`（工具函数）、`powerbi-visuals-utils-testutils`+`karma`+`jasmine`+`playwright`+`eslint`（测试/校验，可省）。`powerbi-visuals-api` 在 devDependencies 与 dependencies 里都出现是官方模板常态，保留即可。

### 一键构建+部署脚本（本项目）
```bash
cd "C:\Users\hdc\Desktop\营收概况\visual\DateRangeSlicer" && \
"C:\Users\hdc\.workbuddy\binaries\node\versions\22.22.2\node.exe" \
"C:\Users\hdc\.workbuddy\binaries\node\versions\22.22.2\node_modules\npm\bin\npm-cli.js" run package && \
cp "dist\DateRangeSlicer20260822001.1.0.0.0.pbiviz" \
   "C:\Users\hdc\Desktop\营收概况\visual\DateRangeSlicer20260822001.1.0.0.0.pbiviz"
```
产物同时留在 dist 和项目根，方便交付。

## 二、input[type=date] 原生行为（最核心的坑）

### 坑1：不支持 placeholder 属性
浏览器日历的 `yyyy/mm/日` 是原生格式提示，对 input[type=date] 设 `placeholder` 无效。
**解法**：外层包 `.drs-input-wrap`(position:relative)，叠一个 `.drs-placeholder`/`.drs-value` 的 span，`position:absolute` + `pointer-events:none`（点击穿透到 input），用 JS 填自定义文本。

### 坑2：日历图标删不掉，删了就打不开日历
`::-webkit-calendar-picker-indicator` 在 shadow DOM 里。`display:none` 会让整个日历弹窗失效。
**解法（保留点击）**：`opacity:0` + 铺满输入框 `position:absolute; width:100%; height:100%`，既看不见图标又保留"点任意位置弹日历"。

### 坑3：日期文字字号不继承 input 的 font-size
日期文字渲染在 `::-webkit-datetime-edit` 伪元素，用浏览器 UA 默认字号，**不继承** input 上写的 font-size。表现："设了 11px 但看着比 HTML 的 span 小"。
**解法**：用叠加层 span 显示文本（见坑4），叠加层直接 `font-size: var(--drs-label-size)`，彻底绕开 UA 默认。

### 坑4：想强制显示格式 yyyy/m/d（去前导零）
input[type=date] 显示格式由浏览器/系统决定（可能 2026-03-01 / 2026/3/1 / 3/1/2026），不可控。
**解法**：叠加层机制——原生 `::-webkit-datetime-edit` 常驻 `color:transparent`，叠加自定义 span 显示 `toDisplayDate(d)` 输出的 `YYYY/M/D`；点击弹窗、min/max 限制全部保留。

```less
.drs-input::-webkit-datetime-edit,
.drs-input::-webkit-datetime-edit-fields-wrapper { color: transparent; }
.drs-value {
  position:absolute; left:0; right:0; width:100%;
  top:50%; transform:translateY(-50%);
  text-align:center;            /* 水平居中 */
  font-size: var(--drs-label-size);
  color: var(--drs-fg);
  pointer-events:none;          /* 点击穿透 */
}
```

### 坑5：日历弹窗跳到 max 而不是当前值
input.value 为空时，浏览器日历无定位日期，会跳到 `max` 属性所在月（如点最小值框却跳到 2026/03）。
**根因**："未激活"状态把 input.value 置空。
**解法**：引入 `startActive`/`endActive` 显式激活态。未激活时 **input.value 仍填数据边界值**（日历能正确定位），但 `applyFilter` 只看激活态决定是否参与筛选。

## 三、筛选下发（applyJsonFilter / AdvancedFilter）

- 下发：`this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge)`；移除用 `FilterAction.remove`。
- 构造：`new AdvancedFilter(this.target, "And", {operator, value}, ...)`。`target` 来自 `dataView.metadata.columns[].expr`（SQExpr：`expr.source.entity`=表，`expr.ref`=列），兜底按 `Table[Column]` 正则或 `queryName` 解析。
- **capabilities.json 必须声明 `general.filter`**，否则筛选不生效。
- **operators**：
  - `GreaterThanOrEqual` + 本地当天 `00:00` → "在 X 当天或之后"
  - `LessThanOrEqual` + 当天 `23:59:59.999` → "在 X 当天或之前"（但中文+8 时区下 23:59:59.999Z 会变次日，曾经踩坑）
  - `LessThan` + **次日零点** → "在 X+1 月 1日 之前"，语义更直观，**推荐**
- **时区**：用本地时区 `new Date(y, mo, d)` 取当天午夜，不要 `Date.UTC()`，否则 +8 时区下日期会平移一天。
- **切页/刷新恢复**：Power BI 会把已保存筛选器传回 `options.jsonFilters`，优先 `restoreFilter` 回显；条件是 `LessThan` 时 value 是次日零点，需减一天回显真实结束日。
- **dataView 截断**：`dataReductionAlgorithm` 必须放在 `categories` 级（不是 select 内），`top:{count:30000}`，否则 min/max 算错。

## 四、Formatting Model（格式面板）

- `getFormattingModel()` 返回 `FormattingCard` → `FormattingGroup` → 各种 Slice（`TextInput`/`ColorPicker`/`NumUpDown`/`ToggleSwitch`/`FontControl` 是 composite/`Dropdown`）。
- 数值范围用 `NumUpDown` 的 `min`/`max`（如圆角 0~10、字号 ≥8、边框 ≥1）。
- **持久化覆盖默认值的坑**：Power BI 会持久化格式值到 report 实例。改了 `DEFAULTS` 后，**旧实例仍用旧值**（如标头/值字号曾显示 11/10 而非新值 12/14）。
  **解法**：`readSettings` 里加迁移函数——若持久化值等于旧默认值，自动过渡为新默认值：
  ```ts
  const migrateFontSize = (v, oldDefault, newDefault) => {
    const val = clamp(v, 8, 100, newDefault);
    return (val === oldDefault) ? newDefault : val;
  };
  ```
  若用户**手动**设过（非旧默认），迁移不覆盖，需去面板手动改或删旧视觉重拖。

## 五、与深色主题/PBIRS 交付对齐

- 主题文件命名 `PBI-Style-{主题}.json`（如 `PBI-Style-深蓝暗色.json`），schema 2.143，41 个 token，纯 hex。
- 切片器视觉取色：`--drs-bg:#0A1428`（页面底）、`--drs-border:#2C4A6B`、`--drs-accent:#378ADD`、值文字 `#FFFFFF`、次级文字 `#B4B2A9`。
- 对齐 HTML 参考（如 `营收分析-顶部导航版.html` 的 `.date-input`）：背景/边框/圆角/内边距/字号逐项比对，不要凭感觉。
- 顶栏高度 1280 画布 1px≈1px：单框 ≈31px（1px×2边框+12px padding+11×1.5行高），整条 row ≈62px。

## 六、调试技巧

- 把 target/数据 min/max/筛选 conditions 写进 `labelEl.title`（hover 看 tooltip），是最快的现场排查手段。
- 初始/清除后行为用激活态显式管理，别靠"input 是否为空"隐式推断——空值会带来坑5 的日历定位问题。
