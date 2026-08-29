# Power BI 视觉对象开发知识库

官方文档与 API 参考的结构化存档，与 `.workbuddy/skills/` 的实战经验互补。

## 用法

### 给 AI（CodeBuddy）
开发时先读 `00-INDEX.md` 定位主题，再读对应文档获取细节。

### 给人
- 想查官方文档原文 → `official/pdf-page-index.md` 找页码 → `official/pdf-full.md` 搜 `## Page N`
- 想查 API 签名 → `api/visual-host.md`（以本地 typings 为准）
- 想查 API 版本演进 → `api/changelog.md`

## 更新

PDF 更新后重跑提取脚本：

```powershell
.venv\Scripts\python.exe visual\powerbi-visual-kb\scripts\extract_pdf.py
```

## 依赖

- Python：项目 `.venv`（python 3.13.12），**禁止用系统解释器**
- `pypdf==6.16.2`（已记录在 `requirements.txt`）

## 三条铁律

1. 接口签名以本地 `node_modules/powerbi-visuals-api` 的 typings 为准
2. Python 脚本一律用 `.venv/Scripts/python.exe`
3. 技能一律建在 `.workbuddy/skills/`
