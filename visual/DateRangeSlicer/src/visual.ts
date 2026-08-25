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

import "./../style/dateRangeSlicer.less";

"use strict";

const DEFAULTS = {
    style: "between",
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
    selection: {
        backgroundColor: "#142436",
        borderColor: "#2C4A6B",
        borderWidth: 1,
        borderRadius: 3,
        accentColor: "#378ADD",
        singleSelect: false,
        ctrlMultiSelect: true,
        showSelectAll: false
    },
    labels: {
        fontColor: "#FFFFFF",
        fontSize: 12
    }
};

export class DateRangeSlicer implements IVisual {
    private host: IVisualHost;
    private root: HTMLElement;
    private headerEl: HTMLElement;
    private labelEl: HTMLElement;
    private inputsEl: HTMLElement;
    private startEl: HTMLInputElement;
    private endEl: HTMLInputElement;
    private startWrap: HTMLElement;
    private endWrap: HTMLElement;
    private startValueEl: HTMLElement;
    private endValueEl: HTMLElement;
    // 下拉样式相关 DOM：原生 <select>（单选=浏览器漂浮下拉，多选=列表框）
    private nativeSelect: HTMLSelectElement;

    private rangeMin: Date | null = null;
    private rangeMax: Date | null = null;
    private startActive = false;
    private endActive = false;
    private target: { table: string; column: string } = { table: "", column: "" };
    private targetDisplayName: string = "";
    private settings = JSON.parse(JSON.stringify(DEFAULTS));
    private style: string = DEFAULTS.style;
    private isInitialized = false;
    private lastTargetKey = "";
    private lastFilterPresent = false;

    // 下拉样式状态
    private dateValues: { date: Date; key: string }[] = []; // 降序排列的唯一日期值
    private selectedKeys: Set<string> = new Set(); // 选中的 yyyy-mm-dd
    private dropdownInitialized = false;
    // 全选项的占位 value（选中它=清空筛选=全选态）
    private static readonly ALL_VALUE = "__all__";

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

        // ---------- 介于样式 DOM ----------
        this.startEl = document.createElement("input");
        this.startEl.type = "date";
        this.startEl.className = "drs-input drs-start";
        this.startEl.setAttribute("aria-label", "开始日期");

        this.endEl = document.createElement("input");
        this.endEl.type = "date";
        this.endEl.className = "drs-input drs-end";
        this.endEl.setAttribute("aria-label", "结束日期");

        // 叠加层显示文本：始终展示日期值（已选日期或数据边界），
        // 覆盖浏览器原生的 yyyy/mm/日 格式提示，并支持 yyyy/m/d 格式化。
        // input[type=date] 不支持自定义显示格式，只能用叠加层覆盖。
        this.startValueEl = document.createElement("span");
        this.startValueEl.className = "drs-value";
        this.endValueEl = document.createElement("span");
        this.endValueEl.className = "drs-value";

        this.startWrap = document.createElement("div");
        this.startWrap.className = "drs-input-wrap";
        this.startWrap.appendChild(this.startEl);
        this.startWrap.appendChild(this.startValueEl);

        const arrow = document.createElement("span");
        arrow.className = "drs-arrow";
        arrow.textContent = "→";

        this.endWrap = document.createElement("div");
        this.endWrap.className = "drs-input-wrap";
        this.endWrap.appendChild(this.endEl);
        this.endWrap.appendChild(this.endValueEl);

        this.inputsEl = document.createElement("div");
        this.inputsEl.className = "drs-inputs";
        this.inputsEl.appendChild(this.startWrap);
        this.inputsEl.appendChild(arrow);
        this.inputsEl.appendChild(this.endWrap);

        const onChange = () => {
            // 自动恢复边界：某一侧被清空（原生"清除"或手动删除）时，
            // 自动恢复为该侧的数据边界值（开始=最小值，结束=最大值）并置为"未激活"；
            // 当侧被填入任意具体日期（含边界本身）则视为"已激活"参与筛选。
            // 已知限制：未激活侧 value 已占住边界日期，点日历中同一边界日不会触发 change，
            // 故最小/最大日期需先选其它日期再改回，方能激活（待后续讨论优化）。
            if (this.startEl.value === "") {
                this.startEl.value = this.rangeMin ? this.toDateInput(this.rangeMin) : "";
                this.startActive = false;
            } else {
                this.startActive = true;
            }
            if (this.endEl.value === "") {
                this.endEl.value = this.rangeMax ? this.toDateInput(this.rangeMax) : "";
                this.endActive = false;
            } else {
                this.endActive = true;
            }

            this.applyBetweenFilter();
            this.updateValueDisplay();
        };
        this.startEl.addEventListener("change", onChange);
        this.endEl.addEventListener("change", onChange);

        // ---------- 下拉样式 DOM：原生 <select> ----------
        // 单选模式：浏览器原生下拉面板（OS 渲染，漂浮在画布上不受 sandbox/overflow 裁剪）
        // 多选模式：select multiple → 列表框（容器内显示，Ctrl/Shift 多选）
        this.nativeSelect = document.createElement("select");
        this.nativeSelect.className = "drs-native-select";
        this.nativeSelect.addEventListener("change", () => this.onNativeChange());

        this.root.appendChild(this.headerEl);
        this.root.appendChild(this.inputsEl);
        this.root.appendChild(this.nativeSelect);

        // 初始叠加层为空，待 update→resolveRange 计算出数据边界后再由 updateValueDisplay 填充
        this.updateValueDisplay();

        options.element.appendChild(this.root);
    }

    public update(options: VisualUpdateOptions): void {
        const dataViews = options.dataViews;
        if (!dataViews || dataViews.length === 0) {
            return;
        }
        const dv = dataViews[0];

        this.resolveTarget(dv);
        this.readSettings(dv);
        this.style = this.settings.style;
        this.applyStyles();

        const targetKey = `${this.target.table}.${this.target.column}`;
        const targetChanged = targetKey !== this.lastTargetKey;
        this.lastTargetKey = targetKey;

        // 每次刷新都重新计算数据 min/max 与唯一日期值列表，保证边界与下拉项始终准确
        this.resolveRange(dv);

        // 下拉样式走独立分支
        if (this.style === "dropdown") {
            this.updateDropdown(dv, options, targetChanged);
            return;
        }

        // ---------- 介于样式逻辑 ----------
        const filterPresent = !!(options.jsonFilters && options.jsonFilters[0]);

        if (filterPresent) {
            const f: any = options.jsonFilters[0];
            if (f && f.conditions) {
                // 切页/刷新后恢复已保存的「介于」筛选（可能只含单侧），未含的一侧保持未激活
                this.restoreFilter(f);
                this.updateValueDisplay();
                this.isInitialized = true;
                this.lastFilterPresent = true;
                return;
            }
            // 遗留的非介于型筛选（如下拉 Is/In）→ 与介于不兼容，清空并回到默认无筛选
            this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
            this.startEl.value = this.rangeMin ? this.toDateInput(this.rangeMin) : "";
            this.endEl.value = this.rangeMax ? this.toDateInput(this.rangeMax) : "";
            this.startActive = false;
            this.endActive = false;
            this.updateValueDisplay();
            this.isInitialized = true;
            this.lastFilterPresent = false;
            return;
        }

        // 字段变化时重置初始化状态
        if (targetChanged) {
            this.isInitialized = false;
        }

        // 外部清除筛选（如"清除所有筛选器"）后：filter 从有到无，
        // 两侧都回到未激活，显示数据边界但不下发筛选
        if (this.lastFilterPresent && this.isInitialized) {
            this.resetToRange();
            this.updateValueDisplay();
            this.applyBetweenFilter();
        }

        // 首次加载或字段变化：初始默认两侧都未激活（无筛选），
        // 输入框 value 自动恢复为数据边界值（开始=最小值，结束=最大值），仅叠加层显示，不参与筛选。
        if (!this.isInitialized) {
            this.startEl.value = this.rangeMin ? this.toDateInput(this.rangeMin) : "";
            this.endEl.value = this.rangeMax ? this.toDateInput(this.rangeMax) : "";
            this.startActive = false;
            this.endActive = false;
            this.updateValueDisplay();
            this.applyBetweenFilter(); // 两侧皆未激活 → 移除筛选
            this.isInitialized = true;
        }

        this.lastFilterPresent = false;
    }

    public getFormattingModel(): FormattingModel {
        const header = this.settings.header;
        const selection = this.settings.selection;
        const labels = this.settings.labels;

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
            displayName: "切片器设置",
            uid: "drs-selection-card",
            groups: [
                {
                    displayName: "选项",
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
                            displayName: "单选",
                            uid: "drs-selection-single-toggle",
                            control: toggleSwitch("selection", "singleSelect", selection.singleSelect)
                        },
                        // 配置互斥：开「单选」后隐藏「Ctrl 多选」「全选」（对齐原生切片器树形）
                        ...(selection.singleSelect ? [] : [
                            {
                                displayName: "使用 Ctrl 多选",
                                uid: "drs-selection-ctrl-toggle",
                                control: toggleSwitch("selection", "ctrlMultiSelect", selection.ctrlMultiSelect)
                            },
                            {
                                displayName: "显示“全选”项",
                                uid: "drs-selection-selectall-toggle",
                                control: toggleSwitch("selection", "showSelectAll", selection.showSelectAll)
                            }
                        ])
                    ]
                }
            ]
        };

        const labelsCard: FormattingCard = {
            displayName: "值",
            uid: "drs-labels-card",
            groups: [
                {
                    displayName: "文本",
                    uid: "drs-labels-text-group",
                    collapsible: true,
                    slices: [
                        {
                            displayName: "字体颜色",
                            uid: "drs-labels-fontcolor-picker",
                            control: colorPicker("labels", "fontColor", labels.fontColor)
                        },
                        {
                            displayName: "字体大小",
                            uid: "drs-labels-fontsize-input",
                            control: numUpDown("labels", "fontSize", labels.fontSize, 8)
                        }
                    ]
                }
            ]
        };

        const styleCard: FormattingCard = {
            displayName: "样式",
            uid: "drs-style-card",
            groups: [
                {
                    displayName: "显示",
                    uid: "drs-style-group",
                    collapsible: true,
                    slices: [
                        {
                            displayName: "显示样式",
                            uid: "drs-style-mode-dropdown",
                            control: dropdown("style", "mode", this.style, [
                                { value: "between", displayName: "介于" },
                                { value: "dropdown", displayName: "下拉" }
                            ])
                        }
                    ]
                }
            ]
        };

        return { cards: [styleCard, headerCard, selectionCard, labelsCard] };
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
                this.dateValues = [];
                return null;
            }
            const values = cats[0].values;
            // Power BI 对自定义视觉下发的分类数据有默认行数上限；capabilities 中已声明 top 30000
            const maxLimit = 30000;
            const truncated = values.length >= maxLimit;
            let min: Date | null = null;
            let max: Date | null = null;
            let count = 0;
            const collected: { date: Date; key: string }[] = [];
            const seen = new Set<string>();
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
                const key = this.toDateInput(d);
                if (!seen.has(key)) {
                    seen.add(key);
                    collected.push({ date: d, key });
                }
            }
            // 下拉列表：唯一日期值降序（最新在前），与原生下拉一致
            collected.sort((a, b) => b.date.getTime() - a.date.getTime());
            this.dateValues = collected;

            if (count === 0) {
                return null;
            }
            // 缓存数据 min/max，用于初始化/重置输入框并限制系统日历可选范围
            if (min && max) {
                this.rangeMin = min;
                this.rangeMax = max;
                const minStr = this.toDateInput(min);
                const maxStr = this.toDateInput(max);
                this.startEl.min = minStr;
                this.startEl.max = maxStr;
                this.endEl.min = minStr;
                this.endEl.max = maxStr;
            }
            // 调试信息写入标题 tooltip，便于排查实际下发数据与筛选目标
            if (min && max) {
                this.labelEl.title = `target=${this.target.table}.${this.target.column}\nn=${values.length} valid=${count} truncated=${truncated}\nraw min=${min.toISOString()}\nraw max=${max.toISOString()}`;
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

    private toDateInput(d: Date): string {
        // 按本地时区取年月日，与 input[type=date] 的显示语义一致
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    private toDisplayDate(d: Date): string {
        // 显示格式 yyyy/m/d（月、日去前导零），与 HTML 顶栏日期框一致
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    }

    private keyToFilterValue(key: string): string {
        // 与介于样式保持一致：本地午夜 → toJSON（UTC 字符串），
        // Power BI 按本地时区回显为当天 00:00，确保与日期列存储表示一致而能命中。
        const d = this.parseInputDate(key);
        if (!d) {
            return key;
        }
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toJSON();
    }

    private valueToKey(v: any): string | null {
        const d = this.parseDate(v);
        return d ? this.toDateInput(d) : null;
    }

    // ===================== 介于样式 =====================

    private updateValueDisplay(): void {
        // 叠加层显示文本（唯一可见文本，原生 input 文本已透明化）：
        // 输入框 value 始终为有效日期（已选日期，或未激活时的数据边界值），
        // 直接按 value 格式化展示即可；无 value 时（理论上不会）回退到边界提示。
        const sd = this.startEl.value ? this.parseInputDate(this.startEl.value) : null;
        const ed = this.endEl.value ? this.parseInputDate(this.endEl.value) : null;
        this.startValueEl.textContent = sd ? this.toDisplayDate(sd) : (this.rangeMin ? this.toDisplayDate(this.rangeMin) : "");
        this.endValueEl.textContent = ed ? this.toDisplayDate(ed) : (this.rangeMax ? this.toDisplayDate(this.rangeMax) : "");
    }

    private restoreFilter(filter: any): void {
        try {
            if (!filter || !filter.conditions || filter.conditions.length === 0) {
                return;
            }
            // 先全部置为未激活并自动恢复为数据边界值（开始=最小值，结束=最大值），
            // 再按 conditions 把对应侧填充为已选值并激活。
            this.startActive = false;
            this.endActive = false;
            this.startEl.value = this.rangeMin ? this.toDateInput(this.rangeMin) : "";
            this.endEl.value = this.rangeMax ? this.toDateInput(this.rangeMax) : "";
            for (const c of filter.conditions) {
                if (!c || !c.value) {
                    continue;
                }
                const d = this.parseDate(c.value);
                if (!d) {
                    continue;
                }
                if (c.operator === "GreaterThanOrEqual") {
                    this.startEl.value = this.toDateInput(d);
                    this.startActive = true;
                } else if (c.operator === "LessThanOrEqual" || c.operator === "LessThan") {
                    // LessThan 的 value 是结束日期的次日零点，需减一天得到用户实际选的结束日期
                    const ed = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    if (c.operator === "LessThan") {
                        ed.setDate(ed.getDate() - 1);
                    }
                    this.endEl.value = this.toDateInput(ed);
                    this.endActive = true;
                }
            }
        } catch (e) {
            /* ignore */
        }
    }

    private resetToRange(): void {
        // 外部清除筛选后，两侧回到未激活并自动恢复为数据边界值（开始=最小值，结束=最大值），不参与筛选。
        this.startEl.value = this.rangeMin ? this.toDateInput(this.rangeMin) : "";
        this.endEl.value = this.rangeMax ? this.toDateInput(this.rangeMax) : "";
        this.startActive = false;
        this.endActive = false;
    }

    private applyBetweenFilter(): void {
        const startVal = this.startEl.value.trim();
        const endVal = this.endEl.value.trim();

        if (!this.target.table || !this.target.column) {
            return;
        }

        const conditions: any[] = [];

        if (this.startActive && startVal) {
            const startDate = this.parseInputDate(startVal);
            if (startDate) {
                // 使用本地时区午夜，序列化后 Power BI 按本地时区显示为当天 00:00
                const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                conditions.push({ operator: "GreaterThanOrEqual", value: start.toJSON() });
            }
        }

        if (this.endActive && endVal) {
            const endDate = this.parseInputDate(endVal);
            if (endDate) {
                // 使用本地时区次日零点，配合 LessThan 操作符，
                // 语义等价于“在结束日期当天或之前”，但 Power BI 提示显示为“在 4月1日 之前”，更直观。
                // 例：结束选 3/31 → value=2026-04-01T00:00:00+08:00，LessThan 该时刻即排除 4/1 全天。
                const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1);
                conditions.push({ operator: "LessThan", value: end.toJSON() });
            }
        }

        if (conditions.length === 0) {
            this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
            this.labelEl.title = `target=${this.target.table}.${this.target.column}\n无筛选`;
            return;
        }

        const filter = new AdvancedFilter(
            this.target,
            "And",
            ...conditions
        );

        this.labelEl.title = `target=${this.target.table}.${this.target.column}\n${JSON.stringify(conditions)}`;
        this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);
    }

    private parseInputDate(s: string): Date | null {
        const m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
        if (!m) {
            return null;
        }
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const d = parseInt(m[3], 10);
        // input[type=date] 的值是本地日期，按本地时区午夜解析
        const date = new Date(y, mo, d);
        if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) {
            return null;
        }
        return date;
    }

    // ===================== 下拉样式 =====================

    private isEffectiveMulti(): boolean {
        // 非“单选”模式即为多选模式（可用 Ctrl 累加或直接多选），筛选下发 In
        return !this.settings.selection.singleSelect;
    }

    private updateDropdown(dv: DataView, options: VisualUpdateOptions, targetChanged: boolean): void {
        // 单/多选模式：单选=浏览器原生下拉（漂浮）；多选=select multiple 列表框（容器内）
        const wantMulti = !this.settings.selection.singleSelect;
        if (this.nativeSelect.multiple !== wantMulti) {
            this.nativeSelect.multiple = wantMulti;
            this.nativeSelect.size = wantMulti ? 8 : 1;
        }

        // 数据变化或首次渲染时重建 options
        if (targetChanged || this.nativeSelect.options.length === 0) {
            this.renderNativeOptions();
        }

        // 数据刷新后，剔除已不在数据范围内的选中项，避免下发失效筛选
        const validKeys = new Set(this.dateValues.map((d) => d.key));
        for (const k of Array.from(this.selectedKeys)) {
            if (!validKeys.has(k)) {
                this.selectedKeys.delete(k);
            }
        }

        const filterPresent = !!(options.jsonFilters && options.jsonFilters[0]);

        if (filterPresent) {
            const f: any = options.jsonFilters[0];
            if (f && f.conditions) {
                // 遗留的「介于」筛选与下拉不兼容：清空并移除，下拉进入默认全选态
                this.selectedKeys.clear();
                this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
            } else {
                this.restoreDropdownFilter(f);
            }
            this.coerceSingleSelection();
            this.dropdownInitialized = true;
            this.syncNativeSelect();
            this.lastFilterPresent = true;
            return;
        }

        if (targetChanged) {
            this.dropdownInitialized = false;
        }

        // 外部清除筛选（如“清除所有筛选器”）：回到全选态（无筛选）
        if (this.lastFilterPresent && this.dropdownInitialized) {
            this.selectedKeys.clear();
            this.applyDropdownFilter();
        }

        if (!this.dropdownInitialized) {
            // 默认全选（无筛选）
            this.selectedKeys.clear();
            this.applyDropdownFilter();
            this.dropdownInitialized = true;
        }

        this.coerceSingleSelection();
        this.syncNativeSelect();
        this.lastFilterPresent = false;
    }

    // 渲染 select options：可选的“全选”项 + 全部日期值（降序）
    private renderNativeOptions(): void {
        this.nativeSelect.innerHTML = "";
        const showAll = this.settings.selection.showSelectAll;
        // 多选模式才显示“全选”项（单选模式不需要，原生 select 单选默认就是单值）
        if (showAll && this.nativeSelect.multiple) {
            const allOpt = document.createElement("option");
            allOpt.value = DateRangeSlicer.ALL_VALUE;
            allOpt.textContent = "全选";
            this.nativeSelect.appendChild(allOpt);
        }
        for (const item of this.dateValues) {
            const opt = document.createElement("option");
            opt.value = item.key;
            opt.textContent = this.toDisplayDate(item.date);
            this.nativeSelect.appendChild(opt);
        }
    }

    // 把 selectedKeys 同步到 select 的选中态（程序化更新，不触发 change 事件）
    private syncNativeSelect(): void {
        const showAll = this.settings.selection.showSelectAll;
        const total = this.dateValues.length;
        // “全选态”判定：显示全选项时=已选满；不显示全选项时=未选任何=全部
        const isAllState = showAll ? (total > 0 && this.selectedKeys.size === total) : (this.selectedKeys.size === 0);
        const opts = this.nativeSelect.options;
        for (let i = 0; i < opts.length; i++) {
            const o = opts[i];
            if (o.value === DateRangeSlicer.ALL_VALUE) {
                o.selected = isAllState;
            } else {
                o.selected = this.selectedKeys.has(o.value);
            }
        }
    }

    // select change 事件：读选中项 → 更新 selectedKeys → 下发筛选
    private onNativeChange(): void {
        const showAll = this.settings.selection.showSelectAll;
        const wantMulti = this.nativeSelect.multiple;

        // 多选模式 + 显示全选项 + 全选项被选中 → 清空筛选（全选态）
        if (wantMulti && showAll) {
            const allOpt = Array.from(this.nativeSelect.options).find((o) => o.value === DateRangeSlicer.ALL_VALUE);
            if (allOpt && allOpt.selected) {
                this.selectedKeys.clear();
                this.applyDropdownFilter();
                this.syncNativeSelect();
                return;
            }
        }

        if (!wantMulti) {
            // 单选模式：select.value 即选中值
            const v = this.nativeSelect.value;
            this.selectedKeys = v ? new Set([v]) : new Set();
        } else {
            // 多选模式：读所有选中项（排除全选项）
            this.selectedKeys.clear();
            for (const o of Array.from(this.nativeSelect.selectedOptions)) {
                if (o.value !== DateRangeSlicer.ALL_VALUE) {
                    this.selectedKeys.add(o.value);
                }
            }
        }

        this.applyDropdownFilter();
    }

    private restoreDropdownFilter(filter: any): void {
        try {
            this.selectedKeys.clear();
            if (!filter) {
                return;
            }
            if (filter.operator === "Is" && filter.values && filter.values.length) {
                const k = this.valueToKey(filter.values[0]);
                if (k) {
                    this.selectedKeys.add(k);
                }
            } else if (filter.operator === "In" && filter.values) {
                for (const v of filter.values) {
                    const k = this.valueToKey(v);
                    if (k) {
                        this.selectedKeys.add(k);
                    }
                }
            }
        } catch (e) {
            /* ignore */
        }
    }

    // 单选模式收敛：多选（≥2）切到单选时保留第一个被选项，避免 radio 显示多个勾选
    private coerceSingleSelection(): void {
        if (this.settings.selection.singleSelect && this.selectedKeys.size > 1) {
            const first = Array.from(this.selectedKeys)[0];
            this.selectedKeys = new Set([first]);
        }
    }

    private applyDropdownFilter(): void {
        if (!this.target.table || !this.target.column) {
            return;
        }
        const showAll = this.settings.selection.showSelectAll;
        const total = this.dateValues.length;
        const effectiveMulti = this.isEffectiveMulti();

        // “全选”判定：显示全选项时=已选满；不显示全选项时=未选任何=全部
        const isAll = showAll ? (total > 0 && this.selectedKeys.size === total) : (this.selectedKeys.size === 0);

        if (isAll) {
            this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
            this.labelEl.title = `target=${this.target.table}.${this.target.column}\n下拉：全选（无筛选）`;
            return;
        }

        if (this.selectedKeys.size === 0) {
            if (showAll) {
                // 显示全选项且全选已取消、未勾选任何个体 → 原生语义：筛选为空（无命中）
                const filter = new BasicFilter(this.target, "In" as BasicFilterOperators, [] as any);
                this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);
            } else {
                // 不显示全选项且未勾选任何个体 → 视为全部（无筛选）
                this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
            }
            return;
        }

        const values = Array.from(this.selectedKeys).map((key) => this.keyToFilterValue(key));
        if (effectiveMulti) {
            const filter = new BasicFilter(this.target, "In" as BasicFilterOperators, values as any);
            this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);
            this.labelEl.title = `target=${this.target.table}.${this.target.column}\n下拉 IN(${values.length})`;
        } else {
            const filter = new BasicFilter(this.target, "Is" as BasicFilterOperators, values[0] as any);
            this.host.applyJsonFilter(filter, "general", "filter", FilterAction.merge);
            this.labelEl.title = `target=${this.target.table}.${this.target.column}\n下拉 Is=${values[0]}`;
        }
    }

    // ===================== 通用 =====================

    private readSettings(dv: DataView): void {
        const objs = (dv.metadata && dv.metadata.objects) || {};

        const color = (v: any, fb: string): string =>
            (v && v.solid && v.solid.color) ? v.solid.color : fb;
        const num = (v: any, fb: number): number =>
            (typeof v === "number" && !isNaN(v) && v > 0) ? v : fb;
        // 允许 0 的数值（如圆角可以等于 0）
        const numZero = (v: any, fb: number): number =>
            (typeof v === "number" && !isNaN(v) && v >= 0) ? v : fb;
        const clamp = (v: any, lo: number, hi: number, fb: number): number =>
            (typeof v === "number" && !isNaN(v)) ? Math.min(hi, Math.max(lo, v)) : fb;
        // 默认值升级迁移：旧默认值 11 在升级后自动过渡到新默认值，
        // 避免 Power BI 持久化旧实例的格式值导致新默认值不生效。
        const migrateFontSize = (v: any, oldDefault: number, newDefault: number): number => {
            const val = clamp(v, 8, 100, newDefault);
            return (val === oldDefault) ? newDefault : val;
        };
        const bool = (v: any, fb: boolean): boolean =>
            (typeof v === "boolean") ? v : fb;
        const txt = (v: any, fb: string): string =>
            (typeof v === "string" && v.length > 0) ? v : fb;

        // 兼容旧配置对象 dateRangeSlicer
        const legacy = objs.dateRangeSlicer || {};

        this.settings.style = txt(objs.style && objs.style.mode, txt(legacy.style, DEFAULTS.style));

        const h = objs.header || {};
        this.settings.header.show = bool(h.show, DEFAULTS.header.show);
        this.settings.header.position = txt(h.position, DEFAULTS.header.position);
        // 标题优先级：用户手动输入 > 旧 labelText > 字段 displayName > 默认"结算日期"
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
        this.settings.selection.singleSelect = bool(s.singleSelect, bool(legacy.singleSelect, DEFAULTS.selection.singleSelect));
        this.settings.selection.ctrlMultiSelect = bool(s.ctrlMultiSelect, bool(legacy.ctrlMultiSelect, DEFAULTS.selection.ctrlMultiSelect));
        this.settings.selection.showSelectAll = bool(s.showSelectAll, bool(legacy.showSelectAll, DEFAULTS.selection.showSelectAll));

        const l = objs.labels || {};
        this.settings.labels.fontColor = color(l.fontColor, color(legacy.foregroundColor, DEFAULTS.labels.fontColor));
        this.settings.labels.fontSize = migrateFontSize(l.fontSize, 11, DEFAULTS.labels.fontSize);
    }

    private applyStyles(): void {
        const h = this.settings.header;
        const s = this.settings.selection;
        const l = this.settings.labels;

        // 标头文本位置：top=标题在上、输入框在下；left=标题在左、输入框在右
        this.root.classList.remove("drs-layout-top", "drs-layout-left");
        this.root.classList.add(h.position === "left" ? "drs-layout-left" : "drs-layout-top");

        this.headerEl.style.display = h.show ? "flex" : "none";
        this.headerEl.style.backgroundColor = h.background;
        this.labelEl.textContent = h.title;
        this.labelEl.style.color = h.fontColor;
        this.labelEl.style.fontSize = `${h.fontSize}px`;
        this.labelEl.style.fontFamily = h.fontFamily || "Segoe UI";
        this.labelEl.style.fontWeight = h.bold ? "bold" : "normal";
        this.labelEl.style.fontStyle = h.italic ? "italic" : "normal";
        this.labelEl.style.textDecoration = h.underline ? "underline" : "none";

        this.root.style.setProperty("--drs-bg", s.backgroundColor);
        this.root.style.setProperty("--drs-fg", l.fontColor);
        this.root.style.setProperty("--drs-border", s.borderColor);
        this.root.style.setProperty("--drs-accent", s.accentColor);
        this.root.style.setProperty("--drs-radius", `${s.borderRadius}px`);
        this.root.style.setProperty("--drs-border-width", `${s.borderWidth}px`);
        this.root.style.setProperty("--drs-label-size", `${l.fontSize}px`);

        // 样式切换：介于 / 下拉 二选一显示
        const isDropdown = this.style === "dropdown";
        this.inputsEl.style.display = isDropdown ? "none" : "";
        this.nativeSelect.style.display = isDropdown ? "" : "none";
    }
}
