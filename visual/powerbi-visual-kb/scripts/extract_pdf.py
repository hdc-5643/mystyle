#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
从《Power BI developer visuals》官方 PDF 提取文本，生成知识库文件。

用法（必须用项目 .venv 解释器）：
    .venv/Scripts/python.exe visual/powerbi-visual-kb/scripts/extract_pdf.py

产出：
    visual/powerbi-visual-kb/official/pdf-full.md        全文（按页分节）
    visual/powerbi-visual-kb/official/pdf-page-index.md  主题→页码索引

依赖：pypdf（已记录在 requirements.txt）
"""
import os
import re
import sys

# ---- 解释器守卫：确保用项目 .venv，避免依赖装到系统环境 ----
_HERE = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_HERE, "..", "..", ".."))
_VENV_PY = os.path.join(_PROJECT_ROOT, ".venv", "Scripts", "python.exe")
if not sys.executable.lower().startswith(os.path.abspath(_VENV_PY).lower()):
    sys.exit(
        "请使用项目 .venv 解释器运行：\n"
        f"    .venv/Scripts/python.exe {os.path.relpath(os.path.abspath(__file__), _PROJECT_ROOT)}"
    )

from pypdf import PdfReader  # noqa: E402  (需在解释器校验后导入)

def find_pdf() -> str:
    """在常见位置查找 PDF（不硬编码，避免文件移动后脚本失效）。"""
    candidates = [
        os.path.join(_PROJECT_ROOT, "power-bi-developer-visuals.pdf"),
        os.path.join(_PROJECT_ROOT, "visual", "power-bi-developer-visuals.pdf"),
        os.path.join(_PROJECT_ROOT, "visual", "powerbi-visual-kb", "power-bi-developer-visuals.pdf"),
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    # 兜底：递归搜索
    for root, _dirs, files in os.walk(_PROJECT_ROOT):
        if "node_modules" in root or ".venv" in root or ".git" in root:
            continue
        if "power-bi-developer-visuals.pdf" in files:
            return os.path.join(root, "power-bi-developer-visuals.pdf")
    return ""


PDF_PATH = find_pdf()
KB_DIR = os.path.join(_PROJECT_ROOT, "visual", "powerbi-visual-kb")
OFFICIAL_DIR = os.path.join(KB_DIR, "official")

# ---- 主题 → 页码索引的关键词表（按本项目需求优先级排序）----
TOPICS = [
    ("筛选 API / 筛选下发", ["applyJsonFilter", "AdvancedFilter", "BasicFilter", "FilterAction", "jsonFilters", "TupleFilter", "IFilter[]"]),
    ("筛选：Identity / Hierarchy filter", ["Identity filter", "identityFilter", "Hierarchy identity filter"]),
    ("格式面板 Formatting Model", ["FormattingModel", "FormattingCard", "FormattingGroup", "getFormattingModel"]),
    ("格式化组件 slices", ["ToggleSwitch", "NumUpDown", "ColorPicker", "FontControl", "AlignmentGroup", "MarginPadding", "FormattingSlice"]),
    ("对话框 dialog box", ["openModalDialog", "DialogAction", "dialogRegistry", "DialogConstructorOptions"]),
    ("浮层 / 弹出层", ["pop-up", "z-index", "stacking context", "overflow: hidden", "overflow:hidden"]),
    ("resize / viewport", ["VisualUpdateType", "ResizeEnd", "options.viewport", "resize optimization"]),
    ("焦点模式 Focus mode", ["isInFocus", "switchFocusModeState", "Focus mode"]),
    ("书签 bookmarks", ["bookmarks support", "Bookmarks", "bookmarkManager"]),
    ("上下文菜单 context menu", ["showContextMenu", "context menu"]),
    ("钻取 drill", ["drill()", "Drilldown API", "drilldown"]),
    ("选择 selection", ["ISelectionManager", "createSelectionIdBuilder", "supportsMultiVisualSelection"]),
    ("高亮 highlight", ["highlight", "Highlights"]),
    ("数据视图 DataView", ["dataReductionAlgorithm", "DataViewCategorical", "dataViewMappings", "DataViewMetadataColumn"]),
    ("capabilities 配置", ["dataRoles:", "capabilities.json", "\"objects\"", "advancedEditModeSupport"]),
    ("工具提示 tooltips", ["TooltipService", "ITooltipService", "tooltips"]),
    ("本地化 localization", ["createLocalizationManager", "LocalizationManager", "localization"]),
    ("单元测试", ["karma", "jasmine", "playwright", "Add unit tests"]),
    ("同步切片器", ["Sync slicers", "sync slicers"]),
    ("键盘导航", ["keyboard navigation"]),
    ("高对比度", ["high-contrast mode", "high contrast mode"]),
    ("性能优化", ["Performance tips", "performance tips"]),
    ("发布 / 认证", ["AppSource", "get a Power BI custom visual certified", "Package a Power BI visual"]),
    ("许可 license", ["License enforcement API", "Licensing models"]),
    ("R / Python 视觉", ["R-powered", "R script", "Python visual"]),
    ("React", ["React"]),
    ("移动端", ["mobile friendly", "Mobile"]),
    ("本地存储 API", ["Local storage API", "storageService", "ILocalVisualStorageService"]),
    ("认证 authentication", ["Authentication API", "Microsoft Entra ID", "authenticationService"]),
    ("启动 URL / 文件下载", ["launchUrl", "File download API", "downloadService"]),
    ("事件 API", ["eventService", "'Rendering' events"]),
    ("条件格式", ["conditional formatting"]),
    ("排序", ["applyCustomSort", "custom sort"]),
    ("获取大数据 fetchMoreData", ["fetchMoreData"]),
    ("无数据绑定渲染", ["without requiring data binding", "Render a visual without"]),
    ("显示警告图标", ["displayWarningIcon"]),
    ("小计 subtotal", ["subtotal", "Subtotals"]),
    ("动态格式字符串", ["dynamic format strings"]),
    ("On-object formatting", ["on object formatting", "On object formatting"]),
    ("子选择 Subselection", ["Subselection API", "subselection"]),
]


# 单主题命中页数超过此值即视为「关键词过泛」，索引中标记为噪音
NOISE_THRESHOLD = 40


def clean(text: str) -> str:
    """清理提取文本中的站点导航噪声与多余空行。"""
    lines = []
    for ln in text.splitlines():
        s = ln.strip()
        if not s:
            continue
        low = s.lower()
        # 去 Microsoft Learn 页面 chrome
        if low in ("expand table", "table of contents", "provide feedback", "skip to main content"):
            continue
        if low.startswith("was this page helpful"):
            continue
        lines.append(s)
    # 折叠 3+ 连续空行为 2 行
    out = "\n".join(lines)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def build_full_md(reader: PdfReader) -> str:
    parts = [
        "# Power BI developer visuals — 官方 PDF 全文提取",
        "",
        "> 来源：`power-bi-developer-visuals.pdf`（Microsoft Learn 官方文档，2025-12 更新）",
        "> 提取脚本：`visual/powerbi-visual-kb/scripts/extract_pdf.py`",
        ">",
        "> ⚠️ **本文件是原文存档（约 2MB），不适合整体阅读。**",
        "> - 需要定位主题 → 先查 `pdf-page-index.md` 或 `../00-INDEX.md`",
        "> - 接口签名**以本地 `node_modules/powerbi-visuals-api` 的 typings 为准**（PDF 版本可能过时，含已废弃成员如 `acquireAADTokenService`）",
        "",
        f"共 {len(reader.pages)} 页。",
        "",
    ]
    for i, page in enumerate(reader.pages, start=1):
        try:
            raw = page.extract_text() or ""
        except Exception as e:
            raw = f"（本页提取失败：{e}）"
        body = clean(raw)
        parts.append(f"\n---\n\n## Page {i}\n")
        if body:
            parts.append(body)
        else:
            parts.append("（本页无可提取文本，可能是纯图/分隔页）")
        parts.append("")
    return "\n".join(parts)


def build_page_index(reader: PdfReader) -> str:
    # 先逐页取文本缓存
    pages_text = []
    for page in reader.pages:
        try:
            pages_text.append(page.extract_text() or "")
        except Exception:
            pages_text.append("")

    parts = [
        "# PDF 页码索引（主题 → 页码）",
        "",
        "> 用法：先在这里找到页码，再到 `pdf-full.md` 中搜索 `## Page N` 查看原文。",
        "> 生成脚本：`scripts/extract_pdf.py`（PDF 更新后重跑即可刷新）",
        "",
        "## 主题索引",
        "",
    ]
    for name, keywords in TOPICS:
        hits = []
        for idx, t in enumerate(pages_text, start=1):
            if any(k in t for k in keywords):
                hits.append(idx)
        if not hits:
            parts.append(f"- **{name}**：（PDF 中未命中关键词）")
            continue
        # 命中过多说明关键词太泛，索引失去定位价值 → 标记噪音，只给首末范围
        if len(hits) > NOISE_THRESHOLD:
            parts.append(
                f"- **{name}**：⚠️ 命中 {len(hits)} 页（关键词过泛，请改用全文检索）"
                f"（p{hits[0]}–p{hits[-1]}）"
            )
            continue
        if len(hits) <= 14:
            plist = ", ".join(f"p{n}" for n in hits)
        else:
            head = ", ".join(f"p{n}" for n in hits[:12])
            plist = f"{head} …（共 {len(hits)} 页，其余为 p{hits[12]}–p{hits[-1]}）"
        parts.append(f"- **{name}**：{plist}")

    parts += [
        "",
        "## 按 PDF 目录（Outline）定位",
        "",
        "以下为 PDF 自带书签对应的章节，页码由 PDF 内部目标解析（解析失败则略过）。",
        "",
    ]

    def walk(items, depth=0):
        for it in items:
            if isinstance(it, list):
                walk(it, depth + 1)
                continue
            title = str(getattr(it, "title", it))
            pno = "?"
            try:
                page_obj = reader.get_destination_page_number(it)
                if page_obj is not None:
                    pno = page_obj + 1
            except Exception:
                pass
            parts.append(f"{'  ' * depth}- {title}（p{pno}）")

    try:
        walk(reader.outline)
    except Exception:
        parts.append("（PDF 无书签信息）")

    return "\n".join(parts) + "\n"


def main() -> None:
    if not os.path.exists(PDF_PATH):
        sys.exit(f"找不到 PDF：{PDF_PATH}")
    os.makedirs(OFFICIAL_DIR, exist_ok=True)

    reader = PdfReader(PDF_PATH)
    print(f"读取 PDF：{len(reader.pages)} 页")

    full = build_full_md(reader)
    full_path = os.path.join(OFFICIAL_DIR, "pdf-full.md")
    with open(full_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(full)
    print(f"已写出：{os.path.relpath(full_path, _PROJECT_ROOT)}（{os.path.getsize(full_path)/1048576:.2f} MB）")

    idx = build_page_index(reader)
    idx_path = os.path.join(OFFICIAL_DIR, "pdf-page-index.md")
    with open(idx_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(idx)
    print(f"已写出：{os.path.relpath(idx_path, _PROJECT_ROOT)}（{os.path.getsize(idx_path)/1024:.1f} KB）")


if __name__ == "__main__":
    main()
