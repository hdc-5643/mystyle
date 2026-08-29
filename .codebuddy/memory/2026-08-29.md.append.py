import io
p = r'c:\Users\hdc\Desktop\营收概况\.codebuddy\memory\2026-08-29.md'
with io.open(p, 'a', encoding='utf-8') as f:
    f.write('''
## v2.8.0.4（commit cc1309a）—— 面板内容左对齐触发器

用户贴图反馈：值列表模式下搜索框/列表项整体比触发器缩进一截（面板 10px 左右 padding 所致），要求与触发器左边缘对齐，并考虑无搜索框场景。

改动（纯 LESS）：`.drs-panel` 的 `padding: 10px` → `padding: 10px 0`（去掉左右内边距）。
搜索框（padding:0 8px）/ 列表项（padding:0 8px 0 28px）自身左右内边距不变，去掉面板 padding 后其文字/checkbox 左缘距面板左边界 8px = 触发器文字距左 8px，达成对齐。
无搜索框时列表项作为面板首个可见子元素同样对齐。预设模式 .drs-preset 自动一致。

capabilities/GUID 不变（010），bump 2.8.0.3->2.8.0.4。产物校验：.drs-panel padding:10px 0、.drs-search/.drs-list-item padding 不变、版本 2.8.0.4。

校验方法：tar 解包 + .venv python 正则提取 CSS 片段（中文路径需 copy 到英文目录再解析）。
''')
print('APPENDED')
