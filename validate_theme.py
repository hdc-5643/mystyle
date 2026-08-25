#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
校验 Power BI 主题 JSON 是否符合 reportThemeSchema-2.143.json。
用法（在本工作空间内）：
    .venv/Scripts/python.exe validate_theme.py
    .venv/Scripts/python.exe validate_theme.py theme/PBI-Style-深蓝暗色.json
说明：
    - schema 与主题文件均在 theme/ 子目录下（git clone 后结构）。
    - schema 文件带 UTF-8 BOM，统一用 utf-8-sig 读取。
    - 默认校验 theme/PBI-Style-深蓝暗色.json；可传入其他主题文件路径。
    - 主题文件命名约定：PBI-Style-"主题"（如 PBI-Style-深蓝暗色.json）。
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator

HERE = Path(__file__).resolve().parent
SCHEMA = HERE / "theme" / "reportThemeSchema-2.143.json"
DEFAULT_THEME = HERE / "theme" / "PBI-Style-深蓝暗色.json"


def main():
    theme_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_THEME
    if not theme_path.exists():
        print(f"[错误] 找不到主题文件: {theme_path}")
        sys.exit(2)
    if not SCHEMA.exists():
        print(f"[错误] 找不到 schema 文件: {SCHEMA}")
        sys.exit(2)

    with open(SCHEMA, encoding="utf-8-sig") as f:
        schema = json.load(f)
    with open(theme_path, encoding="utf-8-sig") as f:
        theme = json.load(f)

    validator = Draft7Validator(schema)
    errors = sorted(validator.iter_errors(theme), key=lambda e: list(e.path))

    if not errors:
        print(f"[OK] {theme_path.name} 通过 schema 2.143 校验，错误数 = 0")
        sys.exit(0)

    print(f"[FAIL] {theme_path.name} 校验失败，错误数 = {len(errors)}")
    for e in errors[:50]:
        loc = " / ".join(str(p) for p in e.path) or "<root>"
        print(f"  - 位置[{loc}] :: {e.message[:200]}")
    sys.exit(1)


if __name__ == "__main__":
    main()
