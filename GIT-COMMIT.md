# Git 提交规范

## 四个前缀就够用

| 前缀 | 含义 | 例子 |
|---|---|---|
| `feat` | 新增/改了某功能 | `feat: 新增列表模式多选筛选` |
| `fix` | 修了某个 bug | `fix: 面板宽度改为等于触发器宽度` |
| `chore` | 清理/配置/依赖/文档 | `chore: 清理 dist 历史产物` |
| `docs` | 只改文档 | `docs: 建立 Power BI 开发知识库` |

## 写法

```
<前缀>: <一句话说清改了啥>
```

一句话就够，**重点是动词和对象**。

## 判断标准

3 个月后看 `git log --oneline`，**这一行能不能让你立刻判断"要不要细看"**。
能就合格，不能就重写。

## 反面 vs 正面

| 差 | 好 |
|---|---|
| `backup` | `feat: 新增列表模式多选筛选` |
| `修改` | `fix: 面板宽度改为等于触发器宽度` |
| `更新` | `chore: 清理 dist 历史产物` |
| `整理` | `docs: 建立 Power BI 开发知识库` |

## 习惯建议

频繁改动 → 先存本地（不 commit），攒成一个完整功能 → 一次 commit。
需要同步时 `git push` 即可（push 不需要写信息）。

## ⚠️ PowerShell 中文乱码坑（实测踩到，2026-08-29）

### 现象
`git commit -m "docs: 新增 Git 提交规范"` 在 PowerShell 下执行，
提交信息被存成 `docs: 鏂板 Git 鎻愪氦瑙勮寖`（UTF-8 中文被按 GBK 编码传给 git）。
文件内容本身没问题，只有 commit message 乱码。

### 根因
PowerShell 把 `-m` 参数的 UTF-8 中文按系统编码（GBK）传给 git，
git 按错误编码存入 commit 对象。

### 解法：用 `-F` 文件方式提交
```powershell
# 1. 把信息写到临时文件（UTF-8 编码）
"docs: 新增 Git 提交规范" | Out-File -FilePath "$env:TEMP\msg.txt" -Encoding UTF8

# 2. 用 -F 指定信息文件
git commit -F "$env:TEMP\msg.txt"
```

### 已乱码的提交信息怎么修
```powershell
# 用 --amend + -F 重写最新一次提交的信息
git commit --amend -F "$env:TEMP\fix-msg.txt" --no-edit
```

### 规定
**PowerShell 下提交中文信息一律用 `git commit -F <文件>`，禁止用 `-m`。**
英文信息无此问题，`-m` 可用。
