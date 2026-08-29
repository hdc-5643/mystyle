# Power BI 视觉对象开发知识库 — 主索引

> **定位**：底层官方知识（PDF + API），与上层实战经验（`.workbuddy/skills/`）互补。
> **优先级**：开发时先读本文件定位主题，再读对应文档获取细节。

## ⚠️ 三条铁律

1. **接口签名以本地 `node_modules/powerbi-visuals-api` 的 typings 为准**，PDF 含已废弃成员（如 `acquireAADTokenService`）
2. **Python 脚本一律用 `.venv/Scripts/python.exe`**，禁止用系统 python / miniconda
3. **技能一律建在 `.workbuddy/skills/`**，不放 `.codebuddy/skills/`

## 知识库结构

```
visual/powerbi-visual-kb/
├── 00-INDEX.md              ← 本文件（AI 主入口）
├── README.md                ← 知识库说明
├── official/
│   ├── pdf-full.md          ← PDF 全文存档（697 页，0.65MB，按页分节，可 grep）
│   └── pdf-page-index.md    ← 主题→页码映射（定位用，不是全文）
├── api/
│   ├── visual-host.md       ← IVisualHost 全成员（以本地 typings 为准）
│   └── changelog.md         ← API 版本变更日志
└── scripts/
    └── extract_pdf.py       ← PDF 提取脚本（含 .venv 解释器守卫）
```

## 主题速查

### 筛选下发
- **官方文档**：PDF p146, p314–317, p481–482, p517–530
- **本地 typings**：`api/visual-host.md` → `applyJsonFilter`
- **实战经验**：`.workbuddy/skills/pbi-custom-visual-dev/SKILL.md` 第三章
- **关键点**：
  - `AdvancedFilter`（GreaterThanOrEqual + LessThan）用于介于筛选
  - `BasicFilter`（Is/In）用于值列表筛选
  - ⚠️ `BasicFilterOperators` 是 const enum，必须用类型断言 `"Is" as BasicFilterOperators`
  - ⚠️ 多模式时 `update()` 必须按模式分流，否则 BasicFilter 会被自身的 update 清掉

### 格式面板 Formatting Model
- **官方文档**：PDF p34, p50–66, p188–189, p240–245
- **本地 typings**：API 5.1.0 引入
- **实战经验**：`.workbuddy/skills/pbi-custom-visual-dev/SKILL.md` 第四章
- **关键点**：
  - `getFormattingModel()` 返回 `FormattingCard` → `FormattingGroup` → `Slice`
  - 持久化覆盖默认值的坑：改了 `DEFAULTS` 后旧实例仍用旧值

### 对话框 openModalDialog
- **官方文档**：PDF p207–212
- **本地 typings**：`api/visual-host.md` → `openModalDialog`
- **完整用法归档**：`.codebuddy/archive/openModalDialog-官方用法归档.md`
- **关键点**：
  - 签名：`openModalDialog(dialogId, options, initialState) → Promise`
  - 必须注册 `globalThis.dialogRegistry[Class.id] = Class`
  - `DialogAction = {Close:0, OK:1, Cancel:2, Continue:3, No:4, Yes:5}`
  - 官方限制：背景灰显、标题/图标不可改、最小 240×210、自动关闭 5 秒内被阻止

### resize / viewport
- **官方文档**：PDF p413–416
- **本地 typings**：`api/visual-host.md` → `VisualUpdateOptions`
- **关键点**：
  - `viewport` 是**只读输入**，视觉无法直接改变自身尺寸
  - `VisualUpdateType` 是位标志：Data | Resize | ViewMode | Style | ResizeEnd
  - resize 期间只做最小 viewport 工作，ResizeEnd 时才做最终布局计算

### 焦点模式 switchFocusModeState
- **官方文档**：PDF p411–412, p468, p482
- **本地 typings**：`api/visual-host.md` → `switchFocusModeState`
- **API 引入版本**：2.6.0
- **关键点**：
  - `switchFocusModeState(true)` 可让视觉放大占满画布
  - 配套 `options.isInFocus` 读取当前状态
  - **待实测**：视觉能否主动唤起（通常由用户点图标进入）
  - 可能解决"视觉很矮（如 47px）但展开要完整显示"的诉求

### iframe 限制（已验证的硬约束）
- 浮层无法突破 iframe 边界：Portal / Top Layer / z-index 全部无效
- `openModalDialog` 可浮出，但外观是"对话框"不是"下拉"
- 原生 `<select>` 的弹出层由 OS 渲染，**可突破 iframe**（本项目 v2.3.1 验证过）
- 点画布别处事件不跨 iframe → 面板回收靠 `window blur`

### capabilities 配置
- **官方文档**：PDF p22–26, p29–34, p37–41
- **实战经验**：`.workbuddy/skills/pbi-custom-visual-dev/SKILL.md` 第七章
- **关键点**：
  - `dataRoles[].name` 是字段绑定内部标识，**不可改**（改了已有报表绑定失效）
  - 改 capabilities 后必须换 GUID，否则 PBI Desktop 沿用内存旧实例

### PBI Desktop 缓存机制
- **实战经验**：`.workbuddy/skills/pbi-custom-visual-dev/SKILL.md` 第八章
- **关键点**：GUID 不变时 PBI 沿用内存旧实例，capabilities 改动需换 GUID

## 与实战经验的关系

| 层次 | 位置 | 内容 |
|---|---|---|
| **底层（本知识库）** | `visual/powerbi-visual-kb/` | 官方文档 + API 签名 |
| **上层（实战）** | `.workbuddy/skills/pbi-custom-visual-dev/SKILL.md` | 项目踩坑、工作流、代码模板 |
| **归档** | `.codebuddy/archive/` | 已验证的完整方案记录 |

两者互补，不重复。开发时先读本索引定位主题，再读对应文档。
