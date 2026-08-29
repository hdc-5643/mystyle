# IVisualHost 接口速查

> **权威来源**：`visual/DateRangeSlicer/node_modules/powerbi-visuals-api/src/visuals-api.d.ts`
> （本项目安装 `powerbi-visuals-api ~5.4.0`）
>
> ⚠️ **接口签名一律以本地 typings 为准**。官方 PDF（2025-12）含已废弃成员
> （如 `acquireAADTokenService`），且章节分散在不同页，不可作为签名依据。

## 完整成员清单（26 个，来自本地 typings）

```typescript
export interface IVisualHost extends extensibility.IVisualHost {
    createSelectionIdBuilder: () => visuals.ISelectionIdBuilder;
    createSelectionManager: () => ISelectionManager;
    colorPalette: ISandboxExtendedColorPalette;
    persistProperties: (changes: VisualObjectInstancesToPersist) => void;
    applyJsonFilter: (filter: IFilter[] | IFilter, objectName: string,
                      propertyName: string, action: FilterAction) => void;
    tooltipService: ITooltipService;
    telemetry: ITelemetryService;
    authenticationService: IAuthenticationService;
    locale: string;
    hostCapabilities: HostCapabilities;
    launchUrl: (url: string) => void;
    fetchMoreData: (aggregateSegments?: boolean) => boolean;
    openModalDialog: (dialogId: string, options?: DialogOpenOptions,
                      initialState?: object) => IPromise<ModalDialogResult>;
    instanceId: string;
    refreshHostData: () => void;
    createLocalizationManager: () => ILocalizationManager;
    storageService: ILocalVisualStorageService;
    downloadService: IDownloadService;
    eventService: IVisualEventService;
    switchFocusModeState: (on: boolean) => void;
    hostEnv: powerbi.common.CustomVisualHostEnv;
    displayWarningIcon: (hoverText: string, detailedText: string) => void;
    licenseManager: IVisualLicenseManager;
    webAccessService: IWebAccessService;
    drill: (args: DrillArgs) => void;
    applyCustomSort: (args: CustomVisualApplyCustomSortArgs) => void;
}
```

## HostCapabilities

```typescript
interface HostCapabilities {
    allowInteractions?: boolean;
    allowModalDialog?: boolean;
}
```

本项目实测：`allowInteractions=true`、`allowModalDialog=true`。

## VisualUpdateOptions

```typescript
interface VisualUpdateOptions extends extensibility.VisualUpdateOptions {
    viewport: IViewport;          // 只读输入：宿主告诉视觉「你有多大」
    dataViews: DataView[];
    type: VisualUpdateType;       // 位标志：Data | Resize | ViewMode | Style | ResizeEnd
    viewMode?: ViewMode;          // View | Edit | InFocusEdit
    editMode?: EditMode;          // Default | Advanced
    operationKind?: VisualDataChangeOperationKind;
    jsonFilters?: IFilter[];      // 已应用的筛选（切页恢复用）
    isInFocus?: boolean;          // 是否处于焦点模式
    pendingChanges?: PendingChanges;
}
```

## 重点方法说明

### applyJsonFilter —— 筛选下发

```typescript
// 下发/合并
this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);
// 清除
this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
```

- capabilities 必须声明 `general.filter`，否则不生效
- 筛选类型判断：`filter.conditions` 存在 → AdvancedFilter；否则 `operator === "Is"/"In"` → BasicFilter

### switchFocusModeState —— 焦点模式（可程序化唤起）

```typescript
this.host.switchFocusModeState(true);   // 进入焦点模式（视觉放大占满画布）
this.host.switchFocusModeState(false);  // 退出
```

- 自 API v2.6.0 起提供
- 配套 `options.isInFocus` 可读取当前状态
- **待实测**：视觉能否主动唤起（通常焦点模式由用户点图标进入）

### openModalDialog —— 宿主对话框

```typescript
this.host.openModalDialog(dialogId, dialogOptions, initialState)
    .then(result => ..., err => ...);
```

完整用法见 `.codebuddy/archive/openModalDialog-官方用法归档.md`。

### persistProperties —— 持久化

```typescript
this.host.persistProperties({
    merge: [{ objectName: "state", selector: null, properties: { currentPreset: "thisMonth" } }]
});
```

⚠️ 写错 `objectName`（capabilities 未声明的属性）会被**静默丢弃**，不报错。

## 与官方 PDF 的差异

| 成员 | PDF（2025-12） | 本地 typings 5.4.0 |
|---|---|---|
| `acquireAADTokenService` | 有（历史条目） | **无**，已由 `authenticationService` 取代 |
| `storageV2Service` | 有 | 无（用 `storageService`） |
| `hostCapabilities` / `hostEnv` / `telemetry` / `drill` / `refreshHostData` | 散见各章节 | 均在接口中 |

**结论**：PDF 用于理解用法与背景，签名以本地 typings 为准。
