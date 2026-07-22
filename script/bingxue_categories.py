"""Authoritative Japanese categories for the S2 bingxue options.

Source:
https://www.sanguo-zhi.com/entry/nobunaga-heigaku/

Game8's current hero tables expose the contents of 機略 and 臨戦 under the
opposite heading.  Resolve known options by name so crawled heading changes do
not silently move them into the wrong category.
"""

BINGXUE_CATEGORY_OPTIONS: dict[str, tuple[str, ...]] = {
    "武略": (
        "兵勢連鎖", "舟中敵国", "当意即妙", "冷静沈着", "表裏一体", "智勇兼備",
        "胆力", "活路", "突貫", "妙策", "豪勇", "剛力", "奇謀", "警戒",
    ),
    "機略": (
        "破陣の勢い", "離間の計", "軍律擾乱", "詭計百出", "臨機応変", "七転八起",
        "強靭", "神秘", "早駆", "大勇", "鬼気", "神算", "多謀", "練磨",
    ),
    "陣立": (
        "生々流転", "気勢崩し", "陽動の策", "返り討ちの計", "勇猛果敢", "先陣誘導", "右往左往",
        "慧眼", "兵心", "不敵", "逆境", "才気", "俊才", "乱戦", "恩顧",
    ),
    "臨戦": (
        "搦手の策", "達人大観", "手当の心得", "心頭滅却", "鼓舞激励", "脱兎の如し", "殿軍救護",
        "不惑", "明鏡", "天時", "機動", "地利", "協同", "仁愛", "果敢", "兵家", "内助",
    ),
}

BINGXUE_OPTION_TO_DIRECTION = {
    option: direction
    for direction, options in BINGXUE_CATEGORY_OPTIONS.items()
    for option in options
}


def canonical_bingxue_direction(option_name: str, source_direction: str) -> str:
    """Return the verified category, falling back for options not in the list."""
    return BINGXUE_OPTION_TO_DIRECTION.get(option_name, source_direction)
