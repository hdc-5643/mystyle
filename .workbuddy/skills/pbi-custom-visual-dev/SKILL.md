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
cd "E:\Users\Administrator\Desktop\营收概况\mystyle\visual\DateRangeSlicer" && \
./node_modules/.bin/pbiviz package
```
产物在 `dist/DateRangeSlicer20260822001.<version>.pbiviz`（version 见 `pbiviz.json`）。首次构建若报证书缺失，工具会自动生成测试证书。

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

## 七、新增「下拉」样式（单选/多选/全选，v1.1.0.0）

用户要的是**原生字段值下拉**（日期拉入默认下拉、列出所有唯一日期值、单选/多选/全选），不是预设范围（今日/本周/本月）。

### capabilities.json
- 新增 `style` 对象：`mode` 枚举（between/dropdown，displayName 介于/下拉）。
- `selection` 对象 bool：`singleSelect`(单选)、`ctrlMultiSelect`(使用 Ctrl 多选)、`showSelectAll`(显示"全选"项)、`searchEnabled`(显示搜索框)、`searchPlaceholder`(搜索框提示文字)。**默认值在 `DEFAULTS` 控制（不是 capabilities，见章节末尾）**。
- `general.filter` 已存在（介于用到），下拉复用同一筛选通道，无需新增。

### 代码结构（update 里按 style 分支）
- `this.style = settings.style`；`applyStyles()` 里切换 `inputsEl`/`dropdownEl` 的 `display`，并在切离下拉时 `closeDropdown()`。
- 下拉 DOM：触发器 `.drs-dropdown-trigger`（收起显示当前值/占位"所有"）+ 弹出层挂 `document.body`（见下）。
- `resolveRange` 顺带构建 `dateValues`（唯一日期值**降序**，dedup 用 `toDateInput` 的 yyyy-mm-dd 作 key）。
- 选中态 `selectedKeys: Set<string>`（key = yyyy-mm-dd）。
- 有效多选（isEffectiveMulti）：`!singleSelect`（只要不是真单选即为多选模式，筛选下发 In）。`ctrlMultiSelect` 只影响**交互方式**（见下），不改变"能否多选"。

### 筛选：用 BasicFilter（不是 AdvancedFilter）
- 全选（或"不显示全选项且未选任何"）→ `applyJsonFilter(null,...,remove)`。
- 单选 → `new BasicFilter(target, "Is", value)`。
- 多选 → `new BasicFilter(target, "In", [v1,v2,...])`。
- 显示全选项但取消全选且未勾任何 → `BasicFilter("In", [])`（空数组=无命中，等价原生"筛选出空"）。

### ⚠️ 关键 TS 坑：BasicFilterOperators 是 const enum
- `powerbi-models` 的 `BasicFilterOperators` 是 **const enum**（编译期内联，运行时无对象），`BasicFilterOperators.Is` 当值用会报 `only refers to a type, but is being used as a value`。
- 但 `BasicFilter` 构造的 operator 参数类型又是这个枚举类型，直接传字符串字面量 `"Is"` 会报 `not assignable to parameter of type 'BasicFilterOperators'`。
- **正确写法（类型断言）**：`new BasicFilter(target, "Is" as BasicFilterOperators, value)`、`"In" as BasicFilterOperators`。运行时仍是字符串 `"Is"`/`"In"`，类型也满足。
- 对比 `AdvancedFilter` 的 `"And"` 参数类型宽松，字符串字面量直接传即可（不用断言）。

### 弹出层挂 document.body（避免被视觉容器 overflow:hidden 裁剪）
- `popup.style.position = "fixed"` + `getBoundingClientRect()` 取触发器视口坐标定位（fixed 相对视口，坐标一致）。
- `document.body.appendChild(popup)`；关闭时 `popup.remove()`。
- 关闭时机：点触发器 toggle、点 popup 外（document click，延迟 0ms 注册避免吞掉本次打开点击）、`Esc`(keydown)。
- 样式在 `.dateRangeSlicer` 作用域**外**顶层定义（`.drs-popup`），自带暗色 CSS 变量，因为 popup 已脱离 root 拿不到 root 的 `--drs-*`。

### 弹出层必须真正置顶（z-index 踩坑，重要）
- **症状**：下拉弹层点不动 / 勾了"没生效" / 选区不收起 —— 根因往往是弹层 `z-index` 不够高，被 PBI 画布/报表容器的 stacking context 压在下面，**点击穿透到了后面的报表**，checkbox 根本没收到点击（点外部能关是因为那次点击确实落在了报表上、触发了 document 关闭逻辑）。
- **修法（一次到位）**：
  - `.drs-popup { z-index: 2147483647; transform: translateZ(0); }` —— `translateZ(0)` 强制建独立 stacking context，防止被父级 stacking 困住。
  - 加全局兜底 `body > .drs-popup { z-index: 2147483647 !important; transform: translateZ(0) !important; }`（弹层直接挂 body 下）。
  - 仅 `z-index: 99999` 不够，PBI 某些容器层级更高。
- **诊断口诀**：自定义视觉里任何浮层"点了没反应/像没生效"，先怀疑 z-index/stacking，而不是业务逻辑。

### 下拉样式：浏览器原生 `<select>` 方案（v1.5.0.0 起）

调研已发布 PBI 自定义视觉（powerbi-datepicker-slicer 用原生 `<select>`、微软官方 ChicletSlicer 不造弹层、CalendarPro 用 MUI Popover 但作者 commit 承认 iframe sandbox 隔离）后，自绘 DOM 弹层无法真正漂浮到 PBI 画布外。v1.5 起改用浏览器原生 `<select>`——唯一能 OS 级渲染、漂浮画布、不受 sandbox/overflow 裁剪的方案。

- **单选模式**（开「单选」）：`<select>` 单选 → 浏览器原生下拉面板（OS 渲染漂浮画布上，关闭/收起由浏览器自动处理，不用自绘弹层逻辑）。
- **多选模式**（默认）：`<select multiple size=8>` → 列表框（容器内显示，Ctrl/Shift 多选）。
- **全选作第一项 option**：`<option value="__all__">全选</option>`，勾它=清空筛选=全选态。仅多选模式显示（单选不需要）。
- **无搜索框**：原生 select 不支持搜索，`searchEnabled`/`searchPlaceholder` 已从 capabilities 删除。
- **配置互斥**：开「单选」后 `getFormattingModel` 用 `...(selection.singleSelect ? [] : [Ctrl多选, 全选])` 隐藏另两个 slice（对齐原生切片器树形）。
- **关键方法**：
  - `renderNativeOptions()`：渲染 options（全选项+日期值，全选项仅多选显示）。
  - `syncNativeSelect()`：程序化同步 selectedKeys→option.selected（update 后调用，不触发 change）。
  - `onNativeChange()`：select change 事件 → 读 selectedOptions → 更新 selectedKeys → applyDropdownFilter。多选+全选项被选中时直接清空筛选。
  - `updateDropdown`：按 `singleSelect` 设 `select.multiple`+`size`（单选=1、多选=8）；数据变化时 renderNativeOptions；末尾 syncNativeSelect。
- **默认值**（由 `DEFAULTS` 控制，capabilities 的 bool 不声明默认、PBI 一律视为 false）：单选=关、Ctrl 多选=开、显示"全选"项=关。
- **筛选下发**：仍用 `BasicFilter`（Is/In），`isEffectiveMulti()=!singleSelect` 决定 Is 还是 In。
- **模式切换收敛**：`coerceSingleSelection`（多选≥2 切单选取首项）保留；单选切多选 selectedKeys 不清空。
- **样式**：`.drs-native-select`（暗色背景/边框/圆角/字体，`&[multiple]` 列表框样式，`option` 暗色）。下拉面板本身多数由 OS 渲染无法定制（深色主题改不了下拉面板，仅 select 本体可改）。

### ⚠️ 自绘 DOM 弹层方案的坑（v1.1–v1.4 用过，v1.5 已废弃）
- v1.1–v1.4 曾用自绘弹层（trigger + popup 挂 document.body + fixed + z-index 2147483647 + ClickAway + Esc 关闭），实测在 PBI sandboxed iframe 内**无法真正漂浮到画布外**：`document.body` 是 iframe 内的 body，弹层只飘在 iframe 内、出不了 visual 容器边界；点 PBI 画布其他 visual/空白不会触发本 iframe 的 document click（事件不跨 iframe）。
- v1.3 把"点击穿透/没生效"误判为 z-index 不够（实际是 iframe sandbox 隔离），z-index 修复只解了"弹层被其他视觉压住看不见"，没解"点画布别处关闭"。
- v1.5 改原生 select 后这些坑全部规避（OS 渲染不受 sandbox 限制）。后续若要恢复自绘弹层，需引入 `@floating-ui/dom` 做边界避让 + 接受"弹层在 visual 容器内、不能飘出 iframe"的视觉。

### 回显与跨样式切换
- `options.jsonFilters[0]` 若含 `conditions` → 介于筛选（AdvancedFilter）；否则 `operator==="Is"/"In"` → 下拉筛选（BasicFilter）。
- 切到下拉却收到遗留的介于筛选（有 conditions）→ 清空 remove 并进入默认全选。
- 切回介于却收到遗留的下拉筛选（无 conditions）→ 清空 remove，走介于默认。
- 数据刷新后剔除已不在 `dateValues` 的选中 key，防止下发失效筛选。

## 八、PBI Desktop 自定义视觉对象缓存机制（更新 .pbiviz 不生效的根因）

### 现象
- `pbiviz package` 重新构建完成、产物确实包含新代码（解包 .pbiviz 验证 capabilities.json 与 .pbiviz.json 内嵌内容都对了）
- PBI Desktop 里"先删旧实例 → 重新导入"也做了
- 但格式面板仍看不到新加的卡片/选项，渲染行为仍是旧版本

### 根因
PBI Desktop 用 **GUID 作为视觉对象插件的唯一标识**。同名（同 GUID）的 .pbiviz 重新导入时，PBI 把它当作"插件更新"，**沿用已经加载到内存里的旧实例**（JS/CSS 都来自上次缓存），新版代码实际上没被加载。

光升 `version` 字段不管用——GUID 一致，PBI 就认旧资源。

### 唯一稳妥的解法：换 GUID
每次做不兼容更新（capabilities.json 改了、新增卡片/枚举、改 displayName），改 `pbiviz.json` 里的 GUID：
```json
"visual": {
  "guid": "<新唯一值，旧 GUID 末位/中间改一个字母或数字>",
  ...
}
```
让 PBI Desktop 把它当全新视觉对象导入，就能强制加载新 .pbiviz 里的所有资源。

代价：同名但不同 GUID 的视觉对象会在 PBI 视觉对象面板里并存（两份 "日期区间切片器"）。需要的话在 `pbiviz.json` 的 `displayName` 上加版本后缀给视觉对象辨认：`"displayName": "日期区间切片器 v1.2"`。

### 验证产物是否真的包含新代码
光看文件大小/时间戳不可靠。**权威办法**：解包 .pbiviz 看内嵌 manifest：
```powershell
# .pbiviz 本质是 .tgz，powerbi-visuals-tools 把它打成 zip 兼容扩展名
$src = "...\dist\YourGUID.1.2.0.0.pbiviz"
$zip = "$env:TEMP\check.zip"
Copy-Item $src $zip -Force
$d = "$env:TEMP\pbiviz_check"
if (Test-Path $d) { Remove-Item $d -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $d -Force
# resources/<YourGUID>.pbiviz.json 是内嵌 manifest，含 visualEntryPoint(JS)+capabilities+style(CSS)
Select-String -Path (Join-Path $d 'resources\<YourGUID>.pbiviz.json') `
  -Pattern '"version"|"displayName":\s*"(你的新项)|"value":\s*"(你的新枚举值)"'
```
匹配到就说明打包正确；如果用户反馈看不到，先看是不是 GUID 没换。
