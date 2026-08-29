---
name: pbi-custom-visual-dev
displayName: Power BI 自定义视觉(pbiviz)开发实战
description: 开发 Power BI 自定义视觉（DateRangeSlicer 等日期/范围切片器）的踩坑经验与可复用工作流，覆盖 input[type=date] 原生行为、筛选下发、格式化模型、时区、主题对齐等硬骨头。当用户要做 PBI 自定义视觉、日期切片器、applyJsonFilter/AdvancedFilter 筛选、Formatting Model 面板，或遇到日历图标/日期格式/占位符/字号不生效等问题时使用。
agent_created: true
---

# Power BI 自定义视觉(pbiviz)开发实战

> **官方知识库**：`visual/powerbi-visual-kb/`（PDF 全文 + API 速查）
> - 开发时先读 `visual/powerbi-visual-kb/00-INDEX.md` 定位官方文档与 API 签名
> - **接口签名以本地 `node_modules/powerbi-visuals-api` 的 typings 为准**（PDF 含已废弃成员）
> - **Python 脚本一律用 `.venv/Scripts/python.exe`**，禁止系统解释器

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
- 但 `BasicFilter` 构造的 operator 参数类型又是这个枚举类型，直接传字符串字面量 `"Is"` 会报 `not assignable to parameter of type 'BasicFilterOperators'`（v2.6.0 实测踩到）。
- **正确写法（类型断言）**：`const OP_IS = "Is" as BasicFilterOperators;` / `const OP_IN = "In" as BasicFilterOperators;`。运行时仍是字符串 `"Is"`/`"In"`，类型也满足。
- 对比 `AdvancedFilter` 的 `"And"` 参数类型宽松，字符串字面量直接传即可（不用断言）。

### ⚠️ 同字段多模式时：update() 必须按模式完全分流（v2.6.0 高危坑）
- **场景**：一个视觉同时支持「介于筛选（AdvancedFilter，有 `conditions`）」与「值列表筛选（BasicFilter，无 `conditions`，只有 `operator`/`values`）」。
- **坑**：`update()` 里常见的兼容写法是「收到非介于型筛选 → `remove` 并回到默认态」。在单模式时是对的，但**列表模式自己下发的就是 BasicFilter**，会命中这条分支 → **用户每选一次筛选就被自己紧接着的 update 立刻清掉，表现为「选了没反应」**，且无任何报错。
- **解法**：在 `update()` 入口按模式 `return` 独立分支，绝不让 BasicFilter 流入介于模式的清除逻辑。
- **判断筛选类型**：`filter.conditions` 存在 → AdvancedFilter；否则 `filter.operator === "Is"/"In"` → BasicFilter。

### ⚠️ 新增交互元素必须同步加白名单（v2.6.0 踩到）
本视觉的机制是「视觉内除白名单外一切区域点击即收起面板」（v2.4.3 确立）。
**每新增一个可交互元素（搜索框、列表容器等），必须同步加入 `isInteractiveTarget()` 白名单**，
否则用户一点它就被判定为「点空白」而收起面板 —— 搜索框尤其致命：一点面板就关，功能形同虚设。
当前白名单：触发器 + 预设按钮 + 搜索框 + 列表容器。

### 列表项：display 与 raw 必须分离
- 界面显示用格式化文本（如 `YYYY/M/D`），但**筛选下发必须是 Power BI 的原始值**（保留 `raw`）。
- 若误把格式化后的显示字符串当筛选值 → **匹配不到任何数据**，且无报错。
- 切页恢复时同样要把筛选值统一转成 display 后再比对，兼容 `Date` 对象 / ISO 字符串 / 时间戳等多种形态。

### capabilities 的 dataRoles.name 不可改
`dataRoles[].name` 是**字段绑定的内部标识**。要支持更多字段类型时只能改 `displayName`，
**改 `name` 会导致已有报表的字段绑定失效**（v2.6.0 支持文本字段时据此保留了 `name: "Date"`）。

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

## 八点五、浮层下拉定位（v2.4.1：恢复「下拉观感」）

- **需求**：面板要"下拉感"＝浮在触发器下方**盖住下方内容**，不能推挤布局（流内展开只是占位，没有下拉观感）。
- **DOM 结构**：`root → header + body(.drs-body) → trigger + panel`，panel 绝对定位相对 `.drs-body`。
  **必须包 `.drs-body` 这层**——否则「标头位置=左侧」（root `flex-direction:row`）时，panel 作为 root 的第三个 flex 子元素会**横排到触发器右侧**。
- **定位计算 `positionPanel()`**：`getBoundingClientRect()` 取 root 与 trigger 的上下可用空间 → 默认向下展开；`下方可用 < 面板自然高度 && 上方更宽裕` 时加 `.drs-panel-up` 向上翻转；`max-height = 可用空间`（兜底 60px）+ `overflow-y:auto`，防止浮出视觉框被 iframe `overflow:hidden` 裁切。上下都 < 100px 时退化为 `.drs-panel-inline` 流内展开 + root `overflow-y:auto`，牺牲浮层观感换内容可见。
- **⚠️ 坑：内联 `style.display` 会盖过 CSS**：用 `el.style.display="block"` 控制显隐，会让 CSS 里的 `display:flex`（`gap` 才生效）和展开 `animation` 全部失效。**解法**：改用 class `.drs-panel-open { display:flex; animation:... }`，JS 只 add/remove class；构造函数里也**不要**留 `style.display="none"` 初始值（内联优先级高于 class）。
- **量自然高度的顺序**：先 `classList.add(open)` → 清 `maxHeight` → 读 `scrollHeight` → 再设 `maxHeight`。顺序反了量到的是被上一轮限高的值。
- **下拉观感三件套**：`box-shadow: 0 8px 24px rgba(0,0,0,.45)`（浮起感）+ 140ms `translateY` 位移动画（display none→flex 时 CSS animation 会自动重播）+ 箭头 CSS `rotate(180deg)` 过渡（比切换 `textContent` ▾/▴ 顺滑）。
- **⚠️ 坑：`persistProperties` 写错 objectName 会被静默丢弃**：`currentPreset` 属于 `state` 对象，若混写进 `customRange` 的 properties（capabilities 未声明该属性）**不报错但不生效**。一个对象一条 merge，不要混写。
- **⚠️ 坑：`update → persist → update` 自激**：`update()` 的筛选恢复分支里命中就 `persistProperties`，会触发新一轮 update 形成循环。**解法**：加 `lastPersistedPreset` 守卫，值未变化则跳过写入；`readSettings` 读到已持久化值时同步该守卫。
- **构建命令的中文路径坑**：PowerShell 里 `cd "C:\...\营收概况\..."` 中文会被按 GBK 解析成乱码、报路径不存在。**解法**：shell 默认已在项目根，改用相对路径 `cd visual\DateRangeSlicer`。
- **验证产物更稳的做法**：解包后对 `resources/*.pbiviz.json`（CSS+JS 都内嵌在这里）做关键词 `Contains` 匹配即可；`ConvertFrom-Json` 在中文内容上容易因编码失败，直接字符串匹配更可靠。

## 八点六、浮层对齐方式与「预设＝日期输入框取值」语义（v2.4.2）

### 浮层右对齐触发器
- **需求**：触发器在报表里被调窄后，面板跟着变窄 → 内部日期输入框被挤压、内容溢出截断。
- **解法**：面板 `right:0; left:auto` + `width:max-content; min-width:100%; max-width:420px`。右边缘**贴齐触发器**，需要更宽时向**左**扩展，触发器再短面板也保持完整宽度。
- **配套**：`max-content` 靠内容撑宽，所以要给内容定最小宽度 —— 预设网格 `repeat(2, minmax(92px,1fr))`、日期行 `min-width:212px`、日期输入 `min-width:96px`（原本 `min-width:0` 会被 flex 压扁）。
- **⚠️ 坑**：极矮兜底模式（`.drs-panel-inline` 流内展开）必须复位 `width:auto; min-width:0; max-width:none`，否则流内时 `min-width:100%` + `max-content` 会撑坏布局。

### 预设 / 日期输入框 / 触发器 三者联动（核心语义）
- **语义**：**预设的本质就是给两个日期输入框赋一组值**。据此推导出的三条联动规则（用户明确确认过）：
  1. 选预设 → 把该预设的 `[start,end]` **回填进两个输入框**（不能置空）
  2. 手改输入框 → 若结果**恰好等于**某预设，自动回到**预设态**（预设高亮 + 触发器显示预设名 + 清空自定义态）；否则才是自定义态
  3. 触发器文本：预设态显示预设名，自定义态显示格式化的日期区间
- **⚠️ 坑：输入框置空会露出原生 `yyyy/m/日` 占位符**。解法是输入框**始终有值** —— `ensureInputsFilled()` 兜底，优先级：已有值不动 → 自定义区间 → 当前预设区间 → 数据边界（全量态）。在切页恢复分支和 `update()` 末尾各调一次。
- **⚠️ 坑：模糊匹配会误判预设**。原 `matchPreset()` 按「起止误差合计 ≤3 天即命中」判定，导致「用户选 8/1–8/25 却高亮『近30天』」。**已删除**，改为 `exactMatchPreset(start,end)` 做**天级精确比对**（两端时间戳完全相等）。切页恢复改由 `reverseCustomRange()` 反推真实起止 + `exactMatchPreset()` 判定，命中→预设态，未命中→`currentPreset=""`（自定义态，不高亮任何预设）。
- **校验产物时注意大小写**：PowerShell `-match` 默认不区分大小写，检查 `matchPreset` 是否删干净会误命中 `exactMatchPreset` 里的 `MatchPreset`。用 `-cmatch` 或匹配特征串（如 `matchPreset\(filter`）。

## 八点七、浮层下拉面板的回收机制（v2.4.3）

### 根因：iframe 隔离导致 document click 收不到
- **症状**：面板展开后，点报表画布其他视觉对象/空白处收不起来，只有点选项才收起。
- **根因**：自定义视觉跑在 PBI 的 **sandboxed iframe** 内，点击 iframe 之外的地方，**事件不跨 iframe**，iframe 内的 `document` 完全收不到 click。所以「点外部关闭」靠 `document` 监听是无解的。
- **唯一可行通道**：监听 **iframe 级别的 `window blur`**。点到画布别处 → 本 iframe 失焦 → `window` 收到 blur。
- 这与 v1.1–v1.4 自绘弹层的坑同源（挂 `document.body` 的弹层飞不出 iframe、document click 关不掉），但 v1.x 时的结论是「无解」，实际上 window blur 这条路当时没试，属于漏掉的解法。

### 三条关闭通道 + 一个白名单
1. `document` click（**capture** 阶段）：视觉外直接收起；视觉内则查白名单，非白名单即收起。
2. `window` blur：覆盖 iframe 之外的所有点击。
3. Esc：保留。
- **白名单＝触发器 + 预设按钮 + 两个日期输入框**（含内部节点如日历图标）。用**白名单**而不是「是否在面板内」的黑名单，才能满足「除交互元素外一律收起」的最严格判定——面板 padding 空白、分隔箭头、标头文字都不豁免。

### ⚠️ 关键坑：capture 阶段白名单必须包含触发器，否则关不掉
`docClickHandler` 注册在 **capture** 阶段，早于 `triggerEl` 自身 **bubble** 阶段的 handler。
若触发器不在白名单，点已展开的触发器会：capture 判定为空白 → `closePanel()` → 随后 trigger handler `togglePanel()` 又打开，形成**「点触发器关不掉」的开关死循环**。
> 诊断口诀：下拉「点了没反应/关不掉」，先查 capture/bubble 顺序与白名单，别急着改业务逻辑。

### 保护系统日历：失焦判定的两级豁免
用户明确要求「日历逻辑不改」——弹出系统日历选日期时面板不能被收起。做法：
```ts
private evaluateBlurClose(): void {
    this.blurTimer = null;
    if (!this.isPanelOpen) { return; }
    if (document.hasFocus && document.hasFocus()) { return; }   // ① iframe 仍持有焦点
    const active = document.activeElement;
    if (active === this.startInput || active === this.endInput) { return; } // ② 焦点在日期输入框
    this.closePanel();
}
```
- **⚠️ 坑：blur 瞬间 `document.activeElement` 尚未稳定**，必须 `setTimeout(..., 0)` 延后一个宏任务再判定，否则 ② 判定不准。
- ① 用 `hasFocus()` 区分「整个 iframe 失焦（真离开）」与「iframe 内焦点移动 / 原生 picker 打开」。

### 监听生命周期
- `window blur` 在 `openPanel()` 注册、`closePanel()` 解绑，关闭时零常驻开销。
- `destroy()` 必须**兜底**解绑并 `clearTimeout(blurTimer)` —— 面板展开态下视觉被销毁时，否则残留监听 + 待执行的延时器回调会打到已销毁的对象上。

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
