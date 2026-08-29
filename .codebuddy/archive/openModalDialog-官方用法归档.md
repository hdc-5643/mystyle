# Power BI 官方模态对话框（openModalDialog）正确用法

> 归档说明：本内容原写入 `.workbuddy/skills/pbi-custom-visual-dev/SKILL.md` 的「八点六五」节。
> 2026-08-28 探索终止、仓库回退到 tag `v2.4.3.0` 时该文件被还原，故将此段知识移出到此处保存。
> 本目录 `.codebuddy/` 未被 git 跟踪，不受分支删除与 checkout 影响。
>
> 结论：这是「让下拉浮出 iframe 边界」的**唯一可行通道**，实测可用。
> 若日后重启该方向，先把本段内容重新贴回 SKILL.md 即可。

官方文档：https://learn.microsoft.com/zh-cn/power-bi/developer/visuals/create-display-dialog-box

## 正确签名（三段式，缺一不可）

**① 对话框实现文件**（如 `src/DateRangeDialog.ts`）——必须包含三样东西：

```typescript
export class DateRangeDialog {
    static id = "DateRangeDialog";
    // 构造函数签名固定：渲染到 options.element，用 options.host 回传结果
    constructor(options: DialogConstructorOptions, initialState: object) {
        const host = options.host;
        // ...渲染 UI 到 options.element...
        host.setResult({ /* 结果对象 */ });
        host.close(DialogAction.OK, { /* 结果对象 */ });   // 先 setResult 再 close
    }
}
export class DateRangeDialogResult { /* 结果类型，供视觉对象侧断言 */ }
// 注册表：每个对话框实现文件末尾必需的两行
(globalThis as any).dialogRegistry = (globalThis as any).dialogRegistry || {};
(globalThis as any).dialogRegistry[DateRangeDialog.id] = DateRangeDialog;
```

**② 视觉对象中调用**（返回 Promise）：

```typescript
this.host.openModalDialog(DateRangeDialog.id, dialogOptions, initialState)
    .then(ret => this.onDialogResult(ret), err => this.onDialogError(err));
```

**③ 类型补全**（5.4.0 未导出这些接口，需 `declare module`）：

```typescript
declare module "powerbi-visuals-api" {
    namespace extensibility.visual {
        interface DialogOpenOptions {
            title: string;                    // 必需
            size?: { width: number; height: number };
            position?: { type: number; left?: number; top?: number };
            actionButtons: number[];          // 必需
        }
        interface ModalDialogResult { actionId: number; resultState?: any }
        interface DialogConstructorOptions {
            element: HTMLElement;
            host: { setResult(r: object): void; close(actionId: number, r?: object): void };
        }
        interface IVisualHost {
            openModalDialog?(id: string, o: DialogOpenOptions, s: object): PromiseLike<ModalDialogResult>;
            hostCapabilities?: { allowModalDialog?: boolean; allowInteractions?: boolean };
        }
    }
}
```

## 官方枚举值（顺序不可改，极易写错）

```typescript
DialogAction = { Close: 0, OK: 1, Cancel: 2, Continue: 3, No: 4, Yes: 5 }
VisualDialogPositionType = { Center: 0, RelativeToVisual: 1 }
```

## 官方限制（属设计如此，不要当成 bug 去修）

| 项 | 说明 |
|---|---|
| 背景灰显 | 触发时报表背景会变灰（遮罩） |
| 标题/图标 | 自 API 3.8 起由视觉对象的显示名+图标决定，**无法更改**（故 `title:""` 改的是副标题，第一行标题栏改不了） |
| 副标题 | `title` 参数控制第二行副标题，传空字符串可去掉 |
| 底部操作按钮 | 最多 3 个，"可选择要显示的按钮"；传 `[]` 类型合法但**未实测** |
| 尺寸 | 最小 **240×210**，最大浏览器宽高的 90% |
| 位置 | 垂直不能为负（不能浮到视觉上方）；水平可正可负；相对视觉对象左上角 |
| 「不显示」复选框 | 安全特性，用户勾选后**当前会话内不再弹出**（刷新报表页或重启 Desktop 可恢复） |
| 自动关闭 | 启动后 **5 秒内** `host.close` 被阻止 → 去掉底部按钮后，用户 5 秒内点预设会关不掉，需延时重试补偿 |
| 不支持环境 | 嵌入式分析 / 发布到 Web / 仪表板（用 `hostCapabilities.allowModalDialog` 检测） |
| 渲染载体 | Rich HTML iframe（独立于视觉对象自己的 iframe） |

**无法去掉的残留外壳**：标题栏（视觉对象名 + X 关闭）、底部「不显示」复选框、背景遮罩。
这三样决定了它永远看起来是"对话框"而非"下拉"。

## ⚠️ 我曾犯的错（引以为戒）

1. **签名写错**：写成 `openModalDialog(options对象)`。正确是 `(dialogId, options, initialState)`。
2. **缺注册表**：没有 `globalThis.dialogRegistry` 注册，宿主找不到对话框类。
3. **枚举值写错**：`{OK:0,Cancel:1,Close:2}` → 正确是 `{Close:0,OK:1,...}`。
4. **误判"空壳 API"**：据 `typeof host.close === "function" === false` 断言 API 未实现。
   实际上 **`close` 属于对话框内部的 `IDialogHost`，视觉对象的 `IVisualHost` 本来就没有 `close`**——
   我问错了对象，得出完全错误的结论。
5. **用恒真指标当证据**：测 `el.parentElement` 判断"是否被搬到顶层"，但我是把 el 挂在 root 上，
   父节点必然是 root。该指标恒真，据此得出的结论与事实相反。
   > **通用方法论**：设计度量指标时先自问「它是否可能恒真」。恒真的指标比没有指标更危险。
6. **轻信二手记录**：CHANGELOG 里 v2.3.4.0「成功采用 openModalDialog」的记录无从验证
   （那份代码从未进 git），我先据此判定"可行"、后又据错误探测判定"不可行"，两次都错。
7. **不要用推理覆盖用户的一手观测**：用户说"下午确实弹出了"时，应先怀疑自己用错了 API。

## 结论

`openModalDialog` **确实可用**，能浮出 iframe。任何"它不生效"的判断，先检查是不是自己用错了 API。

但代价是外观受限（标题栏/复选框/遮罩去不掉），**不像下拉**。
若"下拉观感"优先，应回到 v2.4.3.0 的 iframe 内浮层方案（外观 100% 可控，但浮不出 iframe）。
