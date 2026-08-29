import powerbi from "powerbi-visuals-api";
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import FilterAction = powerbi.FilterAction;
import FormattingModel = powerbi.visuals.FormattingModel;
import FormattingCard = powerbi.visuals.FormattingCard;
import FormattingGroup = powerbi.visuals.FormattingGroup;
import FormattingDescriptor = powerbi.visuals.FormattingDescriptor;

import { AdvancedFilter, BasicFilter, BasicFilterOperators } from "powerbi-models";

/**
 * ⚠️ powerbi-models 的 BasicFilterOperators 是 const enum（编译期内联，运行时无对象）：
 * - 直接 `BasicFilterOperators.Is` 当值用 → 报 "only refers to a type, but is being used as a value"
 * - 直接传字符串字面量 "Is" → 报 "not assignable to parameter of type 'BasicFilterOperators'"
 * 唯一可行写法是类型断言：运行时仍是字符串，类型也满足。
 */
const OP_IS = "Is" as BasicFilterOperators;
const OP_IN = "In" as BasicFilterOperators;

import "./../style/dateRangeSlicer.less";

"use strict";

// 预设定义（顺序即下拉展示顺序：本月→上月→近7→近15→近30）
const PRESETS: { key: string; name: string }[] = [
    { key: "thisMonth", name: "本月" },
    { key: "lastMonth", name: "上月" },
    { key: "last7", name: "近7天" },
    { key: "last15", name: "近15天" },
    { key: "last30", name: "近30天" }
];

/** 模式枚举：preset=预设区间（AdvancedFilter 介于），list=值列表多选（BasicFilter Is/In） */
const MODE = { PRESET: "preset", LIST: "list" } as const;
/** 「（全选）」项的哨兵 key，不参与筛选值下发 */
const ALL_KEY = "__all__";

const DEFAULTS = {
    // 切片器模式：preset / list
    mode: "preset",
    // 列表模式行为
    listBehavior: {
        showSearch: true,
        showSelectAll: true
    },
    header: {
        show: true,
        title: "结算日期",
        position: "left",
        fontColor: "#B4B2A9",
        background: "transparent",
        fontSize: 14,
        fontFamily: "Segoe UI",
        bold: false,
        italic: false,
        underline: false
    },
    // 下拉样式（select 框 + 下拉面板）
    selection: {
        backgroundColor: "#142436",
        borderColor: "#2C4A6B",
        borderWidth: 1,
        borderRadius: 3,
        accentColor: "#378ADD",
        listBackground: "#0A1428",
        listText: "#FFFFFF",
        listHoverText: "#B4B2A9",
        listHoverBackground: "transparent",
        // 触发器文字色：独立控制，不再复用强调色
        triggerTextColor: "#FFFFFF",
        // 选中态颜色：独立控制，不再硬编码
        listActiveText: "#378ADD",
        listActiveBackground: "rgba(55, 138, 221, 0.18)",
        // 滚动条暗色配色（贴近原生切片器观感）
        scrollbarTrackColor: "#0A1428",
        scrollbarThumbColor: "#2C4A6B",
        // 列表项行间距：默认 4px，范围 0-12（贴近原生切片器观感）
        listGap: 4
    },
    // 「默认本月」：首次加载（且无已保存筛选）时自动将区间套为最新日期所在月（月首日→最新日期，MTD），随数据刷新自动跟进
    defaultThisMonth: true,
    // userOverridden：旧版本遗留的内部标志，仅读取做兼容，新逻辑不再用它做分流
    userOverridden: false,
    // 当前预设：新版本持久化的当前选中预设名（永远跟随，无冻结）
    currentPreset: "thisMonth"
};

export class DateRangeSlicer implements IVisual {
    private host: IVisualHost;
    private root: HTMLElement;
    private headerEl: HTMLElement;
    private labelEl: HTMLElement;
    private bodyEl: HTMLElement;
    private triggerEl: HTMLElement;
    private triggerTextEl: HTMLElement;
    private arrowEl: HTMLElement;
    private panelEl: HTMLElement;
    private presetEls: HTMLElement[] = [];
    private isPanelOpen: boolean = false;

    // ---- 列表模式（mode=list）：字段唯一值多选 ----
    /** 搜索框（仅列表模式显示） */
    private searchEl: HTMLInputElement = null;
    /** 列表容器（全选项 + N 个唯一值项） */
    private listEl: HTMLElement = null;
    /**
     * 唯一值项：display=界面显示文本，raw=下发给筛选的原始值。
     * 二者必须分开：显示用 YYYY/M/D，但筛选必须回传 Power BI 原始值才能匹配。
     */
    private listValues: { display: string; raw: any }[] = [];
    /** 已选中的项（存 display 字符串，即去重后的显示值） */
    private selectedKeys: Set<string> = new Set<string>();
    /** 列表项 DOM（用于交互白名单与选中态维护） */
    private listItemEls: HTMLElement[] = [];
    /** 上一次渲染时的模式，用于检测模式切换并清理另一模式的筛选 */
    private lastMode: string = "";
    /** 列表模式下是否由本视觉自身下发了筛选（用于区分外部清除） */
    private listFilterApplied: boolean = false;
    /**
     * 旧报表里已保存的自定义区间（由 customRange 持久化对象恢复）。
     * v2.5 起面板内不再提供日期输入框，无法再新建自定义区间；
     * 保留此字段仅为兼容旧报表——触发器和筛选仍按该区间显示/生效，只是没有编辑入口。
     */
    private customRange: { start: Date | null; end: Date | null } = { start: null, end: null };
    private docClickHandler: (e: MouseEvent) => void;
    private keyHandler: (e: KeyboardEvent) => void;
    /** iframe 失焦回收：视觉对象失去焦点（用户点到 PBI 画布别处）时收起面板 */
    private blurHandler: () => void;
    /** 失焦判定的延时器 id（blur 瞬间 activeElement 尚未稳定，需延后一个宏任务再判定） */
    private blurTimer: number = null;
    private rangeMin: Date | null = null;
    private rangeMax: Date | null = null;
    private target: { table: string; column: string } = { table: "", column: "" };
    private targetDisplayName: string = "";
    private settings = JSON.parse(JSON.stringify(DEFAULTS));
    private currentPreset: string = DEFAULTS.currentPreset;
    // 上一次已写入 persistProperties 的预设名：值未变化时跳过写入，避免 update→persist→update 自激
    private lastPersistedPreset: string | null = null;
    private isInitialized = false;
    private lastTargetKey = "";
    private lastFilterPresent = false;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;

        this.root = document.createElement("div");
        this.root.className = "dateRangeSlicer";

        this.headerEl = document.createElement("div");
        this.headerEl.className = "drs-header";

        this.labelEl = document.createElement("span");
        this.labelEl.className = "drs-label";
        this.labelEl.textContent = DEFAULTS.header.title;

        this.headerEl.appendChild(this.labelEl);

        // 触发器与浮层面板的公共定位容器：面板 absolute 相对它定位，
        // 使「标头位置=左侧」时面板仍然落在触发器正下方而不是排到右侧。
        this.bodyEl = document.createElement("div");
        this.bodyEl.className = "drs-body";

        // ---------- 第一层：单一触发器输入框（显示当前预设名/区间，点击展开面板） ----------
        this.triggerEl = document.createElement("div");
        this.triggerEl.className = "drs-trigger";
        this.triggerEl.setAttribute("role", "button");
        this.triggerEl.setAttribute("tabindex", "0");

        this.triggerTextEl = document.createElement("span");
        this.triggerTextEl.className = "drs-trigger-text";
        this.triggerTextEl.textContent = this.presetName(DEFAULTS.currentPreset);
        this.triggerEl.appendChild(this.triggerTextEl);

        this.arrowEl = document.createElement("span");
        this.arrowEl.className = "drs-trigger-arrow";
        this.arrowEl.textContent = "▾";
        this.triggerEl.appendChild(this.arrowEl);

        // ---------- 第二层：视觉内展开面板（占据区域，非浮层） ----------
        this.panelEl = document.createElement("div");
        this.panelEl.className = "drs-panel";
        // 显隐交给 class（.drs-panel-open），不用内联 style，
        // 否则内联 display 会盖过 CSS 规则、导致展开动画与 flex gap 失效

        // 预设按钮组（单列垂直列表）
        const presetGrid = document.createElement("div");
        presetGrid.className = "drs-preset-grid";
        this.presetEls = [];
        for (const p of PRESETS) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "drs-preset";
            btn.setAttribute("data-key", p.key);
            btn.textContent = p.name;
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.selectPreset(p.key);
            });
            presetGrid.appendChild(btn);
            this.presetEls.push(btn);
        }
        this.panelEl.appendChild(presetGrid);

        // ---------- 列表模式：搜索框 + 唯一值列表 ----------
        this.searchEl = document.createElement("input");
        this.searchEl.type = "text";
        this.searchEl.className = "drs-search";
        this.searchEl.setAttribute("aria-label", "搜索");
        this.searchEl.placeholder = "搜索…";
        // 输入即过滤，不触发面板收起（本元素已加入 isInteractiveTarget 白名单）
        this.searchEl.addEventListener("input", () => this.renderList());
        this.panelEl.appendChild(this.searchEl);

        this.listEl = document.createElement("div");
        this.listEl.className = "drs-list";
        this.panelEl.appendChild(this.listEl);

        this.triggerEl.addEventListener("click", (e) => {
            e.stopPropagation();
            this.togglePanel();
        });
        this.triggerEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                this.togglePanel();
            } else if (e.key === "Escape") {
                this.closePanel();
            }
        });

        this.docClickHandler = (e: MouseEvent) => {
            if (!this.isPanelOpen) {
                return;
            }
            const t = e.target as Node;
            // 视觉外（iframe 内视觉容器之外）：直接收起
            if (!this.root.contains(t)) {
                this.closePanel();
                return;
            }
            // 视觉内：除交互白名单（触发器 / 预设按钮 / 两个日期输入框）外一律收起。
            // 注：本监听在 capture 阶段，早于 trigger 自身 bubble 阶段的 handler，
            // 因此 triggerEl 必须在白名单内，否则「点触发器 → 判定为空白先关闭 →
            // 随后 trigger handler 又 toggle 打开」，形成关不掉的开关死循环。
            if (!this.isInteractiveTarget(t)) {
                this.closePanel();
            }
        };
        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && this.isPanelOpen) {
                this.closePanel();
            }
        };
        this.blurHandler = () => {
            if (!this.isPanelOpen) {
                return;
            }
            // 延后一个宏任务：blur 触发瞬间 document.activeElement 尚未稳定
            if (this.blurTimer !== null) {
                window.clearTimeout(this.blurTimer);
            }
            this.blurTimer = window.setTimeout(() => this.evaluateBlurClose(), 0);
        };

        // 组装：标头 → 主体（触发器 + 浮层面板，面板相对主体定位）
        this.bodyEl.appendChild(this.triggerEl);
        this.bodyEl.appendChild(this.panelEl);
        this.root.appendChild(this.headerEl);
        this.root.appendChild(this.bodyEl);

        options.element.appendChild(this.root);
    }

    public destroy(): void {
        // 兜底清理：面板处于展开态时视觉被销毁，避免残留监听与待执行的失焦延时器
        if (this.blurTimer !== null) {
            window.clearTimeout(this.blurTimer);
            this.blurTimer = null;
        }
        if (this.docClickHandler) {
            document.removeEventListener("click", this.docClickHandler, true);
        }
        if (this.keyHandler) {
            document.removeEventListener("keydown", this.keyHandler, true);
        }
        if (this.blurHandler) {
            window.removeEventListener("blur", this.blurHandler);
        }
    }

    private presetName(key: string): string {
        const p = PRESETS.find((x) => x.key === key);
        return p ? p.name : "";
    }

    public update(options: VisualUpdateOptions): void {
        const dataViews = options.dataViews;
        if (!dataViews || dataViews.length === 0) {
            return;
        }
        const dv = dataViews[0];

        this.resolveTarget(dv);
        this.readSettings(dv);
        this.applyStyles();

        const targetKey = `${this.target.table}.${this.target.column}`;
        const targetChanged = targetKey !== this.lastTargetKey;
        this.lastTargetKey = targetKey;

        // 每次刷新都重新计算数据 min/max，保证预设区间始终基于最新数据
        this.resolveRange(dv);

        // 模式切换：清掉另一模式留下的筛选，避免两种语义（介于 vs Is/In）冲突
        if (this.lastMode && this.lastMode !== this.settings.mode) {
            this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
            this.selectedKeys.clear();
            this.currentPreset = DEFAULTS.currentPreset;
            this.customRange = { start: null, end: null };
            this.isInitialized = false;
        }
        this.lastMode = this.settings.mode;

        const filterPresent = !!(options.jsonFilters && options.jsonFilters[0]);

        // ---------- 列表模式：完全独立的分支 ----------
        // ⚠️ 必须分流：BasicFilter 没有 conditions 字段，若让它流到下面预设模式的
        // 「非介于型筛选→清除并回到默认预设」分支，列表模式每选一次筛选就会被自己的
        // update 立刻清掉，表现为「选了没反应」。
        if (this.settings.mode === MODE.LIST) {
            this.resolveListValues(dv);
            if (filterPresent) {
                this.restoreListSelection(options.jsonFilters[0]);
            } else {
                // 外部清除筛选（如「清除所有筛选器」）→ 回到全选态
                this.selectedKeys.clear();
            }
            this.renderList();
            this.deriveTriggerLabel();
            this.lastFilterPresent = filterPresent;
            return;
        }

        if (filterPresent) {
            const f: any = options.jsonFilters[0];
            if (f && f.conditions) {
                // 切页恢复：从已保存筛选反推区间 → 精确匹配预设，命中则预设态，否则自定义态
                const cr = this.reverseCustomRange(f);
                if (cr) {
                    const matched = this.exactMatchPreset(cr.start, cr.end);
                    if (matched) {
                        this.currentPreset = matched;
                        this.customRange = { start: null, end: null };
                        this.persistCurrentPreset(matched);
                    } else {
                        // 旧报表遗留的自定义区间：无预设名、不高亮任何预设，
                        // 触发器显示区间文本（面板内已无编辑入口，但筛选与显示照旧生效）
                        this.currentPreset = "";
                        this.customRange = cr;
                    }
                }
                this.deriveTriggerLabel();
                this.updatePresetHighlight();
                this.isInitialized = true;
                this.lastFilterPresent = true;
                return;
            }
            // 非介于型筛选（如其它视觉下发的 Is/In）→ 与介于不兼容，清除并回到默认预设
            this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
            this.applyPresetFilter(this.currentPreset);
            this.isInitialized = true;
            this.lastFilterPresent = false;
            return;
        }

        // 字段变化时重置初始化状态
        if (targetChanged) {
            this.isInitialized = false;
        }

        // 外部清除筛选（如「清除所有筛选器」）后：filter 从有到无，
        // 回到当前预设（永远跟随，不冻结），按最新数据重算当前预设区间
        if (this.lastFilterPresent && this.isInitialized) {
            this.applyPresetFilter(this.currentPreset);
        }

        // 首次加载或字段变化：按「默认本月」开关决定初始预设
        if (!this.isInitialized) {
            if (this.settings.defaultThisMonth) {
                this.currentPreset = "thisMonth";
            }
            this.applyPresetFilter(this.currentPreset);
        }

        this.lastFilterPresent = false;
    }

    public getFormattingModel(): FormattingModel {
        const header = this.settings.header;
        const selection = this.settings.selection;

        const desc = (objectName: string, propertyName: string): FormattingDescriptor => ({
            objectName,
            propertyName
        });

        const color = (c: string): powerbi.ThemeColorData => ({ value: c });

        const toggleSwitch = (objectName: string, propertyName: string, value: boolean): powerbi.visuals.FormattingSimpleControl => ({
            type: "ToggleSwitch",
            properties: { descriptor: desc(objectName, propertyName), value }
        });

        const textInput = (objectName: string, propertyName: string, value: string, placeholder: string): powerbi.visuals.FormattingSimpleControl => ({
            type: "TextInput",
            properties: { descriptor: desc(objectName, propertyName), value, placeholder }
        });

        const colorPicker = (objectName: string, propertyName: string, value: string): powerbi.visuals.FormattingSimpleControl => ({
            type: "ColorPicker",
            properties: { descriptor: desc(objectName, propertyName), value: color(value) }
        });

        const numUpDown = (objectName: string, propertyName: string, value: number, min?: number, max?: number): powerbi.visuals.FormattingSimpleControl => ({
            type: "NumUpDown",
            properties: {
                descriptor: desc(objectName, propertyName),
                value,
                ...(min !== undefined ? { min } : {}),
                ...(max !== undefined ? { max } : {})
            } as any
        });

        const fontControl: powerbi.visuals.FormattingCompositeControl = {
            type: "FontControl",
            properties: {
                fontFamily: { descriptor: desc("header", "fontFamily"), value: header.fontFamily },
                fontSize: { descriptor: desc("header", "fontSize"), value: header.fontSize, min: 8 } as any,
                bold: { descriptor: desc("header", "bold"), value: header.bold },
                italic: { descriptor: desc("header", "italic"), value: header.italic },
                underline: { descriptor: desc("header", "underline"), value: header.underline }
            }
        };

        const dropdown = (objectName: string, propertyName: string, value: string, options: { value: string; displayName: string }[]): powerbi.visuals.FormattingSimpleControl => ({
            type: "Dropdown",
            properties: {
                descriptor: desc(objectName, propertyName),
                value,
                values: options
            } as any
        });

        const headerCard: FormattingCard = {
            displayName: "切片器标头",
            uid: "drs-header-card",
            topLevelToggle: {
                uid: "drs-header-show-toggle",
                suppressDisplayName: true,
                control: {
                    type: "ToggleSwitch",
                    properties: { descriptor: desc("header", "show"), value: header.show }
                } as any
            },
            groups: [
                {
                    displayName: "文本",
                    uid: "drs-header-text-group",
                    collapsible: true,
                    slices: [
                        {
                            displayName: "标题文本",
                            uid: "drs-header-title-input",
                            control: textInput("header", "title", header.title, this.targetDisplayName || "字段名")
                        },
                        {
                            displayName: "文本位置",
                            uid: "drs-header-position-dropdown",
                            control: dropdown("header", "position", header.position, [
                                { value: "top", displayName: "上方" },
                                { value: "left", displayName: "左侧" }
                            ])
                        },
                        {
                            displayName: "字体",
                            uid: "drs-header-font-control",
                            control: fontControl
                        },
                        {
                            displayName: "字体颜色",
                            uid: "drs-header-fontcolor-picker",
                            control: colorPicker("header", "fontColor", header.fontColor)
                        },
                        {
                            displayName: "背景色",
                            uid: "drs-header-bg-picker",
                            control: colorPicker("header", "background", header.background)
                        }
                    ]
                }
            ]
        };

        const selectionCard: FormattingCard = {
            displayName: "下拉样式",
            uid: "drs-selection-card",
            groups: [
                {
                    displayName: "触发器",
                    uid: "drs-selection-trigger-group",
                    collapsible: true,
                    slices: [
                        {
                            displayName: "背景色",
                            uid: "drs-selection-bg-picker",
                            control: colorPicker("selection", "backgroundColor", selection.backgroundColor)
                        },
                        {
                            displayName: "文字色（独立于强调色）",
                            uid: "drs-selection-triggertext-picker",
                            control: colorPicker("selection", "triggerTextColor", selection.triggerTextColor)
                        },
                        {
                            displayName: "边框颜色",
                            uid: "drs-selection-bordercolor-picker",
                            control: colorPicker("selection", "borderColor", selection.borderColor)
                        },
                        {
                            displayName: "边框粗细",
                            uid: "drs-selection-borderwidth-input",
                            control: numUpDown("selection", "borderWidth", selection.borderWidth, 1)
                        },
                        {
                            displayName: "圆角",
                            uid: "drs-selection-radius-input",
                            control: numUpDown("selection", "borderRadius", selection.borderRadius, 0, 10)
                        }
                    ]
                },
                {
                    displayName: "面板",
                    uid: "drs-selection-panel-group",
                    collapsible: true,
                    slices: [
                        {
                            displayName: "下拉面板背景色",
                            uid: "drs-selection-listbg-picker",
                            control: colorPicker("selection", "listBackground", selection.listBackground)
                        },
                        {
                            displayName: "下拉面板文字色",
                            uid: "drs-selection-listtext-picker",
                            control: colorPicker("selection", "listText", selection.listText)
                        }
                    ]
                },
                {
                    displayName: "列表项",
                    uid: "drs-selection-listitem-group",
                    collapsible: true,
                    slices: [
                        {
                            displayName: "强调色（选中边框）",
                            uid: "drs-selection-accent-picker",
                            control: colorPicker("selection", "accentColor", selection.accentColor)
                        },
                        {
                            displayName: "悬浮文字色",
                            uid: "drs-selection-listhovertext-picker",
                            control: colorPicker("selection", "listHoverText", selection.listHoverText)
                        },
                        {
                            displayName: "悬浮背景色（默认透明=不变灰）",
                            uid: "drs-selection-listhoverbg-picker",
                            control: colorPicker("selection", "listHoverBackground", selection.listHoverBackground)
                        },
                        {
                            displayName: "选中态文字色",
                            uid: "drs-selection-listactive-fg-picker",
                            control: colorPicker("selection", "listActiveText", selection.listActiveText)
                        },
                        {
                            displayName: "选中态背景色",
                            uid: "drs-selection-listactive-bg-picker",
                            control: colorPicker("selection", "listActiveBackground", selection.listActiveBackground)
                        },
                        {
                            displayName: "行间距",
                            uid: "drs-selection-listgap-input",
                            control: numUpDown("selection", "listGap", selection.listGap, 0, 12)
                        }
                    ]
                },
                {
                    displayName: "滚动条",
                    uid: "drs-selection-scrollbar-group",
                    collapsible: true,
                    slices: [
                        {
                            displayName: "轨道色",
                            uid: "drs-selection-scrollbar-track-picker",
                            control: colorPicker("selection", "scrollbarTrackColor", selection.scrollbarTrackColor)
                        },
                        {
                            displayName: "滑块色",
                            uid: "drs-selection-scrollbar-thumb-picker",
                            control: colorPicker("selection", "scrollbarThumbColor", selection.scrollbarThumbColor)
                        }
                    ]
                }
            ]
        };

        const defaultBehaviorCard: FormattingCard = {
            displayName: "默认行为",
            uid: "drs-default-card",
            groups: [
                {
                    displayName: "默认值",
                    uid: "drs-default-group",
                    collapsible: true,
                    slices: [
                        {
                            displayName: "默认本月（首次加载自动套最新日期所在月，随数据刷新跟进）",
                            uid: "drs-default-thismonth-toggle",
                            control: toggleSwitch("defaultBehavior", "defaultThisMonth", this.settings.defaultThisMonth)
                        }
                    ]
                }
            ]
        };

        // 模式选择卡片：放在最前，便于一眼切换 preset / list
        const modeCard: FormattingCard = {
            displayName: "切片器模式",
            uid: "drs-mode-card",
            groups: [
                {
                    displayName: "模式",
                    uid: "drs-mode-group",
                    collapsible: false,
                    slices: [
                        {
                            displayName: "选择模式",
                            uid: "drs-mode-dropdown",
                            control: dropdown("mode", "mode", this.settings.mode, [
                                { value: "preset", displayName: "预设区间（本月/上月/近N天）" },
                                { value: "list", displayName: "值列表（字段唯一值，多选）" }
                            ])
                        }
                    ]
                }
            ]
        };

        // 列表模式专属行为卡片（仅列表模式下有意义）
        const listBehaviorCard: FormattingCard = {
            displayName: "列表模式行为",
            uid: "drs-listbehavior-card",
            groups: [
                {
                    displayName: "列表",
                    uid: "drs-listbehavior-group",
                    collapsible: true,
                    slices: [
                        {
                            displayName: "显示搜索框",
                            uid: "drs-listbehavior-search-toggle",
                            control: toggleSwitch("listBehavior", "showSearch", this.settings.listBehavior.showSearch)
                        },
                        {
                            displayName: "显示「（全选）」项",
                            uid: "drs-listbehavior-selectall-toggle",
                            control: toggleSwitch("listBehavior", "showSelectAll", this.settings.listBehavior.showSelectAll)
                        }
                    ]
                }
            ]
        };

        return { cards: [modeCard, headerCard, selectionCard, listBehaviorCard, defaultBehaviorCard] };
    }

    private resolveTarget(dv: DataView): void {
        try {
            const cats = dv.categorical && dv.categorical.categories;
            let src: DataViewMetadataColumn = null;
            if (cats && cats.length > 0) {
                src = cats[0].source;
            } else if (dv.metadata && dv.metadata.columns && dv.metadata.columns.length > 0) {
                src = dv.metadata.columns[0];
            }
            if (!src) {
                return;
            }
            this.targetDisplayName = src.displayName || "";

            // 优先从 SQExpr 提取真实表名/列名（最可靠）
            const expr = (src as any).expr;
            if (expr && expr.source && expr.source.entity && expr.ref) {
                this.target = {
                    table: expr.source.entity,
                    column: expr.ref
                };
                return;
            }

            // 兜底：从 queryName 解析 "Table[Column]" 或 "Table.Column"
            const qn = (src.queryName || src.displayName || "") as string;
            const bracket = qn.match(/^(.+?)\[(.+?)\]$/);
            if (bracket) {
                this.target = { table: bracket[1], column: bracket[2] };
                return;
            }
            const dot = qn.lastIndexOf(".");
            if (dot > 0) {
                this.target = { table: qn.substring(0, dot), column: qn.substring(dot + 1) };
            } else {
                this.target = { table: "", column: src.displayName };
            }
        } catch (e) {
            /* ignore */
        }
    }

    private resolveRange(dv: DataView): { min: Date; max: Date; truncated: boolean } | null {
        try {
            const cats = dv.categorical && dv.categorical.categories;
            if (!cats || cats.length === 0 || !cats[0].values) {
                return null;
            }
            const values = cats[0].values;
            // Power BI 对自定义视觉下发的分类数据有默认行数上限；capabilities 中已声明 top 30000
            const maxLimit = 30000;
            const truncated = values.length >= maxLimit;
            let min: Date | null = null;
            let max: Date | null = null;
            let count = 0;
            for (const v of values) {
                const d = this.parseDate(v);
                if (!d) {
                    continue;
                }
                count++;
                if (!min || d < min) {
                    min = d;
                }
                if (!max || d > max) {
                    max = d;
                }
            }
            if (count === 0) {
                return null;
            }
            // 缓存数据 min/max，用于预设区间计算
            if (min && max) {
                this.rangeMin = min;
                this.rangeMax = max;
            }
            // 调试信息写入标题 tooltip，便于排查实际下发数据与筛选目标
            if (min && max) {
                const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                this.labelEl.title = `target=${this.target.table}.${this.target.column}\nn=${values.length} valid=${count} truncated=${truncated}\nmin=${fmtLocal(min)} (local)\nmax=${fmtLocal(max)} (local)`;
            }
            return min && max ? { min, max, truncated } : null;
        } catch (e) {
            return null;
        }
    }

    // ==================== 列表模式（mode=list）：字段唯一值多选 ====================

    /**
     * 从分类列提取唯一值，按显示文本去重，降序排列（日期最新在前 / 文本 Z→A）。
     *
     * ⚠️ display 与 raw 必须分开：display 只用于界面显示（YYYY/M/D，去前导零），
     * raw 必须是 Power BI 下发的原始值——筛选回传原始值才能与模型里的列正确匹配，
     * 若误把格式化后的显示字符串当筛选值会匹配不到任何数据。
     */
    private resolveListValues(dv: DataView): void {
        this.listValues = [];
        try {
            const cats = dv.categorical && dv.categorical.categories;
            if (!cats || cats.length === 0 || !cats[0].values) {
                return;
            }
            const values = cats[0].values;
            const byDisplay = new Map<string, { display: string; raw: any; sortKey: any }>();

            for (const v of values) {
                if (v == null || v === "") {
                    continue;
                }
                const d = this.parseDate(v);
                if (d) {
                    // 日期字段：显示 YYYY/M/D，排序按 Date 时间戳
                    const display = this.toDisplayDate(d);
                    if (!byDisplay.has(display)) {
                        byDisplay.set(display, { display, raw: v, sortKey: d.getTime() });
                    }
                    continue;
                }
                // 非日期（文本/数值）：原样显示与排序
                const display = String(v);
                if (!byDisplay.has(display)) {
                    byDisplay.set(display, { display, raw: v, sortKey: display });
                }
            }

            this.listValues = Array.from(byDisplay.values())
                .sort((a, b) => {
                    // 同为数字时间戳按数值降序，否则按字符串降序（localeCompare）
                    if (typeof a.sortKey === "number" && typeof b.sortKey === "number") {
                        return b.sortKey - a.sortKey;
                    }
                    return String(b.sortKey).localeCompare(String(a.sortKey));
                })
                .map((x) => ({ display: x.display, raw: x.raw }));
        } catch (e) {
            this.listValues = [];
        }
    }

    /** 渲染列表：全选项（可选）+ 唯一值项（受搜索词过滤） */
    private renderList(): void {
        if (!this.listEl) {
            return;
        }
        this.listEl.textContent = "";
        this.listItemEls = [];

        const kw = (this.searchEl ? this.searchEl.value : "").trim().toLowerCase();
        const items = kw
            ? this.listValues.filter((it) => it.display.toLowerCase().indexOf(kw) >= 0)
            : this.listValues;

        // 「（全选）」：清空筛选；全选态＝未选任何项
        if (this.settings.listBehavior.showSelectAll) {
            const all = this.createListItem(ALL_KEY, "（全选）", this.selectedKeys.size === 0);
            all.addEventListener("click", (e) => {
                e.stopPropagation();
                this.selectAllListItems();
            });
            this.listEl.appendChild(all);
        }

        if (items.length === 0) {
            const empty = document.createElement("div");
            empty.className = "drs-list-empty";
            empty.textContent = kw ? "无匹配项" : "无数据";
            this.listEl.appendChild(empty);
            return;
        }

        for (const it of items) {
            const el = this.createListItem(it.display, it.display, this.selectedKeys.has(it.display));
            el.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleListItem(it.display);
            });
            this.listEl.appendChild(el);
        }
    }

    /** 创建单个列表项 DOM（key 存 data-key，用于白名单与选中态） */
    private createListItem(key: string, text: string, selected: boolean): HTMLElement {
        const el = document.createElement("button");
        el.type = "button";
        el.className = selected ? "drs-list-item active" : "drs-list-item";
        el.setAttribute("data-key", key);
        el.textContent = text;
        this.listItemEls.push(el);
        return el;
    }

    /** 勾选/取消某一项，立即下发筛选 */
    private toggleListItem(display: string): void {
        if (this.selectedKeys.has(display)) {
            this.selectedKeys.delete(display);
        } else {
            this.selectedKeys.add(display);
        }
        this.applyListFilter();
        this.renderList();
        this.deriveTriggerLabel();
    }

    /** 全选＝清空筛选（不选中任何具体值） */
    private selectAllListItems(): void {
        this.selectedKeys.clear();
        this.applyListFilter();
        this.renderList();
        this.deriveTriggerLabel();
        // 与预设模式一致：选完立即收起面板
        this.closePanel();
    }

    /**
     * 列表模式筛选下发：
     * - 未选任何项 → 清除筛选（等价全选）
     * - 选 1 项 → BasicFilter Is；选多项 → BasicFilter In
     * 下发的是 raw（Power BI 原始值），不是显示文本。
     */
    private applyListFilter(): void {
        if (!this.target.table || !this.target.column) {
            return;
        }
        if (this.selectedKeys.size === 0) {
            this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
            this.listFilterApplied = false;
            return;
        }
        const raws: any[] = [];
        for (const it of this.listValues) {
            if (this.selectedKeys.has(it.display)) {
                raws.push(it.raw);
            }
        }
        if (raws.length === 0) {
            return;
        }
        const filter = raws.length === 1
            ? new BasicFilter(this.target, OP_IS, raws[0])
            : new BasicFilter(this.target, OP_IN, raws);
        this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);
        this.listFilterApplied = true;
    }

    /**
     * 切页恢复：从 BasicFilter 解析已保存的选中值，回写 selectedKeys。
     * 注意比对用 display 文本——筛选里的 raw 与本次下发的 values 形式可能不同
     * （Date 对象 / ISO 字符串 / 时间戳），统一转成 display 后再比对才稳。
     */
    private restoreListSelection(f: any): void {
        this.selectedKeys.clear();
        try {
            const vals: any[] = f && f.values ? f.values : null;
            if (!vals || vals.length === 0) {
                return;
            }
            const wanted = new Set<string>();
            for (const v of vals) {
                const d = this.parseDate(v);
                wanted.add(d ? this.toDisplayDate(d) : String(v));
            }
            for (const it of this.listValues) {
                if (wanted.has(it.display)) {
                    this.selectedKeys.add(it.display);
                }
            }
        } catch (e) {
            /* 解析失败保持空选中，不影响使用 */
        }
    }

    /** 日期显示格式：YYYY/M/D（去前导零），用于列表项的界面显示 */
    private toDisplayDate(d: Date): string {
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    }

    private parseDate(v: any): Date | null {
        if (v == null || v === "") {
            return null;
        }
        if (v instanceof Date) {
            return isNaN(v.getTime()) ? null : v;
        }
        if (typeof v === "number") {
            // Power BI 给自定义视觉的日期通常是 Date 对象或 ISO 字符串；
            // 若收到数字，优先按 Unix 毫秒时间戳处理（较大值），再尝试 Excel 序列号（较小整数值）
            if (v > 1e12) {
                const d = new Date(v);
                return isNaN(d.getTime()) ? null : d;
            }
            // Excel / Power BI 日期序列号：1899-12-30 起的天数
            const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof v === "string") {
            // 完整 ISO 日期时间（含 Z/时区偏移）直接解析，保留时刻；
            // 切页恢复时 Power BI 传回的是这种格式，必须按原时刻转成本地日期显示。
            if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
                const d = new Date(v);
                return isNaN(d.getTime()) ? null : d;
            }
            // 仅日期字符串：按 UTC 当天 00:00 解析，避免本地时区把日期前移/后移一天
            const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) {
                const d = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)));
                return isNaN(d.getTime()) ? null : d;
            }
            const d = new Date(v);
            return isNaN(d.getTime()) ? null : d;
        }
        return null;
    }

    /** 按 rangeMax（本地时区）计算预设区间 [start, end] */
    private computePresetRange(preset: string): { start: Date; end: Date } | null {
        if (!this.rangeMax) {
            return null;
        }
        const max = this.rangeMax;
        const maxY = max.getFullYear();
        const maxM = max.getMonth();
        const maxD = max.getDate();
        let start: Date;
        let end: Date;
        switch (preset) {
            case "thisMonth":
                // 本月（MTD）：[月首日, rangeMax]
                start = new Date(maxY, maxM, 1);
                end = new Date(maxY, maxM, maxD);
                break;
            case "lastMonth":
                // 上月：[上月1号, 上月最后一天]
                start = new Date(maxY, maxM - 1, 1);
                end = new Date(maxY, maxM, 0);
                break;
            case "last7":
                // 近7天：[rangeMax-6, rangeMax]
                start = new Date(maxY, maxM, maxD - 6);
                end = new Date(maxY, maxM, maxD);
                break;
            case "last15":
                // 近15天：[rangeMax-14, rangeMax]
                start = new Date(maxY, maxM, maxD - 14);
                end = new Date(maxY, maxM, maxD);
                break;
            case "last30":
                // 近30天：[rangeMax-29, rangeMax]
                start = new Date(maxY, maxM, maxD - 29);
                end = new Date(maxY, maxM, maxD);
                break;
            default:
                return null;
        }
        return { start, end };
    }

    /** 计算预设区间 + 下发 AdvancedFilter + 同步 UI（选预设时清空自定义区间） */
    private applyPresetFilter(preset: string): void {
        if (!this.target.table || !this.target.column) {
            return;
        }
        const range = this.computePresetRange(preset);
        if (!range) {
            return;
        }
        // 选预设即清掉旧报表遗留的自定义区间
        this.customRange = { start: null, end: null };

        // 开始日期：本地时区午夜，GreaterThanOrEqual
        const startDate = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
        // 结束日期：本地时区次日零点，LessThan（语义=包含当天）
        const endDate = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() + 1);

        const conditions: any[] = [
            { operator: "GreaterThanOrEqual", value: startDate.toJSON() },
            { operator: "LessThan", value: endDate.toJSON() }
        ];

        const filter = new AdvancedFilter(
            this.target,
            "And",
            ...conditions
        );

        this.labelEl.title = `target=${this.target.table}.${this.target.column}\n${JSON.stringify(conditions)}`;
        this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);

        this.currentPreset = preset;
        this.deriveTriggerLabel();
        this.updatePresetHighlight();
        this.isInitialized = true;
    }

    /**
     * 精确匹配：起止日期是否「恰好等于」某个预设（天级比对，两端都必须相等）。
     * 预设的本质就是给两个日期输入框赋一组值，所以只有真正等于预设时才算预设态；
     * 此前使用的模糊匹配（误差≤3天即命中）会造成「选了 8/1–8/25 却高亮近30天」的误判，已移除。
     */
    private exactMatchPreset(start: Date, end: Date): string | null {
        if (!start || !end) {
            return null;
        }
        const sDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
        const eDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
        for (const p of PRESETS) {
            const r = this.computePresetRange(p.key);
            if (!r) {
                continue;
            }
            const rs = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate()).getTime();
            const re = new Date(r.end.getFullYear(), r.end.getMonth(), r.end.getDate()).getTime();
            if (rs === sDay && re === eDay) {
                return p.key;
            }
        }
        return null;
    }

    /** 从已保存筛选 conditions 反推自定义起止（天级，用于切页恢复自定义区间显示与预设匹配） */
    private reverseCustomRange(filter: any): { start: Date; end: Date } | null {
        try {
            if (!filter || !filter.conditions || filter.conditions.length === 0) {
                return null;
            }
            let startVal: string = null;
            let endVal: string = null;
            for (const c of filter.conditions) {
                if (!c || !c.value) { continue; }
                if (c.operator === "GreaterThanOrEqual") {
                    startVal = c.value;
                } else if (c.operator === "LessThan") {
                    const d = this.parseDate(c.value);
                    if (d) {
                        endVal = this.toJSONLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
                    }
                } else if (c.operator === "LessThanOrEqual") {
                    endVal = c.value;
                }
            }
            if (!startVal || !endVal) { return null; }
            const s = this.parseDate(startVal);
            const e = this.parseDate(endVal);
            if (!s || !e) { return null; }
            return { start: s, end: e };
        } catch (e) {
            return null;
        }
    }

    /** 选中预设：套用并同步 UI 选中态，清空自定义区间 */
    private selectPreset(preset: string): void {
        this.applyPresetFilter(preset);
        this.persistCurrentPreset(preset);
        this.deriveTriggerLabel();
        this.updatePresetHighlight();
        this.closePanel();
    }

    /** 派生触发器文本：列表模式显示已选摘要，预设模式显示预设名或自定义区间 */
    private deriveTriggerLabel(): void {
        let txt: string;
        if (this.settings.mode === MODE.LIST) {
            const n = this.selectedKeys.size;
            if (n === 0) {
                txt = "（全选）";
            } else if (n === 1) {
                // 唯一一项直接显示值本身，比「已选 1 项」更直观
                txt = Array.from(this.selectedKeys)[0];
            } else {
                txt = `已选 ${n} 项`;
            }
        } else if (this.customRange.start && this.customRange.end) {
            const f = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
            txt = `${f(this.customRange.start)} - ${f(this.customRange.end)}`;
        } else {
            txt = this.presetName(this.currentPreset);
        }
        if (this.triggerTextEl) {
            this.triggerTextEl.textContent = txt;
        }
    }

    /** 高亮当前选中预设（选中态强调色描边+微光） */
    private updatePresetHighlight(): void {
        for (const el of this.presetEls) {
            const key = el.getAttribute("data-key");
            if (key === this.currentPreset) {
                el.classList.add("active");
            } else {
                el.classList.remove("active");
            }
        }
    }

    /** 开/关面板（不传参则切换） */
    private togglePanel(open?: boolean): void {
        const next = open === undefined ? !this.isPanelOpen : open;
        if (next) {
            this.openPanel();
        } else {
            this.closePanel();
        }
    }

    /**
     * 交互白名单：命中则保持面板展开，其余一切区域视为空白、点击即收起。
     * 白名单＝触发器 + 5 个预设按钮 + 搜索框 + 列表项。
     * 用白名单而非「是否在面板内」的黑名单，是为了满足「除交互元素外一律收起」的最严格判定：
     * 面板内的 padding 空白、标头文字等装饰性区域都不豁免。
     *
     * ⚠️ 搜索框必须在此白名单内：否则用户一点搜索框就会被判定为「点空白」而收起面板，
     * 搜索功能完全不可用（v2.4.3 确立的白名单机制，新增交互元素时极易漏加）。
     */
    private isInteractiveTarget(target: Node): boolean {
        if (!target) {
            return false;
        }
        if (this.triggerEl.contains(target)) {
            return true;
        }
        if (this.searchEl && this.searchEl.contains(target)) {
            return true;
        }
        if (this.listEl && this.listEl.contains(target)) {
            return true;
        }
        for (const el of this.presetEls) {
            if (el.contains(target)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 失焦判定（blur 后延后一个宏任务执行）：
     * 1. iframe 仍持有焦点 → 说明用户还在本视觉内操作，保持展开
     * 2. 其余情况（用户点到 PBI 画布任意其他位置）→ 收起
     *
     * 注：v2.4.x 曾在此豁免「焦点位于日期输入框」以保护系统日历，
     * v2.5 移除日期输入框后该分支已无意义，一并删除。
     */
    private evaluateBlurClose(): void {
        this.blurTimer = null;
        if (!this.isPanelOpen) {
            return;
        }
        if (document.hasFocus && document.hasFocus()) {
            return;
        }
        this.closePanel();
    }

    /** 打开面板：浮层下拉（absolute 相对 .drs-body），定位后绑定外部关闭监听 */
    private openPanel(): void {
        if (this.isPanelOpen) {
            return;
        }
        this.panelEl.classList.add("drs-panel-open");
        this.positionPanel();
        this.triggerEl.classList.add("active");
        this.isPanelOpen = true;
        document.addEventListener("click", this.docClickHandler, true);
        document.addEventListener("keydown", this.keyHandler, true);
        // 点击 PBI 画布其他位置（iframe 之外）时，iframe 内的 document 收不到 click，
        // 只能靠 iframe 级别的 window blur 来回收面板
        window.addEventListener("blur", this.blurHandler);
    }

    /**
     * 浮层定位：默认浮在触发器正下方（盖住下方内容＝真正的下拉观感，不推挤布局）；
     * 下方空间不足时自动翻向上方；限高在视觉可视区内 + 内部滚动，避免浮出视觉框被
     * PBI 的 iframe overflow:hidden 裁切。上下都放不下最小可视高度时，退化为视觉内
     * 流内展开（牺牲浮层观感换取内容可见）。
     */
    private positionPanel(): void {
        const GAP = 4;          // 面板与触发器的间距
        const MIN_VISIBLE = 100; // 判定「放得下」的最小可视高度

        // 先解除上一轮的定位状态，量出面板自然高度
        this.panelEl.style.maxHeight = "none";
        this.panelEl.classList.remove("drs-panel-up", "drs-panel-inline");
        this.root.classList.remove("drs-inline-mode");

        const natural = this.panelEl.scrollHeight;
        const rootRect = this.root.getBoundingClientRect();
        const trigRect = this.triggerEl.getBoundingClientRect();
        const spaceBelow = rootRect.bottom - trigRect.bottom - GAP;
        const spaceAbove = trigRect.top - rootRect.top - GAP;

        // 视觉框太矮（上下都放不下）→ 视觉内流内展开 + 容器滚动，保证内容看得见
        if (Math.max(spaceBelow, spaceAbove) < MIN_VISIBLE) {
            this.panelEl.classList.add("drs-panel-inline");
            this.root.classList.add("drs-inline-mode");
            this.panelEl.style.maxHeight = "";
            return;
        }

        // 放不下自然高度且上方更宽裕 → 向上翻转
        let up = false;
        let avail = spaceBelow;
        if (avail < natural && spaceAbove > avail) {
            up = true;
            avail = spaceAbove;
        }
        this.panelEl.classList.toggle("drs-panel-up", up);
        // 兜底 60px：空间再小也让列表露出一部分并可滚动
        this.panelEl.style.maxHeight = `${Math.max(60, Math.floor(avail))}px`;
    }

    /** 关闭面板：清理定位状态并解绑全部关闭监听 */
    private closePanel(): void {
        if (this.blurTimer !== null) {
            window.clearTimeout(this.blurTimer);
            this.blurTimer = null;
        }
        if (!this.isPanelOpen) {
            return;
        }
        this.panelEl.classList.remove("drs-panel-open", "drs-panel-up", "drs-panel-inline");
        this.panelEl.style.maxHeight = "none";
        this.root.classList.remove("drs-inline-mode");
        this.triggerEl.classList.remove("active");
        this.isPanelOpen = false;
        document.removeEventListener("click", this.docClickHandler, true);
        document.removeEventListener("keydown", this.keyHandler, true);
        window.removeEventListener("blur", this.blurHandler);
    }

    /** 持久化 currentPreset：重开报表恢复用户上次选的预设（值未变化则不写，避免 update 自激） */
    private persistCurrentPreset(preset: string): void {
        this.currentPreset = preset;
        if (this.lastPersistedPreset === preset) {
            return;
        }
        this.lastPersistedPreset = preset;
        try {
            this.host.persistProperties({
                merge: [{ objectName: "state", selector: null, properties: { currentPreset: preset } }]
            });
        } catch (e) {
            /* persistProperties 在部分宿主可能不可用，忽略不影响本次会话逻辑 */
        }
    }

    private toJSONLocal(d: Date): string {
        // 本地时区序列化，与 applyPresetFilter 中 toJSON() 一致
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toJSON();
    }

    private readSettings(dv: DataView): void {
        const objs = (dv && dv.metadata && (dv.metadata as any).objects) || {};
        const legacy = objs.dateRangeSlicer || {};

        const color = (v: any, fb: string): string => (v == null ? fb : (typeof v === "string" && v[0] === "#" ? v : (v.solid ? v.solid.color : fb)));
        const num = (v: any, fb: number): number => (typeof v === "number" ? v : (v && typeof v.solid === "undefined" && !isNaN(Number(v)) ? Number(v) : fb));
        const numZero = (v: any, fb: number): number => (v == null ? fb : (isNaN(Number(v)) ? fb : Number(v)));
        const clamp = (v: any, lo: number, hi: number, fb: number): number => {
            const n = numZero(v, fb);
            return Math.max(lo, Math.min(hi, n));
        };
        const migrateFontSize = (v: any, oldDefault: number, newDefault: number): number => {
            const n = numZero(v, newDefault);
            return n === oldDefault ? newDefault : n;
        };
        const bool = (v: any, fb: boolean): boolean => (v == null ? fb : (v === true || v === "true" || v === 1 || v === "1"));
        const txt = (v: any, fb: string): string => (v == null ? fb : (typeof v === "string" ? v : (v.solid ? v.solid.color : String(v))));

        // 切片器模式：preset（预设区间） / list（值列表多选）
        const mo = objs.mode || {};
        this.settings.mode = txt(mo.mode, DEFAULTS.mode);
        if (this.settings.mode !== MODE.LIST) {
            this.settings.mode = MODE.PRESET; // 未知值一律回落预设模式
        }

        // 列表模式行为
        const lb = objs.listBehavior || {};
        this.settings.listBehavior.showSearch = bool(lb.showSearch, DEFAULTS.listBehavior.showSearch);
        this.settings.listBehavior.showSelectAll = bool(lb.showSelectAll, DEFAULTS.listBehavior.showSelectAll);

        const h = objs.header || {};
        this.settings.header.show = bool(h.show, DEFAULTS.header.show);
        this.settings.header.position = txt(h.position, DEFAULTS.header.position);
        this.settings.header.title = txt(h.title, txt(legacy.labelText, this.targetDisplayName || DEFAULTS.header.title));
        this.settings.header.fontColor = color(h.fontColor, DEFAULTS.header.fontColor);
        this.settings.header.background = color(h.background, DEFAULTS.header.background);
        this.settings.header.fontSize = migrateFontSize(h.fontSize, 11, DEFAULTS.header.fontSize);
        this.settings.header.fontFamily = txt(h.fontFamily, DEFAULTS.header.fontFamily);
        this.settings.header.bold = bool(h.bold, DEFAULTS.header.bold);
        this.settings.header.italic = bool(h.italic, DEFAULTS.header.italic);
        this.settings.header.underline = bool(h.underline, DEFAULTS.header.underline);

        const s = objs.selection || {};
        this.settings.selection.backgroundColor = color(s.backgroundColor, color(legacy.backgroundColor, DEFAULTS.selection.backgroundColor));
        this.settings.selection.borderColor = color(s.borderColor, color(legacy.borderColor, DEFAULTS.selection.borderColor));
        this.settings.selection.borderWidth = clamp(s.borderWidth, 1, 100, DEFAULTS.selection.borderWidth);
        this.settings.selection.borderRadius = clamp(s.borderRadius, 0, 10, num(legacy.borderRadius, DEFAULTS.selection.borderRadius));
        this.settings.selection.accentColor = color(s.accentColor, color(legacy.accentColor, DEFAULTS.selection.accentColor));
        this.settings.selection.listBackground = color(s.listBackground, DEFAULTS.selection.listBackground);
        this.settings.selection.listText = color(s.listText, DEFAULTS.selection.listText);
        this.settings.selection.listHoverText = color(s.listHoverText, DEFAULTS.selection.listHoverText);
        this.settings.selection.listHoverBackground = color(s.listHoverBackground, DEFAULTS.selection.listHoverBackground);
        this.settings.selection.triggerTextColor = color(s.triggerTextColor, DEFAULTS.selection.triggerTextColor);
        this.settings.selection.listActiveText = color(s.listActiveText, DEFAULTS.selection.listActiveText);
        this.settings.selection.listActiveBackground = color(s.listActiveBackground, DEFAULTS.selection.listActiveBackground);
        this.settings.selection.scrollbarTrackColor = color(s.scrollbarTrackColor, DEFAULTS.selection.scrollbarTrackColor);
        this.settings.selection.scrollbarThumbColor = color(s.scrollbarThumbColor, DEFAULTS.selection.scrollbarThumbColor);
        this.settings.selection.listGap = clamp(s.listGap, 0, 12, DEFAULTS.selection.listGap);

        const db = objs.defaultBehavior || {};
        this.settings.defaultThisMonth = bool(db.defaultThisMonth, DEFAULTS.defaultThisMonth);

        // 内部状态（由 persistProperties 写回，不进格式面板）
        const st = objs.state || {};
        this.settings.userOverridden = bool(st.userOverridden, DEFAULTS.userOverridden);
        // 当前预设：持久化读取，旧报表无此属性时默认 thisMonth；但首载仍按 defaultThisMonth 决定（见 update）
        const persistedPreset = txt(st.currentPreset, DEFAULTS.currentPreset);
        this.currentPreset = persistedPreset;
        this.settings.currentPreset = this.currentPreset;
        // 报表里已持久化过 → 记为「已写入」，后续 update 不再重复 persist（防自激循环）
        if (st.currentPreset !== undefined && st.currentPreset !== null) {
            this.lastPersistedPreset = persistedPreset;
        }

        // 自定义区间（持久化）：customStart/customEnd 均有值时恢复为自定义态
        const cr = objs.customRange || {};
        const cs = txt(cr.customStart, "");
        const ce = txt(cr.customEnd, "");
        if (cs && ce) {
            const sd = this.parseDate(cs);
            const ed = this.parseDate(ce);
            if (sd && ed) {
                this.customRange = { start: sd, end: ed };
            }
        } else {
            this.customRange = { start: null, end: null };
        }
    }

    private applyStyles(): void {
        const h = this.settings.header;
        const s = this.settings.selection;

        // 标头位置：top=纵向堆叠（标头上、触发器下）；left=横向（标头左、触发器右）
        this.root.classList.remove("drs-layout-top", "drs-layout-left");
        this.root.classList.add(this.settings.header.position === "left" ? "drs-layout-left" : "drs-layout-top");

        this.headerEl.style.display = h.show ? "flex" : "none";
        this.headerEl.style.backgroundColor = h.background;
        this.labelEl.textContent = h.title;
        this.labelEl.style.color = h.fontColor;
        this.labelEl.style.fontSize = `${h.fontSize}px`;
        this.labelEl.style.fontFamily = h.fontFamily || "Segoe UI";
        this.labelEl.style.fontWeight = h.bold ? "bold" : "normal";
        this.labelEl.style.fontStyle = h.italic ? "italic" : "normal";
        this.labelEl.style.textDecoration = h.underline ? "underline" : "none";

        // 按模式切换面板内容：预设模式显示预设网格，列表模式显示搜索框 + 值列表。
        // 用 display 切换而非增删 DOM，避免重复绑定监听与重建开销。
        const isList = this.settings.mode === MODE.LIST;
        const grid = this.panelEl.querySelector(".drs-preset-grid") as HTMLElement;
        if (grid) {
            grid.style.display = isList ? "none" : "grid";
        }
        this.searchEl.style.display = (isList && this.settings.listBehavior.showSearch) ? "block" : "none";
        this.listEl.style.display = isList ? "block" : "none";
        // 列表模式：搜索框固定、列表区内部滚动；预设模式：面板整体滚动
        this.panelEl.classList.toggle("drs-panel-list-mode", isList);

        // 原生下拉样式变量（CSS 通过 var() 应用到 select）
        this.root.style.setProperty("--drs-bg", s.backgroundColor);
        // ⚠️ 修正：--drs-fg 原先被绑成 accentColor（强调色），导致改强调色会把
        // 触发器文字也变色。现独立为 triggerTextColor。
        this.root.style.setProperty("--drs-fg", s.triggerTextColor);
        this.root.style.setProperty("--drs-border", s.borderColor);
        this.root.style.setProperty("--drs-accent", s.accentColor);
        this.root.style.setProperty("--drs-radius", `${s.borderRadius}px`);
        this.root.style.setProperty("--drs-border-width", `${s.borderWidth}px`);
        this.root.style.setProperty("--drs-list-bg", s.listBackground);
        this.root.style.setProperty("--drs-list-fg", s.listText);
        this.root.style.setProperty("--drs-list-hover-fg", s.listHoverText);
        this.root.style.setProperty("--drs-list-hover-bg", s.listHoverBackground);
        // 选中态（预设/列表项）：独立可配，不再硬编码半透明蓝
        this.root.style.setProperty("--drs-list-active-fg", s.listActiveText);
        this.root.style.setProperty("--drs-list-active-bg", s.listActiveBackground);
        // 滚动条暗色配色
        this.root.style.setProperty("--drs-scrollbar-track", s.scrollbarTrackColor);
        this.root.style.setProperty("--drs-scrollbar-thumb", s.scrollbarThumbColor);
        this.root.style.setProperty("--drs-list-gap", `${s.listGap}px`);
    }
}
