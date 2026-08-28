# -*- coding: utf-8 -*-
import json

# ---------- 单卡模板（服务费/佣金图标样式，来自结算表 Get 结果） ----------
# 智趣/猿推库/总营收 用同一套外框，区别在 total 引用与标签文案

def card_total(measure, label):
    return f"""
VAR total = [{measure}]
VAR totalFmt = FORMAT(total, "#,0")
VAR a =
"<div style='
    width:100%;
    height:64px;
    background:#142436;
    border:none;
    border-radius:8px;
    font-family:Segoe UI,sans-serif;
    padding:0;
    margin:0;
    box-sizing:border-box;
    overflow:hidden;
    display:table;
'>"
    &
"<div style='
        display:table-cell;
        vertical-align:middle;
        text-align:center;
        padding:0;
    '>"
        &
"<span
            style='display:inline-block;vertical-align:middle;text-align:left;line-height:normal;position:relative;top:4px;'>
            &"
"<svg width='30' height='30' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' aria-label='佣金收入'
                style='display:inline-block;vertical-align:middle;margin:0 10px 0 0;padding:0;'>
                <circle cx='12' cy='14' r='8' fill='#378ADD' fill-opacity='0.18' stroke='#378ADD' stroke-width='2' />
                <path d='M9 10L12 14L15 10M12 14V19M9.5 15.5H14.5M9.5 17.5H14.5' fill='none' stroke='#FFFFFF'
                    stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' />
                <circle cx='24' cy='23' r='4' fill='#142436' stroke='#8CBDF2' stroke-width='1.8' />
                <path d='M22.5 23L23.5 24L25.5 21.8' fill='none' stroke='#FFFFFF' stroke-width='1.4'
                    stroke-linecap='round' stroke-linejoin='round' />
            </svg>"
            &
"<div style='
    display:inline-block;
    vertical-align:middle;
    text-align:left;
    margin:0;
    padding:0;
    white-space:nowrap;
    '>
                    <div
                        style='color:#FFFFFF;font-size:19px;line-height:1;font-weight:700;letter-spacing:0;margin:0 0 4px 0;padding:0;'>
                        "
                        & totalFmt
                        & "</div>
                    <div style='color:#B4B2A9;font-size:11px;line-height:1.1;font-weight:500;margin:0;padding:0;'>
                        {label}
                    </div>
                </div>"
            &
"</span>
    </div>
</div>"
RETURN
a
"""

def card_service(measure, label):
    return f"""
VAR total = [{measure}]
VAR totalFmt = FORMAT(total, "#,0")
VAR a =
"<div style='
    width:100%;
    height:64px;
    background:#142436;
    border:none;
    border-radius:8px;
    font-family:Segoe UI,sans-serif;
    padding:0;
    margin:0;
    box-sizing:border-box;
    overflow:hidden;
    display:table;
'>"
    &
"<div style='
        display:table-cell;
        vertical-align:middle;
        text-align:center;
        padding:0;
    '>"
        &
"<span
            style='display:inline-block;vertical-align:middle;text-align:left;line-height:normal;position:relative;top:4px;'>
            &"
"<svg width='30' height='30' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' aria-label='服务费收入'
                style='display:inline-block;vertical-align:middle;margin:0 10px 0 0;padding:0;'>
                <rect x='6' y='4' width='17' height='22' rx='2.5' fill='#378ADD' fill-opacity='0.16' stroke='#378ADD'
                    stroke-width='2' />
                <path d='M10 10H19M10 14H17' fill='none' stroke='#8CBDF2' stroke-width='1.6' stroke-linecap='round' />
                <path d='M14.5 20V16M12.5 18H16.5' fill='none' stroke='#FFFFFF' stroke-width='1.8'
                    stroke-linecap='round' />
                <circle cx='23' cy='23' r='5' fill='#142436' stroke='#8CBDF2' stroke-width='1.8' />
                <path d='M21 23L22.5 24.5L25 21.5' fill='none' stroke='#FFFFFF' stroke-width='1.5'
                    stroke-linecap='round' stroke-linejoin='round' />
            </svg>"
            &
"<div style='
    display:inline-block;
    vertical-align:middle;
    text-align:left;
    margin:0;
    padding:0;
    white-space:nowrap;
    '>
                    <div
                        style='color:#FFFFFF;font-size:19px;line-height:1;font-weight:700;letter-spacing:0;margin:0 0 4px 0;padding:0;'>
                        "
                        & totalFmt
                        & "</div>
                    <div style='color:#B4B2A9;font-size:11px;line-height:1.1;font-weight:500;margin:0;padding:0;'>
                        {label}
                    </div>
                </div>"
            &
"</span>
    </div>
</div>"
RETURN
a
"""

def card_mcn(measure, label):
    return f"""
VAR total = [{measure}]
VAR totalFmt = "¥" & FORMAT(total, "#,0")
VAR a =
"<div style='
    width:100%;
    min-height:64px;
    background:#142436;
    border:none;
    border-radius:8px;
    font-family:Segoe UI,sans-serif;
    padding:20px 10px 4px 10px;
    margin:0;
    box-sizing:border-box;
    overflow:hidden;
    text-align:center;
'>"
    &
"<div style='
        display:inline-block;
        vertical-align:middle;
        margin:0;
        padding:0;
    '>"
        &
"<svg width='30' height='30' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' aria-label='总营收趋势'
            style='display:inline-block;vertical-align:middle;margin:0 10px 0 0;padding:0;'>
            <path d='M4 25H28' fill='none' stroke='#2A4663' stroke-width='1.5' stroke-linecap='round' />
            <path d='M4 21L10 17L15 19L21 11L28 6V25H4Z' fill='#378ADD' fill-opacity='0.14' />
            <path d='M4 21L10 17L15 19L21 11L28 6' fill='none' stroke='#8CBDF2' stroke-width='2' stroke-linecap='round'
                stroke-linejoin='round' />
            <circle cx='28' cy='6' r='2.2' fill='#FFFFFF' />
            <circle cx='28' cy='6' r='1' fill='#378ADD' />
        </svg>"
        &
"<div style='
        display:inline-block;
        vertical-align:middle;
        text-align:left;
        margin:0;
        padding:0;
        white-space:nowrap;
        '>
                    <div
                        style='color:#FFFFFF;font-size:19px;line-height:1;font-weight:700;letter-spacing:0;margin:0 0 4px 0;padding:0;'>
                        "
                        & totalFmt
                        & "</div>
                    <div style='color:#B4B2A9;font-size:11px;line-height:1.1;font-weight:500;margin:0;padding:0;'>
                        {label}
                    </div>
        </div>"
        &
"</div>
</div>"
RETURN
a
"""

def card_xingtu(measure, label):
    return f"""
VAR total = [{measure}]
VAR totalFmt = FORMAT(total, "#,0")
VAR a =
"<div style='
    width:100%;
    min-height:64px;
    background:#142436;
    border:none;
    border-radius:8px;
    font-family:Segoe UI,sans-serif;
    padding:20px 10px 4px 10px;
    margin:0;
    box-sizing:border-box;
    overflow:hidden;
    text-align:center;
'>"
    &
"<div style='
        display:inline-block;
        vertical-align:middle;
        margin:0;
        padding:0;
    '>"
        &
"<svg width='30' height='30' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' aria-label='总营收柱状图'
            style='display:inline-block;vertical-align:middle;margin:0 10px 0 0;padding:0;'>
            <rect x='4' y='18' width='5' height='9' rx='1.5' fill='#378ADD' />
            <rect x='12' y='13' width='5' height='14' rx='1.5' fill='#5B9FE3' />
            <rect x='20' y='8' width='5' height='19' rx='1.5' fill='#8CBDF2' />
            <path d='M3 28H28' fill='none' stroke='#2A4663' stroke-width='1.5' stroke-linecap='round' />
            <path d='M6.5 17.5V12.5M14.5 12.5V8.5M22.5 7.5V4.5' fill='none' stroke='#FFFFFF' stroke-width='1.5'
                stroke-linecap='round' opacity='0.9' />
        </svg>"
        &
"<div style='
        display:inline-block;
        vertical-align:middle;
        text-align:left;
        margin:0;
        padding:0;
        white-space:nowrap;
        '>
                    <div
                        style='color:#FFFFFF;font-size:19px;line-height:1;font-weight:700;letter-spacing:0;margin:0 0 4px 0;padding:0;'>
                        "
                        & totalFmt
                        & "</div>
                    <div style='color:#B4B2A9;font-size:11px;line-height:1.1;font-weight:500;margin:0;padding:0;'>
                        {label}
                    </div>
        </div>"
        &
"</div>
</div>"
RETURN
a
"""

# ---------- 复合图：渠道营收与收益率（四渠道，含星图） ----------
def channel_card():
    return """
VAR vals = {
    ("星图",   DIVIDE([星图-客户成本], 10000),       [星图-毛利率],     "#378ADD"),
    ("MCN",    DIVIDE([MCN-预估机构佣金], 10000),    [MCN-预估佣金率],     "#2D6BC9"),
    ("猿推库", DIVIDE([猿推库-预估服务费收入], 10000),[猿推库-预估服务费率], "#5DCAA5"),
    ("智趣",   DIVIDE([智趣-预估服务费收入], 10000),  [智趣-预估服务费率],  "#C4A77D")
}
VAR maxRev = MAXX(vals, [Value2])
VAR bw = 28
VAR svgH = 222
VAR rateBandH = 44
VAR plotTop = 52
VAR baseY = 176
VAR plotH = baseY - plotTop
VAR x1 = 62
VAR x2 = 185
VAR x3 = 308
VAR x4 = 431
VAR bars =
    CONCATENATEX(
        ADDCOLUMNS(
            vals,
            "x",  SWITCH([Value1], "星图", x1, "MCN", x2, "猿推库", x3, "智趣", x4),
            "hBar", MAX(2, DIVIDE([Value2], maxRev, 0) * plotH),
            "yBar", baseY - MAX(2, DIVIDE([Value2], maxRev, 0) * plotH),
            "yRateDot", 23,
            "yRateText", 16,
            "fRev", FORMAT([Value2], "0.0"),
            "fRate", FORMAT([Value3], "0.0%")
        ),
        "<circle cx='" & [x] & "' cy='" & ([yRateDot] + 5) & "' r='3.25' fill='" & [Value4] & "'/>"
        & "<text x='" & [x] & "' y='" & [yRateText] & "' text-anchor='middle' font-size='11' font-weight='600' fill='#FFFFFF'>" & [fRate] & "</text>"
        & "<rect x='" & ([x] - bw/2) & "' y='" & [yBar] & "' width='" & bw & "' height='" & [hBar] & "' rx='1.5' fill='#378ADD'/>"
        & "<text x='" & [x] & "' y='" & MAX(rateBandH + 16, [yBar] - 6) & "' text-anchor='middle' font-size='11' font-weight='600' fill='#FFFFFF'>" & [fRev] & "</text>"
        & "<text x='" & [x] & "' y='" & (baseY + 18) & "' text-anchor='middle' font-size='11' fill='#B4C3D7'>" & [Value1] & "</text>",
        ""
    )
VAR grid = ""
VAR legend =
    "<g transform='translate(140, 204)'>"
    & "<circle cx='0' cy='0' r='3.5' fill='#84A8D0'/>"
    & "<text x='14' y='4' font-size='11' fill='#B4C3D7'>毛利率</text>"
    & "<rect x='82' y='-4' width='14' height='8' rx='1.5' fill='#378ADD'/>"
    & "<text x='102' y='4' font-size='11' fill='#B4C3D7'>收入(万元)</text>"
    & "</g>"
VAR svg =
    "<svg viewBox='0 0 492 " & svgH & "' xmlns='http://www.w3.org/2000/svg' style='display:block;width:100%;height:100%;overflow:hidden;' preserveAspectRatio='xMidYMid meet'>"
    & grid
    & bars
    & legend
    & "</svg>"
RETURN
"<div style='width:100%;height:100%;font-family:Segoe UI,Segoe UI Semibold,sans-serif;padding:0;margin:0;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#142436;line-height:0;'>"
& svg
& "</div>"
"""

dax_map = {
    "总营收HTML(支付)": card_total("总营收(支付)", "总营收(支付)"),
    "智趣HTML(支付)": card_service("智趣-预估服务费收入", "智趣服务费"),
    "猿推库HTML(支付)": card_service("猿推库-预估服务费收入", "猿推库服务费"),
    "MCNHTML(支付)": card_mcn("MCN-预估机构佣金", "MCN佣金"),
    "星图HTML(支付)": card_xingtu("星图-客户成本", "星图"),
    "渠道营收与收益率HTML(支付)": channel_card(),
}

definitions = []
for name, dax in dax_map.items():
    definitions.append({
        "tableName": "支付",
        "name": name,
        "expression": dax,
        "formatString": "",
        "displayFolder": "HTML(支付)",
        "isHidden": False,
    })

params = {"request": {"operation": "Create", "definitions": definitions}}
with open("html_create_request.json", "w", encoding="utf-8") as f:
    json.dump(params, f, ensure_ascii=False, indent=2)
print("written html_create_request.json with", len(definitions), "definitions")
