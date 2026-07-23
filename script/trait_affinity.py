"""Extract troop-level affinity effects from Japanese trait descriptions."""

from __future__ import annotations

import re
import unicodedata


_TROOP_ALIASES = {
    "足軽": "足軽",
    "足輕": "足軽",
    "弓兵": "弓兵",
    "騎兵": "騎兵",
    "鉄砲": "鉄砲",
    "鐵炮": "鉄砲",
    "器械": "器械",
    "兵器": "器械",
}
_TYPE_PATTERN = "(?:" + "|".join(map(re.escape, _TROOP_ALIASES)) + ")"
_TYPE_GROUP_PATTERN = (
    rf"(?P<types>{_TYPE_PATTERN}"
    rf"(?:(?:\s*[・/、,]\s*|\s*(?:と|及び)\s*){_TYPE_PATTERN})*)"
)
_CONTEXT_PATTERN = re.compile(_TYPE_GROUP_PATTERN + r"\s*(?:レベル|等級)")
_LEVEL_PATTERN = re.compile(
    _TYPE_GROUP_PATTERN
    + r"\s*(?:レベル|等級)\s*"
    + r"(?:(?:が|を)?\s*\+?\s*(?P<level_after>\d+)"
    + r"|(?:増加|上昇|增加|上升)\s*(?P<level_before>\d+))"
)
_CAP_PATTERN = re.compile(
    r"(?:レベル|等級)?\s*上限\s*"
    + r"(?:(?:が|を)?\s*\+?\s*(?P<cap_after>\d+)"
    + r"|(?:増加|上昇|增加|上升)\s*(?P<cap_before>\d+))"
)
_VAR_PATTERN = re.compile(r"\{var:([A-Za-z_][A-Za-z0-9_]*)\}")


def _expand_vars(text: str, vars_dict: dict | None) -> str:
    values = vars_dict or {}

    def replace(match: re.Match[str]) -> str:
        value = values.get(match.group(1))
        return str(value) if isinstance(value, (int, float)) else match.group(0)

    return _VAR_PATTERN.sub(replace, text)


def infer_troop_affinity(description: str, vars_dict: dict | None = None) -> dict | None:
    """Return a frontend affinity payload when the description is a troop trait."""
    if not description:
        return None

    text = unicodedata.normalize("NFKC", _expand_vars(description, vars_dict))
    context_match = _CONTEXT_PATTERN.search(text)
    if not context_match:
        return None

    level_match = _LEVEL_PATTERN.search(text)
    level_text = (level_match.group("level_after") or level_match.group("level_before")) if level_match else None
    level = int(level_text) if level_text else 0

    cap_match = _CAP_PATTERN.search(text)
    cap_text = (cap_match.group("cap_after") or cap_match.group("cap_before")) if cap_match else None
    cap_bonus = int(cap_text) if cap_text else 0
    if level <= 0 and cap_bonus <= 0:
        return None

    troop_types: list[str] = []
    for raw_type in re.findall(_TYPE_PATTERN, context_match.group("types")):
        troop_type = _TROOP_ALIASES[raw_type]
        if troop_type not in troop_types:
            troop_types.append(troop_type)

    return {
        "troop_types": troop_types,
        "level": level,
        "level_cap_bonus": cap_bonus,
    }
