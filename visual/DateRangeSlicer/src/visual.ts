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

import { AdvancedFilter } from "powerbi-models";

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

const DEFAULTS = {
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
        listHoverBackground: "transparent"
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
    private triggerEl: HTMLElement;
    private triggerTextEl: HTMLElement;
    private arrowEl: HTMLElement;
    private panelEl: HTMLElement;
    private presetEls: HTMLElement[] = [];
    private startInput: HTMLInputElement;
    private endInput: HTMLInputElement;
    private isPanelOpen: boolean = false;
    private customRange: { start: Date | null; end: Date | null } = { start: null, end: null };
    private docClickHandler: (e: MouseEvent) => void;
    private keyHandler: (e: KeyboardEvent) => void;
    private rangeMin: Date | null = null;
    private rangeMax: Date | null = null;
    private target: { table: string; column: string } = { table: "", column: "" };
    private targetDisplayName: string = "";
    private settings = JSON.parse(JSON.stringify(DEFAULTS));
    private currentPreset: string = DEFAULTS.currentPreset;
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
        this.panelEl.style.display = "none";

        // 预设按钮组（两列网格）
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

        // 开始/结束原生日期输入（第三层：弹系统日历自定义）
        const dateRow = document.createElement("div");
        dateRow.className = "drs-date-row";

        this.startInput = document.createElement("input");
        this.startInput.type = "date";
        this.startInput.className = "drs-date-input";
        this.startInput.setAttribute("aria-label", "开始日期");

        const dateSep = document.createElement("span");
        dateSep.className = "drs-date-sep";
        dateSep.textContent = "→";

        this.endInput = document.createElement("input");
        this.endInput.type = "date";
        this.endInput.className = "drs-date-input";
        this.endInput.setAttribute("aria-label", "结束日期");

        dateRow.appendChild(this.startInput);
        dateRow.appendChild(dateSep);
        dateRow.appendChild(this.endInput);
        this.panelEl.appendChild(dateRow);

        this.startInput.addEventListener("change", () => this.onCustomDateChange());
        this.endInput.addEventListener("change", () => this.onCustomDateChange());

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
            if (this.isPanelOpen && !this.root.contains(e.target as Node)) {
                this.closePanel();
            }
        };
        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && this.isPanelOpen) {
                this.closePanel();
            }
        };

        // 组装：标头 → 触发器 → 面板（视觉内展开）
        this.root.appendChild(this.headerEl);
        this.root.appendChild(this.triggerEl);
        this.root.appendChild(this.panelEl);

        options.element.appendChild(this.root);
    }

    public destroy(): void {
        if (this.docClickHandler) {
            document.removeEventListener("click", this.docClickHandler, true);
        }
        if (this.keyHandler) {
            document.removeEventListener("keydown", this.keyHandler, true);
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

        const filterPresent = !!(options.jsonFilters && options.jsonFilters[0]);

        if (filterPresent) {
            const f: any = options.jsonFilters[0];
            if (f && f.conditions) {
                // 切页恢复：从已保存筛选反推区间，匹配最接近的预设并高亮
                const matched = this.matchPreset(f);
                if (matched) {
                    this.currentPreset = matched;
                    this.customRange = { start: null, end: null };
                    this.persistCurrentPreset(matched);
                } else {
                    // 自定义区间（误差>3天）：从筛选 conditions 反推起止显示
                    const cr = this.reverseCustomRange(f);
                    if (cr) {
                        this.customRange = cr;
                        this.syncDateInputs(cr.start, cr.end);
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
                    displayName: "外观",
                    uid: "drs-selection-options-group",
                    collapsible: true,
                    slices: [
                        {
                            displayName: "背景色",
                            uid: "drs-selection-bg-picker",
                            control: colorPicker("selection", "backgroundColor", selection.backgroundColor)
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
                        },
                        {
                            displayName: "强调色",
                            uid: "drs-selection-accent-picker",
                            control: colorPicker("selection", "accentColor", selection.accentColor)
                        },
                        {
                            displayName: "下拉面板背景色",
                            uid: "drs-selection-listbg-picker",
                            control: colorPicker("selection", "listBackground", selection.listBackground)
                        },
                        {
                            displayName: "下拉面板文字色",
                            uid: "drs-selection-listtext-picker",
                            control: colorPicker("selection", "listText", selection.listText)
                        },
                        {
                            displayName: "悬浮文字色（只变字、不动背景）",
                            uid: "drs-selection-listhovertext-picker",
                            control: colorPicker("selection", "listHoverText", selection.listHoverText)
                        },
                        {
                            displayName: "悬浮背景色（默认透明=不变灰）",
                            uid: "drs-selection-listhoverbg-picker",
                            control: colorPicker("selection", "listHoverBackground", selection.listHoverBackground)
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

        return { cards: [headerCard, selectionCard, defaultBehaviorCard] };
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
        // 选预设：清空自定义区间，回到预设态
        this.customRange = { start: null, end: null };
        this.syncDateInputs(null, null);

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

    /** 自定义区间：直接套 customRange 下发 AdvancedFilter（选完结束日期后立即下发） */
    private applyCustomFilter(start: Date, end: Date): void {
        if (!this.target.table || !this.target.column) {
            return;
        }
        const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
        const conditions: any[] = [
            { operator: "GreaterThanOrEqual", value: startDate.toJSON() },
            { operator: "LessThan", value: endDate.toJSON() }
        ];
        const filter = new AdvancedFilter(this.target, "And", ...conditions);
        this.labelEl.title = `target=${this.target.table}.${this.target.column}\ncustom\n${JSON.stringify(conditions)}`;
        this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);
        this.currentPreset = ""; // 自定义态：无预设名
        this.deriveTriggerLabel();
        this.updatePresetHighlight();
        this.isInitialized = true;
        this.persistCustomRange(start, end);
    }

    /** 原生 date change：填 customRange 并下发（做空值/顺序校验） */
    private onCustomDateChange(): void {
        const s = this.parseDate(this.startInput.value);
        const e = this.parseDate(this.endInput.value);
        if (!s || !e) {
            return; // 两个都填了才下发，避免半区间非法
        }
        let start = s;
        let end = e;
        if (end < start) {
            // 结束早于开始：交换，并回填输入框保持视觉一致
            const t = start; start = end; end = t;
            this.syncDateInputs(start, end);
        }
        this.customRange = { start, end };
        this.applyCustomFilter(start, end);
    }

    /** 同步原生 date 输入框值（Date|null → yyyy-mm-dd） */
    private syncDateInputs(start: Date | null, end: Date | null): void {
        const fmt = (d: Date | null) => {
            if (!d) { return ""; }
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${d.getFullYear()}-${m}-${day}`;
        };
        if (this.startInput) { this.startInput.value = fmt(start); }
        if (this.endInput) { this.endInput.value = fmt(end); }
    }

    /** 从已保存筛选 conditions 反推区间，匹配最接近的预设（日期精度到天） */
    private matchPreset(filter: any): string | null {
        try {
            if (!filter || !filter.conditions || filter.conditions.length === 0) {
                return null;
            }
            let startVal: string = null;
            let endVal: string = null;
            for (const c of filter.conditions) {
                if (!c || !c.value) {
                    continue;
                }
                if (c.operator === "GreaterThanOrEqual") {
                    startVal = c.value;
                } else if (c.operator === "LessThan") {
                    // LessThan 的 value 是结束日期的次日零点，需减一天得到实际结束日期
                    const d = this.parseDate(c.value);
                    if (d) {
                        const ed = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
                        endVal = this.toJSONLocal(ed);
                    }
                } else if (c.operator === "LessThanOrEqual") {
                    endVal = c.value;
                }
            }
            if (!startVal || !endVal) {
                return null;
            }
            const sd = this.parseDate(startVal);
            const ed = this.parseDate(endVal);
            if (!sd || !ed) {
                return null;
            }
            // 归一化到天级比较
            const sDay = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate());
            const eDay = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());

            let best: string | null = null;
            let bestDiff = Infinity;
            for (const p of PRESETS) {
                const r = this.computePresetRange(p.key);
                if (!r) {
                    continue;
                }
                const rs = new Date(r.start.getFullYear(), r.start.getMonth(), r.start.getDate());
                const re = new Date(r.end.getFullYear(), r.end.getMonth(), r.end.getDate());
                const diff = Math.abs(rs.getTime() - sDay.getTime()) / 86400000
                    + Math.abs(re.getTime() - eDay.getTime()) / 86400000;
                if (diff < bestDiff) {
                    bestDiff = diff;
                    best = p.key;
                }
            }
            // 误差超过 3 天视为不匹配（用户自定义区间），保持当前预设不变
            return bestDiff <= 3 ? best : null;
        } catch (e) {
            return null;
        }
    }

    /** 从已保存筛选 conditions 反推自定义起止（与 matchPreset 同源，用于切页恢复自定义区间显示） */
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

    /** 派生第一层触发器文本：自定义区间显示「M月D日 - M月D日」，否则显示预设名 */
    private deriveTriggerLabel(): void {
        let txt: string;
        if (this.customRange.start && this.customRange.end) {
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

    /** 打开面板：视觉内展开，占据区域（display 切换，非浮层） */
    private openPanel(): void {
        if (this.isPanelOpen) {
            return;
        }
        this.panelEl.style.display = "block";
        this.triggerEl.classList.add("active");
        this.arrowEl.textContent = "▴";
        this.isPanelOpen = true;
        document.addEventListener("click", this.docClickHandler, true);
        document.addEventListener("keydown", this.keyHandler, true);
    }

    /** 关闭面板：解绑 document 监听 */
    private closePanel(): void {
        if (!this.isPanelOpen) {
            return;
        }
        this.panelEl.style.display = "none";
        this.triggerEl.classList.remove("active");
        this.arrowEl.textContent = "▾";
        this.isPanelOpen = false;
        document.removeEventListener("click", this.docClickHandler, true);
        document.removeEventListener("keydown", this.keyHandler, true);
    }

    /** 持久化 currentPreset：重开报表恢复用户上次选的预设 */
    private persistCurrentPreset(preset: string): void {
        this.currentPreset = preset;
        try {
            this.host.persistProperties({
                merge: [{ objectName: "state", selector: null, properties: { currentPreset: preset } }]
            });
        } catch (e) {
            /* persistProperties 在部分宿主可能不可用，忽略不影响本次会话逻辑 */
        }
    }

    /** 持久化自定义区间（customStart/customEnd ISO 文本），并清掉预设名 */
    private persistCustomRange(start: Date, end: Date): void {
        try {
            this.host.persistProperties({
                merge: [{
                    objectName: "customRange",
                    selector: null,
                    properties: {
                        customStart: this.toJSONLocal(start),
                        customEnd: this.toJSONLocal(end),
                        currentPreset: ""
                    }
                }]
            });
        } catch (e) {
            /* ignore */
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

        const db = objs.defaultBehavior || {};
        this.settings.defaultThisMonth = bool(db.defaultThisMonth, DEFAULTS.defaultThisMonth);

        // 内部状态（由 persistProperties 写回，不进格式面板）
        const st = objs.state || {};
        this.settings.userOverridden = bool(st.userOverridden, DEFAULTS.userOverridden);
        // 当前预设：持久化读取，旧报表无此属性时默认 thisMonth；但首载仍按 defaultThisMonth 决定（见 update）
        const persistedPreset = txt(st.currentPreset, DEFAULTS.currentPreset);
        this.currentPreset = persistedPreset;
        this.settings.currentPreset = this.currentPreset;

        // 自定义区间（持久化）：customStart/customEnd 均有值时恢复为自定义态
        const cr = objs.customRange || {};
        const cs = txt(cr.customStart, "");
        const ce = txt(cr.customEnd, "");
        if (cs && ce) {
            const sd = this.parseDate(cs);
            const ed = this.parseDate(ce);
            if (sd && ed) {
                this.customRange = { start: sd, end: ed };
                this.syncDateInputs(sd, ed);
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

        // 原生下拉样式变量（CSS 通过 var() 应用到 select）
        this.root.style.setProperty("--drs-bg", s.backgroundColor);
        this.root.style.setProperty("--drs-fg", s.accentColor);
        this.root.style.setProperty("--drs-border", s.borderColor);
        this.root.style.setProperty("--drs-accent", s.accentColor);
        this.root.style.setProperty("--drs-radius", `${s.borderRadius}px`);
        this.root.style.setProperty("--drs-border-width", `${s.borderWidth}px`);
        this.root.style.setProperty("--drs-list-bg", s.listBackground);
        this.root.style.setProperty("--drs-list-fg", s.listText);
        this.root.style.setProperty("--drs-list-hover-fg", s.listHoverText);
        this.root.style.setProperty("--drs-list-hover-bg", s.listHoverBackground);
    }
}
