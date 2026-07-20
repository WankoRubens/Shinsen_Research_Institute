"""
Build frontend JSON from crawled + canonical YAML data.

Reads:
  data/heroes_crawled.yaml
  data/skills.yaml        (canonical)
  data/traits.yaml        (canonical)

Outputs:
  .build/heroes.json  (array of heroes)
  .build/skills.json  (array of skills)

Usage:
    python script/build_frontend_data.py
"""

import json
import os
import re
import yaml
from pathlib import Path

from llm_core import load_overrides
from merge_sources import opencc_s2tw
from paths import (
    BUILD_DIR,
    CFG_CURRENT_JSON,
    HEROES_CRAWLED, HEROES_TRANSLATED,
    SKILLS_CANONICAL, TRAITS_CANONICAL, BINGXUE_CANONICAL,
    STATUSES_YAML,
    HEROES_JSON, SKILLS_JSON, STATUSES_JSON, BINGXUE_JSON, ENEMY_FORMATIONS_JSON,
    BINGXUE_JP_TO_CHT_DIR,
    PROTOTYPE_DIR,
    SHINSEN_SIM_API_JSON, S3_CODOMO_TEMPLATES_JSON, GAME8_SKILLS_INDEX_JSON,
)

# When CFG_AUTHORITATIVE=1 (default), cfg.json wins over LLM output for
# names and top-level metadata (skill names, target, brief_description,
# type, hero clan/faction/cost/rarity/unique_skill). Description text
# still comes from the LLM in Phase 3 — Phase 4 will swap in cfg-derived
# descriptions. Set CFG_AUTHORITATIVE=0 to roll back to legacy behavior.
CFG_AUTHORITATIVE = os.environ.get("CFG_AUTHORITATIVE", "1") == "1"

# cfg.skill_kind is zh-hans; the build emits zh-hant `type`.
# Key set must stay in sync with the SKILL_KINDS / TRAIT_KINDS / BINGXUE_KINDS /
# ASSEMBLY_KINDS constants in merge_sources.py — when cfg adds a new skill_kind,
# update both files.
ZH_HANS_TO_HANT_TYPE = {
    "主动": "主動", "被动": "被動", "指挥": "指揮", "突击": "突擊",
    "阵法": "陣法", "兵种": "兵種",
    "特性": "特性", "天赋": "天賦", "评定众": "評定眾",
}

CFG_HERO_DRIFT_PATH = BUILD_DIR / "cfg_hero_drift.yaml"
CFG_OVERRIDE_CONFLICTS_PATH = BUILD_DIR / "cfg_override_conflicts.yaml"
CFG_SELECTABLE_SKILL_KINDS = {"指挥", "主动", "被动", "突击", "兵种", "阵法"}
CFG_DEFAULT_STATS = {"lea": 100, "val": 100, "int": 100, "pol": 100, "cha": 100, "spd": 100}

SIM_CATEGORY_TO_TRIGGER = {
    "active": "beforeAction",
    "assault": "afterAttack",
    "command": "battleStart",
    "passive": "battleStart",
    "troop": "battleStart",
}

SIM_CATEGORY_TO_JP = {
    "active": "能動",
    "assault": "突撃",
    "command": "指揮",
    "passive": "受動",
    "troop": "兵種",
}


def _norm_name(value) -> str:
    return re.sub(r"\s+", "", str(value or "")).strip()


def _index_by_names(items: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for item in items:
        for field in ("name_jp", "name", "aliases"):
            value = item.get(field)
            if isinstance(value, list):
                for alias in value:
                    if _norm_name(alias):
                        out.setdefault(_norm_name(alias), item)
            elif _norm_name(value):
                out.setdefault(_norm_name(value), item)
    return out


def _load_shinsen_sim_data() -> dict:
    if not SHINSEN_SIM_API_JSON.exists():
        return {}
    try:
        return json.loads(SHINSEN_SIM_API_JSON.read_text("utf-8-sig"))
    except Exception as exc:
        print(f"[warn] failed to load {SHINSEN_SIM_API_JSON}: {exc}")
        return {}


def _sim_rate_text(probability) -> str:
    if probability is None:
        return ""
    try:
        p = float(probability)
    except (TypeError, ValueError):
        return ""
    return f"{p * 100:g}%"


def _merge_shinsen_sim_data(heroes: list[dict], skills: list[dict]) -> tuple[list[dict], list[dict], dict]:
    """Merge structured public simulator metadata into frontend data.

    The source simulator keeps battle execution server-side, but /api/data
    exposes the same normalized commander/tactic fields the API accepts. We
    use those fields for battle calculations and template enemies without
    replacing the existing cfg/game8 identity data.
    """
    data = _load_shinsen_sim_data()
    if not data:
        return heroes, skills, {"heroes": 0, "skills": 0, "enemy_formations": 0}

    hero_by_name = _index_by_names(heroes)
    skill_by_name = _index_by_names(skills)
    merged_heroes = 0
    merged_skills = 0

    for commander in data.get("commanders", []):
        hero = hero_by_name.get(_norm_name(commander.get("name")))
        if not hero:
            continue
        stats = {
            "lea": commander.get("command"),
            "val": commander.get("bravery"),
            "int": commander.get("strategy"),
            "pol": commander.get("politics"),
            "cha": commander.get("charm"),
            "spd": commander.get("speed"),
        }
        if all(isinstance(v, (int, float)) for v in stats.values()):
            hero["stats"] = {k: int(v) for k, v in stats.items()}
        hero["sim_id"] = commander.get("id")
        if commander.get("faction"):
            hero.setdefault("faction_jp", commander["faction"])
        if commander.get("clan"):
            hero.setdefault("clan_jp", commander["clan"])
        if commander.get("gender") and not hero.get("gender"):
            hero["gender"] = commander["gender"]
        traits = []
        for trait in commander.get("traits") or []:
            traits.append({
                "name": trait.get("name") or "",
                "name_jp": trait.get("name") or "",
                "description": trait.get("content") or "",
                "description_jp": trait.get("content") or "",
                "rank": "S" if trait.get("level") == "0" else "A",
                "active": True,
                "sim_level": trait.get("level"),
            })
        if traits:
            hero["traits"] = traits
        merged_heroes += 1

    for tactic in data.get("tactics", []):
        skill = skill_by_name.get(_norm_name(tactic.get("name")))
        if not skill:
            continue
        category = tactic.get("category") or ""
        tags = [
            part.strip()
            for part in str(tactic.get("tags") or "").split("/")
            if part.strip()
        ]
        skill["sim_id"] = tactic.get("id")
        skill["probability"] = tactic.get("probability")
        skill["category"] = category
        skill["battle_type"] = tactic.get("type") or ""
        skill["damage_type"] = tactic.get("damageType") or ""
        skill["damage_rate_max"] = tactic.get("damageRateMax")
        skill["heal_rate_max"] = tactic.get("healRateMax")
        skill["dot_name"] = tactic.get("dotName") or ""
        skill["dot_rate_max"] = tactic.get("dotRateMax")
        skill["dot_turns"] = tactic.get("dotTurns")
        skill["control_type"] = tactic.get("controlType") or ""
        skill["control_turns"] = tactic.get("controlTurns")
        skill["buff_types"] = tactic.get("buffTypes") or ""
        skill["debuff_types"] = tactic.get("debuffTypes") or ""
        skill["battle_tags"] = tags
        skill["effect_value"] = tactic.get("effectValue") or ""
        skill["target_jp"] = tactic.get("target") or ""
        skill["trigger"] = SIM_CATEGORY_TO_TRIGGER.get(category, skill.get("trigger"))
        if category and not skill.get("type"):
            skill["type"] = SIM_CATEGORY_TO_JP.get(category, category)
        if tactic.get("target"):
            skill["target"] = tactic["target"]
        if tactic.get("description") and not skill.get("description_jp"):
            skill["description_jp"] = tactic["description"]
        if tactic.get("description") and not skill.get("brief_description_jp"):
            skill["brief_description_jp"] = tactic["description"].split("。", 1)[0][:80]
        if not skill.get("activation_rate"):
            skill["activation_rate"] = _sim_rate_text(tactic.get("probability"))
        if tags:
            existing_tags = skill.get("tags") or []
            skill["tags"] = list(dict.fromkeys([*existing_tags, *tags]))
        merged_skills += 1

    return heroes, skills, {
        "heroes": merged_heroes,
        "skills": merged_skills,
        "enemy_formations": len(data.get("enemyFormations", [])),
    }


def _build_enemy_formations(heroes: list[dict], skills: list[dict]) -> list[dict]:
    if S3_CODOMO_TEMPLATES_JSON.exists():
        payload = json.loads(S3_CODOMO_TEMPLATES_JSON.read_text("utf-8-sig"))
        hero_index = _index_by_names(heroes)
        skill_index = _index_by_names(skills)
        formations = []
        errors = []

        for formation in payload.get("formations", []):
            source_members = formation.get("members", [])
            if len(source_members) != 3:
                errors.append(f"{formation.get('id')}: expected 3 members, found {len(source_members)}")
                continue

            members = []
            for member in source_members:
                hero_name = member.get("hero_name", "")
                skill1_name = member.get("skill1_name", "")
                skill2_name = member.get("skill2_name", "")
                hero = hero_index.get(_norm_name(hero_name))
                skill1 = skill_index.get(_norm_name(skill1_name))
                skill2 = skill_index.get(_norm_name(skill2_name))
                if not hero:
                    errors.append(f"{formation.get('id')}: hero missing: {hero_name}")
                if not skill1:
                    errors.append(f"{formation.get('id')}: skill missing: {skill1_name}")
                if not skill2:
                    errors.append(f"{formation.get('id')}: skill missing: {skill2_name}")
                if not hero or not skill1 or not skill2:
                    continue

                members.append({
                    # Prefer simulator IDs where available. S3 additions that do
                    # not have one remain resolvable through their Japanese name.
                    "commander_id": hero.get("sim_id") or hero.get("name_jp") or hero.get("name"),
                    "skill1_id": skill1.get("sim_id") or skill1.get("name_jp") or skill1.get("name"),
                    "skill2_id": skill2.get("sim_id") or skill2.get("name_jp") or skill2.get("name"),
                    "troops": 10000,
                    "breakthrough": "5",
                    "stat_focus": member.get("stat_focus", ""),
                    "bingxue": member.get("bingxue"),
                })

            if len(members) == 3:
                formations.append({
                    "id": formation.get("id"),
                    "name": formation.get("name"),
                    "source_url": payload.get("source_url"),
                    "tier": formation.get("tier"),
                    "faction": formation.get("faction"),
                    "troop_types": formation.get("troop_types", []),
                    "members": members,
                })

        if errors:
            details = "\n  - ".join(errors[:30])
            remainder = f"\n  ... and {len(errors) - 30} more" if len(errors) > 30 else ""
            raise RuntimeError(f"S3 template validation failed:\n  - {details}{remainder}")
        return formations

    # Keep the simulator snapshot as a fallback for older checkouts that do not
    # yet contain the normalized Codomo template catalog.
    data = _load_shinsen_sim_data()
    formations = []
    for formation in data.get("enemyFormations", []) if data else []:
        formations.append({
            "id": formation.get("id"),
            "name": formation.get("name"),
            "members": [
                {
                    "commander_id": member.get("commanderId"),
                    "skill1_id": member.get("selectedTactic1Id"),
                    "skill2_id": member.get("selectedTactic2Id"),
                    "troops": member.get("troops", 10000),
                    "breakthrough": member.get("breakthroughLevel", "0"),
                }
                for member in formation.get("members", [])
            ],
        })
    return formations


def _merge_game8_skill_index(skills: list[dict]) -> tuple[list[dict], int]:
    if not GAME8_SKILLS_INDEX_JSON.exists():
        return skills, 0
    try:
        rows = json.loads(GAME8_SKILLS_INDEX_JSON.read_text("utf-8-sig"))
    except Exception as exc:
        print(f"[warn] failed to load {GAME8_SKILLS_INDEX_JSON}: {exc}")
        return skills, 0
    by_name = _index_by_names(skills)
    merged = 0
    for row in rows:
        skill = by_name.get(_norm_name(row.get("name")))
        if not skill:
            continue
        if row.get("description"):
            skill["description_jp"] = row["description"]
            skill["brief_description_jp"] = row["description"].split("。", 1)[0][:80]
        if row.get("activation_rate"):
            skill["activation_rate"] = row["activation_rate"]
        if row.get("category"):
            skill["category_jp"] = row["category"]
        if row.get("kind"):
            skill["game8_kind"] = row["kind"]
        if row.get("source_url"):
            skill["game8_source_url"] = row["source_url"]
        merged += 1
    return skills, merged

MANUAL_SKILL_JA_TEXT = {
    "如水": {
        "name_jp": "如水",
    },
    "疾風迅雷": {
        "description_jp": (
            "戦闘中、{var:trigger_chance}{scale:武勇}の確率で敵軍集団"
            "（{var:target_count}人）にそれぞれ兵刃ダメージ"
            "（ダメージ率{var:damage_rate}）を与え、"
            "{var:status_chance}{scale:武勇}の確率で対象を"
            "{var:status_duration}ターン持続の{status:麻痺}状態にする。"
            "対象が{status:麻痺}状態の場合、自軍単体の兵力を回復する"
            "（回復率{var:heal_rate}{scale:武勇}）。"
        ),
        "commander_description_jp": (
            "対象が{status:麻痺}状態の場合、{var:extra_trigger_chance}"
            "{scale:武勇}の確率で敵軍単体に追加で{var:extra_trigger_count}回"
            "この戦法を発動する。重複して発動しない。"
        ),
        "brief_description_jp": "敵軍集団に兵刃ダメージを与えて麻痺を付与し、自軍兵力を回復する",
    },
    "弾嵐雨霰": {
        "description_jp": (
            "敵軍単体に{var:hits_min}-{var:hits_max}回の兵刃ダメージ"
            "（ダメージ率{var:damage_rate}）を与え、{var:status_chance}の確率で"
            "{status:無策}または{status:封撃}を付与する。すでに付与されていない状態を優先し、"
            "{var:duration}ターン持続する。対象が継続性の弱体状態の場合、付与確率が"
            "{var:extra_chance}上昇する。発動後、{var:cooldown}ターンの冷却に入る。"
        ),
        "commander_description_jp": (
            "{var:commander_hits}回攻撃になる確率が{var:commander_hits_chance}まで上昇する。"
        ),
        "brief_description_jp": "敵単体に複数回の兵刃ダメージを与え、無策または封撃を付与する",
    },
    "三河武士": {
        "description_jp": (
            "足軽を忠勇に優れた三河武士へ進階させる。戦闘中、自軍全体の統率が"
            "{var:stat_buff}上昇する。自軍全体が通常攻撃を累計3回受けると"
            "（発動するたびに必要回数+1）、次ターン開始時に不屈を1回発動し、"
            "自軍全体の兵力を回復する（回復率{var:recovery_rate}{scale:統率}）。"
            "4回目の不屈発動時は、自軍各武将がランダムな敵軍単体にダメージ"
            "（ダメージ率{var:damage_rate}、武勇と智略の高い方で種類決定）を与え、以後不屈は発動しない。"
            "徳川家康が統率する場合、統率上昇値は追加で自身の統率の影響を受ける。"
        ),
        "brief_description_jp": "足軽を進階し、統率上昇・全体回復・終盤の追加ダメージを得る",
    },
    "豊後の戦神": {
        "description_jp": (
            "戦闘中、自身が洞察状態を獲得し、自身の最も高い属性に応じて強化を得る"
            "（その属性の影響を受ける）。武勇が最も高い場合は兵刃与ダメージが{1%}上昇、"
            "智略が最も高い場合は計略与ダメージが{2%}上昇、統率が最も高い場合は"
            "自身の能動戦法発動確率が{3%}上昇する。"
        ),
        "commander_description_jp": "自身の主属性が{4}上昇する。",
        "brief_description_jp": "洞察を獲得し、最高属性に応じて火力または発動率を強化する",
    },
    "斬り": {
        "description_jp": "敵軍単体に兵刃ダメージ（ダメージ率{1%}）を与える。",
        "brief_description_jp": "敵単体に兵刃ダメージを与える",
    },
    "会話": {
        "description_jp": "自軍単体を3ターンの間、混乱無効にする。",
        "brief_description_jp": "自軍単体に混乱耐性を付与する",
    },
    "士気高揚": {
        "description_jp": "自軍単体はこのターン、洞察状態を獲得し、すべての制御効果を無効化する。",
        "brief_description_jp": "自軍単体に洞察を付与する",
    },
    "初級鼓舞": {
        "description_jp": "自軍単体の武勇が{1}上昇する。2ターン持続。",
        "brief_description_jp": "自軍単体の武勇を上げる",
    },
    "初期激昂": {
        "description_jp": "自軍単体の速度が{1}上昇する。2ターン持続。",
        "brief_description_jp": "自軍単体の速度を上げる",
    },
    "初級圧制": {
        "description_jp": "敵軍単体の統率が{1}低下する。2ターン持続。",
        "brief_description_jp": "敵単体の統率を下げる",
    },
    "初級撹乱": {
        "description_jp": "敵軍単体の速度が{1}低下する。2ターン持続。",
        "brief_description_jp": "敵単体の速度を下げる",
    },
    "初級治療": {
        "description_jp": (
            "自軍単体に回生状態を付与する。ダメージを受けるたびに{1%}の確率で"
            "一定兵力を回復する（治療率{2%}、智略依存）。2ターン持続。"
        ),
        "brief_description_jp": "自軍単体に回生を付与する",
    },
    "勇武": {
        "description_jp": "自身の武勇が{1}上昇する。",
        "brief_description_jp": "自身の武勇を上げる",
    },
    "固陣": {
        "description_jp": "自身の統率が{1}上昇する。",
        "brief_description_jp": "自身の統率を上げる",
    },
}

# cfg.tips / short_tips / target_tips wrap highlighted spans in
# <font color='...'>...</font>. The frontend renders text content (not HTML),
# so tags surface as literal characters in brief descriptions. Strip at the
# cfg-read boundary; mirrors the same helper in merge_sources.py.
_FONT_TAG_RE = re.compile(r"</?font[^>]*>", re.IGNORECASE)


def _strip_font_tags(text):
    if not text:
        return text
    return _FONT_TAG_RE.sub("", text)


def _load_cfg_lookups() -> tuple[dict, dict]:
    """Single cfg.json read → (skill_by_hant, hero_by_hant).

    Both lookups are zh-hant-keyed projections of cfg.json, used so
    override-added entries (which bypass the prototype path) can still
    resolve cfg fields by their CHT key. This re-parses cfg.json because
    `data/prototype/*_proto.yaml` is game8-bounded — entries that exist
    only on the cfg side (e.g. heroes/skills not yet on game8.jp) never
    reach the prototype layer, so the lookup must come from cfg directly.
    """
    if not CFG_CURRENT_JSON.exists():
        return {}, {}
    cfg = json.loads(CFG_CURRENT_JSON.read_text("utf-8"))
    ml = cfg.get("multi_lang", [])
    by_hans = {e["zh-hans"]: e for e in ml if e.get("zh-hans")}
    skill_by_name = {s["name"]: s for s in cfg.get("skill", []) if s.get("name")}
    hero_by_name = {h["name"]: h for h in cfg.get("hero", []) if h.get("name")}

    def hant_of(hans):
        if not hans:
            return None
        e = by_hans.get(hans) or {}
        return e.get("zh-hant") or opencc_s2tw(hans)

    skill_out: dict = {}
    hero_out: dict = {}
    for entry in ml:
        hant = entry.get("zh-hant")
        if not hant:
            continue
        ml_id = entry.get("id")
        ja = entry.get("ja")

        cfg_skill = skill_by_name.get(ml_id)
        if cfg_skill:
            skill_out[hant] = {
                "id": cfg_skill.get("id"),
                "name_ja": ja,
                "skill_kind": cfg_skill.get("skill_kind"),
                "short_tips_ja": _strip_font_tags(cfg_skill.get("short_tips") or ""),
                "target_tips_ja": _strip_font_tags(cfg_skill.get("target_tips") or ""),
                "short_tips_zh_hant": _strip_font_tags(hant_of(cfg_skill.get("short_tips"))),
                "target_tips_zh_hant": _strip_font_tags(hant_of(cfg_skill.get("target_tips"))),
            }

        cfg_hero = hero_by_name.get(ml_id)
        if cfg_hero:
            hero_out[hant] = {
                "id": cfg_hero.get("id"),
                "name_ja": ja,
                "camp_zh_hant": hant_of(cfg_hero.get("camp")),
                "family_zh_hant": hant_of(cfg_hero.get("family")),
                "cost": cfg_hero.get("cost"),
                "star": cfg_hero.get("star"),
                "born_skill_zh_hant": hant_of(cfg_hero.get("born_skill")),
            }

    return skill_out, hero_out


def _cfg_asset_url(cfg: dict, path: str | None) -> str:
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    version = cfg.get("version") or ""
    return (
        "https://p11386-media-cdn.sialiagames.com.tw/"
        f"meta_10000270/{version}/{path}"
        "?x-oss-process=image/format,webp/interlace,1/quality,Q_80/resize,w_256&t=1"
    )


def _cfg_localizers(cfg: dict):
    by_id = {e.get("id"): e for e in cfg.get("multi_lang", []) if e.get("id")}
    by_hans = {e.get("zh-hans"): e for e in cfg.get("multi_lang", []) if e.get("zh-hans")}

    def entry_for(text: str | None) -> dict:
        if not text:
            return {}
        return by_id.get(text) or by_hans.get(text) or {}

    def name_hant(text: str | None) -> str:
        if not text:
            return ""
        e = entry_for(text)
        return e.get("zh-hant") or opencc_s2tw(text) or text

    def name_ja(text: str | None) -> str | None:
        if not text:
            return None
        e = entry_for(text)
        return e.get("ja") or None

    def text_hant(text: str | None) -> str:
        if not text:
            return ""
        clean = _strip_font_tags(text)
        e = by_hans.get(clean) or by_id.get(clean) or {}
        return e.get("zh-hant") or opencc_s2tw(clean) or clean

    return name_hant, name_ja, text_hant


def _skill_rarity_from_grade(grade) -> str:
    try:
        g = int(grade)
    except (TypeError, ValueError):
        return ""
    if g >= 5:
        return "S"
    if g == 4:
        return "A"
    if g == 3:
        return "B"
    return "C"


def _append_cfg_supplements(heroes: list[dict], skills: list[dict]) -> tuple[list[dict], list[dict]]:
    """Append cfg-only heroes and user-selectable skills not already covered.

    Existing game8/override entries keep priority because they usually carry
    better stats, traits, battle formulas, and JP descriptions.
    """
    if not CFG_CURRENT_JSON.exists():
        return heroes, skills

    cfg = json.loads(CFG_CURRENT_JSON.read_text("utf-8"))
    name_hant, name_ja, text_hant = _cfg_localizers(cfg)

    hero_name_by_born_skill: dict[str, str] = {}
    for h in cfg.get("hero", []):
        born = h.get("born_skill")
        if born and born not in hero_name_by_born_skill:
            hero_name_by_born_skill[born] = name_hant(h.get("name"))

    existing_skill_keys = set()
    for s in skills:
        existing_skill_keys.update(
            str(v) for v in (s.get("cfg_id"), s.get("name"), s.get("name_jp")) if v
        )

    for s in cfg.get("skill", []):
        if s.get("skill_kind") not in CFG_SELECTABLE_SKILL_KINDS:
            continue
        name = name_hant(s.get("name"))
        jp_name = name_ja(s.get("name"))
        keys = {str(v) for v in (s.get("id"), name, jp_name, s.get("name")) if v}
        if existing_skill_keys.intersection(keys):
            continue

        kind = s.get("skill_kind") or ""
        unique_hero = hero_name_by_born_skill.get(s.get("name"), "")
        skill_entry = {
            "name": name,
            "name_jp": jp_name,
            "type": ZH_HANS_TO_HANT_TYPE.get(kind, opencc_s2tw(kind) or kind),
            "rarity": _skill_rarity_from_grade(s.get("grade")),
            "target": text_hant(s.get("target_tips")),
            "activation_rate": "",
            "description": text_hant(s.get("tips")),
            "description_jp": "",
            "commander_description": "",
            "commander_description_jp": "",
            "vars": {},
            "source_hero": "",
            "unique_hero": unique_hero,
            "is_unique": bool(unique_hero),
            "is_teachable": False,
            "is_fixed": bool(unique_hero),
            "icon": _cfg_asset_url(cfg, s.get("icon")),
            "tags": [text_hant(x) for x in (s.get("effect_type_list") or [])],
            "brief_description": text_hant(s.get("short_tips")),
            "brief_description_jp": "",
            "cfg_id": s.get("id"),
        }
        skills.append(skill_entry)
        existing_skill_keys.update(keys)

    skill_name_by_hans = {
        s.get("name"): name_hant(s.get("name"))
        for s in cfg.get("skill", [])
        if s.get("name")
    }
    existing_hero_keys = set()
    for h in heroes:
        existing_hero_keys.update(
            str(v) for v in (h.get("cfg_id"), h.get("name"), h.get("name_jp")) if v
        )

    for h in cfg.get("hero", []):
        name = name_hant(h.get("name"))
        jp_name = name_ja(h.get("name"))
        keys = {str(v) for v in (h.get("id"), name, jp_name, h.get("name")) if v}
        if existing_hero_keys.intersection(keys):
            continue
        born_skill = h.get("born_skill")
        heroes.append({
            "name": name,
            "name_jp": jp_name,
            "rarity": h.get("star") or 0,
            "cost": h.get("cost") or 0,
            "faction": name_hant(h.get("camp")),
            "clan": name_hant(h.get("family")),
            "gender": "",
            "portrait": _cfg_asset_url(cfg, h.get("icon")),
            "detail_url": "",
            "unique_skill": skill_name_by_hans.get(born_skill, name_hant(born_skill)),
            "teachable_skill": "",
            "assembly_skill": "",
            "stats": dict(CFG_DEFAULT_STATS),
            "traits": [],
            "bingxue": None,
            "cfg_id": h.get("id"),
        })
        existing_hero_keys.update(keys)

    return heroes, skills


def _cfg_fields_for_skill_override(key: str, lookup: dict) -> dict:
    """Override-shaped projection of the cfg skill block keyed by zh-hant."""
    block = lookup.get(key)
    if not block:
        return {}
    out: dict = {}
    if block.get("short_tips_zh_hant"):
        out["brief_description"] = block["short_tips_zh_hant"]
    if block.get("short_tips_ja"):
        out["brief_description_jp"] = block["short_tips_ja"]
    if block.get("target_tips_zh_hant"):
        out["target"] = block["target_tips_zh_hant"]
    if block.get("target_tips_ja"):
        out["target_jp"] = block["target_tips_ja"]
    kind_hans = block.get("skill_kind")
    if kind_hans in ZH_HANS_TO_HANT_TYPE:
        out["type"] = ZH_HANS_TO_HANT_TYPE[kind_hans]
    if block.get("id") is not None:
        out["cfg_id"] = block["id"]
    if block.get("name_ja"):
        out["name_jp"] = block["name_ja"]
    return out


def _cfg_fields_for_hero_override(key: str, lookup: dict) -> dict:
    block = lookup.get(key)
    if not block:
        return {}
    out: dict = {}
    if block.get("camp_zh_hant"):
        out["faction"] = block["camp_zh_hant"]
    if block.get("family_zh_hant"):
        out["clan"] = block["family_zh_hant"]
    if block.get("cost") is not None:
        out["cost"] = block["cost"]
    if block.get("star") is not None:
        out["rarity"] = block["star"]
    if block.get("born_skill_zh_hant"):
        out["unique_skill"] = block["born_skill_zh_hant"]
    if block.get("id") is not None:
        out["cfg_id"] = block["id"]
    if block.get("name_ja"):
        out["name_jp"] = block["name_ja"]
    return out


def _classify_add_overrides(
    overrides_section: dict,
    cfg_lookup: dict,
    g8_jp_keys: set,
) -> dict:
    """Bucket `_action: add` overrides by data-source coverage.

    Lifecycle of an override-added entry (TW server runs ahead of JP, so
    new heroes/skills land in override first via OCR → override.py):

      pre_launch  — neither cfg nor game8 know about it yet; override is
                    the only source.
      cfg_only    — cfg has identity + zh-hant metadata, game8 doesn't yet;
                    override fields cfg covers can be trimmed.
      cfg_and_g8  — both upstream sources have it; the entire override
                    entry can usually be deleted (or downgraded to modify
                    if a specific field still needs project-specific tweaks).
    """
    out = {"pre_launch": [], "cfg_only": [], "cfg_and_g8": []}
    for key, ov in (overrides_section or {}).items():
        if not isinstance(ov, dict) or ov.get("_action") != "add":
            continue
        cfg_block = cfg_lookup.get(key)
        if not cfg_block:
            out["pre_launch"].append(key)
            continue
        ja = cfg_block.get("name_ja")
        if ja and ja in g8_jp_keys:
            out["cfg_and_g8"].append(key)
        else:
            out["cfg_only"].append(key)
    return out


def _print_coverage_hint(scope: str, cls: dict) -> None:
    total = sum(len(v) for v in cls.values())
    if not total:
        return
    print(f"[info] override-added {scope} lifecycle ({total} entries):")
    bucket_msg = [
        ("cfg_and_g8", "in cfg + in game8 → override entry likely removable"),
        ("cfg_only",   "in cfg only       → cfg-covered fields can be trimmed"),
        ("pre_launch", "pre-launch        → override is the only source"),
    ]
    for k, msg in bucket_msg:
        items = cls[k]
        if not items:
            continue
        sample = ", ".join(items[:5])
        more = f" (+ {len(items) - 5} more)" if len(items) > 5 else ""
        print(f"  {len(items):>3}  {msg}: {sample}{more}")


def _detect_override_cfg_conflicts(overrides_dict: dict, cfg_fields_fn) -> list[dict]:
    """Detect conflicts where the override AND cfg both define a field with
    differing values. Read-only — does NOT mutate the override dict.

    The cfg-fill itself happens in `apply_skill_overrides` / `apply_hero_overrides`
    on the per-entry `clean` dict (not on the user's YAML data), so override
    structure stays a clean snapshot of user intent.

    Conflicts are reported, never auto-resolved: the warning often means the
    override predates the official cfg release and may now be redundant.
    """
    conflicts: list[dict] = []
    for key, ov in (overrides_dict or {}).items():
        if not isinstance(ov, dict):
            continue
        if ov.get("_action") == "delete":
            continue
        cfg_fields = cfg_fields_fn(key)
        if not cfg_fields:
            continue
        for field, cfg_val in cfg_fields.items():
            ov_val = ov.get(field)
            if ov_val is not None and ov_val != cfg_val:
                conflicts.append({
                    "key": key,
                    "field": field,
                    "override": ov_val,
                    "cfg": cfg_val,
                })
    return conflicts

# LLM skill name corrections (wrong CHT → correct CHT). Active only when
# CFG_AUTHORITATIVE=0 (rollback path); cfg.json supplies these names directly
# in the default cfg-on path. Phase 5 retires these alongside the flag.
SKILL_NAME_FIXES = {
    "血戰奮鬥": "浴血奮戰",
    "所向無敵": "所向披靡",
    "歸還的凱歌": "振旅凱歌",
}

# LLM alias → spec canonical name
STATUS_ALIASES = {
    "震懾": "威壓", "恐慌": "混亂", "攪亂": "混亂",
    "嘲諷": "挑釁", "挑撥": "挑釁",
    "繳械": "封擊", "計窮": "無策",
    "潰逃": "潰走", "消沈": "消沉",
    "回避": "閃避", "回生": "休養",
    "心攻": "攻心", "奇策": "奇謀",
    "反擊": "連擊",
}


def _load_prototype(name: str) -> dict:
    """Load data/prototype/{name}_proto.yaml. Empty dict if missing."""
    path = PROTOTYPE_DIR / f"{name}_proto.yaml"
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text("utf-8")) or {}


def _index_proto_skills_by_jp(proto: dict) -> dict:
    """Return {jp_key: proto_entry} keyed on BOTH the effective and the
    pre-rename JP name. Lets canonical lookups (which use the original
    game8 key) find a renamed prototype entry without a separate map.
    """
    out = {}
    for eff_jp, p in proto.items():
        out[eff_jp] = p
        sc = p.get("source_correction_applied") or {}
        renamed_from = sc.get("renamed_from")
        if renamed_from:
            out[renamed_from] = p
    return out


def _build_skill_name_map(skills_data: dict, proto_by_jp: dict) -> dict:
    """JP key (orig and corrected) → CHT name. Used to translate hero
    unique_skill / teachable_skill text refs."""
    name_map = {
        jp_key: entry.get("text", {}).get("name", jp_key)
        for jp_key, entry in skills_data.items()
    }
    if CFG_AUTHORITATIVE:
        for eff_jp, p in proto_by_jp.items():
            cfg_name = (p.get("cfg") or {}).get("name_zh_hant")
            if cfg_name:
                name_map[eff_jp] = cfg_name
    return name_map


def deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge override into base. Override values win."""
    result = base.copy()
    for k, v in override.items():
        if k.startswith("_"):
            continue
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = deep_merge(result[k], v)
        else:
            result[k] = v
    return result


def _normalize_replaces(replaces) -> list[str]:
    """`_replaces` may be a single str (legacy) or a list. Always return a
    deduplicated list preserving order."""
    if not replaces:
        return []
    items = [replaces] if isinstance(replaces, str) else list(replaces)
    return list(dict.fromkeys(items))




def _skill_stub_defaults(clean: dict) -> dict:
    """Fill in default fields for an added/replaced skill entry."""
    # name_jp = None for override-added skills means "no JP source key" — the
    # frontend's CHT⇄JP fallback (`?? cht`, `s.name === key`) only fires on
    # nullish, so emitting "" would defeat both legs and write empty keys to
    # user profiles. None is the honest "absent" sentinel.
    clean.setdefault("name_jp", None)
    clean.setdefault("vars", {})
    clean.setdefault("commander_description", "")
    clean.setdefault("source_hero", "")
    clean.setdefault("unique_hero", "")
    clean.setdefault("is_unique", bool(clean.get("unique_hero")))
    # Teachable only if explicitly has source_hero or is_teachable set
    clean.setdefault("is_teachable", bool(clean.get("source_hero")))
    clean.setdefault("is_fixed", clean.get("is_unique", False) and not clean.get("is_teachable", False))
    clean.setdefault("icon", "")
    clean.setdefault("tags", [])
    clean.setdefault("brief_description", "")
    return clean


def _apply_overrides(
    items: list[dict],
    overrides: dict,
    stub_defaults_fn,
    cfg_fields_fn=None,
) -> list[dict]:
    """Generic override applier shared by skills and heroes.

    Supported actions:
      - `modify` (default): deep-merge into existing item matched by dict key
      - `add`: append new item. Auto-dedups via legacy `_replaces` field.
      - `replace`: drop existing item matched by dict key, then append.
      - `delete`: remove existing item matched by dict key.

    `stub_defaults_fn(clean, key)` fills in default fields for added entries.
    `cfg_fields_fn(key)` (optional) fills missing fields from cfg on add/replace.
    """
    name_index = {it["name"]: i for i, it in enumerate(items)}
    jp_index = {it.get("name_jp"): i for i, it in enumerate(items) if it.get("name_jp")}

    def _find(key: str) -> int | None:
        idx = name_index.get(key)
        return jp_index.get(key) if idx is None else idx

    def _drop(victim_key: str):
        idx = _find(victim_key)
        if idx is not None and items[idx] is not None:
            items[idx] = None

    def _build_new(key: str, ov: dict) -> dict:
        aliases = _normalize_replaces(ov.get("_replaces"))
        for old in aliases:
            _drop(old)
        clean = {k: v for k, v in ov.items() if not k.startswith("_")}
        if aliases:
            clean["aliases"] = aliases
        if cfg_fields_fn:
            for field, cfg_val in (cfg_fields_fn(key) or {}).items():
                clean.setdefault(field, cfg_val)
        return stub_defaults_fn(clean, key)

    for key, ov in overrides.items():
        action = ov.get("_action", "modify")
        if action == "delete":
            _drop(key)
        elif action == "replace":
            _drop(key)
            items.append(_build_new(key, ov))
        elif action == "add":
            # Only honor explicit _replaces. Duplicate-name detection is
            # check_build.py's job — silently dropping a same-named existing
            # entry here would mask typos.
            items.append(_build_new(key, ov))
        else:  # modify: deep merge into existing item
            idx = _find(key)
            if idx is not None:
                clean = {k: v for k, v in ov.items() if not k.startswith("_")}
                items[idx] = deep_merge(items[idx], clean)

    return [it for it in items if it is not None]


def apply_skill_overrides(
    skills: list[dict], overrides: dict, cfg_fields_fn=None,
) -> list[dict]:
    return _apply_overrides(
        skills, overrides,
        stub_defaults_fn=lambda clean, _key: _skill_stub_defaults(clean),
        cfg_fields_fn=cfg_fields_fn,
    )


def _hero_stub_defaults(clean: dict, key: str) -> dict:
    """Fill in default fields for an added/replaced hero entry."""
    clean.setdefault("name", key)
    clean.setdefault("rarity", 5)
    clean.setdefault("cost", 0)
    clean.setdefault("faction", "")
    clean.setdefault("clan", "")
    clean.setdefault("gender", "")
    clean.setdefault("portrait", "")
    clean.setdefault("detail_url", "")
    clean.setdefault("unique_skill", "")
    clean.setdefault("teachable_skill", "")
    clean.setdefault("assembly_skill", "")
    clean.setdefault("stats", {})
    clean.setdefault("traits", [])
    return clean


def apply_hero_overrides(
    heroes: list[dict], overrides: dict, cfg_fields_fn=None,
) -> list[dict]:
    return _apply_overrides(
        heroes, overrides,
        stub_defaults_fn=_hero_stub_defaults,
        cfg_fields_fn=cfg_fields_fn,
    )


def ensure_str(val) -> str:
    """Ensure a value is a string. Converts floats < 1 to percentage."""
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, float) and 0 < val < 1:
        return f"{val * 100:.0f}%"
    return str(val).strip() if val is not None else ""



SCALE_ALIASES = {
    "知略": "智略",
    "intellect": "智略",
    "intelligence": "智略",
    "command": "統率",
    "valor": "武勇",
    "speed": "速度",
    "charm": "魅力",
    "politics": "政務",
}


def normalize_status_refs(text: str) -> str:
    """Replace {status:alias} with {status:canonical} and {scale:alias} with {scale:canonical}."""
    def replace_status(m):
        name = m.group(1)
        canonical = STATUS_ALIASES.get(name, name)
        return f"{{status:{canonical}}}"
    def replace_scale(m):
        name = m.group(1)
        canonical = SCALE_ALIASES.get(name, name)
        return f"{{scale:{canonical}}}"
    text = re.sub(r"\{status:([^}]+)\}", replace_status, text)
    text = re.sub(r"\{scale:([^}]+)\}", replace_scale, text)
    # Fix LLM producing {var:name:%} → {var:name}%
    text = re.sub(r"\{var:(\w+):%\}", r"{var:\1}%", text)
    # Fix LLM wrapping {scale:} with redundant 受...影響
    text = re.sub(r"受\{scale:([^}]+)\}影響", r"{scale:\1}", text)
    # Also fix plain-text occurrences of known aliases
    text = text.replace("知略", "智略")
    text = text.replace("計略傷害", "謀略傷害")
    return text

def normalize_vars(vars_dict: dict) -> dict:
    """Fix scale aliases in vars (e.g., 知略 → 智略)."""
    out = {}
    for k, v in vars_dict.items():
        if isinstance(v, dict) and "scale" in v:
            scale = v["scale"]
            if isinstance(scale, list):
                scale = "/".join(str(s) for s in scale)
            scale = SCALE_ALIASES.get(scale, scale)
            v = {**v, "scale": scale}
        out[k] = v
    return out


# ---------------------------------------------------------------------------
# Post-processing: normalize all text and type issues in final output
# ---------------------------------------------------------------------------

def fix_skill_name(name: str) -> str:
    return SKILL_NAME_FIXES.get(name, name)


VALID_SKILL_TYPES = {"被動", "主動", "指揮", "突擊", "兵種", "陣法"}


def normalize_skill_type(t: str) -> str:
    if t in VALID_SKILL_TYPES:
        return t
    cleaned = t.replace("戰法", "").replace("战法", "").strip()
    return cleaned if cleaned in VALID_SKILL_TYPES else t


def postprocess_skill(skill: dict) -> dict:
    """Normalize a single skill entry after all merges/overrides."""
    skill["name"] = fix_skill_name(skill.get("name", ""))
    manual_ja = MANUAL_SKILL_JA_TEXT.get(skill.get("name_jp")) or MANUAL_SKILL_JA_TEXT.get(skill.get("name"))
    if manual_ja:
        for field, value in manual_ja.items():
            skill[field] = value
    skill["is_event_skill"] = bool(skill.get("is_event_skill", False))
    if skill.get("type"):
        skill["type"] = normalize_skill_type(skill["type"])
    for field in ("description", "commander_description"):
        if skill.get(field):
            skill[field] = normalize_status_refs(skill[field])
    if "activation_rate" in skill:
        skill["activation_rate"] = ensure_str(skill["activation_rate"])
    if skill.get("vars"):
        skill["vars"] = normalize_vars(skill["vars"])
    return skill


def postprocess_hero(hero: dict) -> dict:
    """Normalize a single hero entry after all merges/overrides."""
    # Fix skill name references on heroes
    for field in ("unique_skill", "teachable_skill"):
        if hero.get(field):
            hero[field] = fix_skill_name(hero[field])
    for t in hero.get("traits") or []:
        if t.get("description"):
            t["description"] = normalize_status_refs(t["description"])
        if t.get("vars"):
            t["vars"] = normalize_vars(t["vars"])
        # Re-derive rank from name so overrides without an explicit rank get tiered too.
        # Overrides that explicitly set "rank" still win (deep_merge already applied).
        if not t.get("rank"):
            t["rank"] = infer_trait_rank(t.get("name") or t.get("name_jp", ""))
    return hero


def postprocess(heroes: list[dict], skills: list[dict]) -> tuple[list[dict], list[dict]]:
    """Run all post-processing on final heroes and skills lists."""
    skills = [postprocess_skill(s) for s in skills]
    heroes = [postprocess_hero(h) for h in heroes]
    heroes.sort(key=lambda h: (-h.get("rarity", 0), -h.get("cost", 0)))
    return heroes, skills


def infer_trait_rank(name: str) -> str:
    """Rule-based tier from trait name suffix:
    III → A, II → B, I → C, anything else → S.
    Match the longest suffix first to avoid 'III' matching as 'I'.
    """
    if not name:
        return "S"
    n = name.rstrip()
    for suffix, rank in (("III", "A"), ("Ⅲ", "A"),
                         ("II", "B"),  ("Ⅱ", "B"),
                         ("I", "C"),   ("Ⅰ", "C")):
        if n.endswith(suffix):
            return rank
    return "S"


def _flatten_trait(jp_name: str, tr: dict) -> dict:
    """Flatten a canonical or legacy trait entry into the frontend JSON shape."""
    # Canonical shape has text/vars/kind/passive sub-keys
    if "text" in tr:
        text = tr["text"]
        cht_name = text.get("name", jp_name)
        desc = text.get("description", "")
        raw = tr.get("raw") or {}
        desc_jp = (
            raw.get("description")
            or raw.get("effect")
            or tr.get("description_jp")
            or text.get("description_jp")
            or ""
        )
        vars_dict = tr.get("vars", {})
    else:
        # Legacy shape (traits_translated): flat name/description/vars
        cht_name = tr.get("name", jp_name)
        desc = tr.get("description", "")
        desc_jp = tr.get("description_jp", "")
        vars_dict = tr.get("vars", {})

    rank = infer_trait_rank(cht_name) if cht_name != jp_name else infer_trait_rank(jp_name)

    result = {
        "name": cht_name,
        "name_jp": jp_name,
        "description": desc,
        "description_jp": desc_jp,
        "vars": vars_dict,
        "rank": rank,
        "active": True,
    }

    # Carry affinity info through to frontend for useTroopLevels
    passive = tr.get("passive")
    if isinstance(passive, dict) and passive.get("affinity"):
        result["affinity"] = passive["affinity"]

    return result


def build_heroes(
    heroes_raw: list[dict],
    traits_data: dict,
    skill_name_map: dict,
    heroes_translated: dict,
    proto_heroes: dict | None = None,
    drift_log: list | None = None,
) -> list[dict]:
    """traits_data: JP name → trait entry (canonical or legacy shape).
    skill_name_map: JP name → CHT name for skill reference translation.
    heroes_translated: JP name → {name, faction, clan} CHT mapping.
    proto_heroes: JP name → prototype entry (for CFG_AUTHORITATIVE path).
    drift_log: optional sink for game8/cfg cost+rarity disagreements.
    """
    proto_heroes = proto_heroes or {}
    out = []
    for h in heroes_raw:
        jp = h["name"]
        traits = []
        for t in h.get("traits") or []:
            jp_name = t["name"]
            tr = traits_data.get(jp_name, {})
            traits.append(_flatten_trait(jp_name, tr))

        ht = heroes_translated.get(jp, {})
        cfg = (proto_heroes.get(jp) or {}).get("cfg") or {}

        name = ht.get("name", jp)
        faction = ht.get("faction", h.get("faction", ""))
        clan = ht.get("clan", h.get("clan", ""))
        cost = int(h.get("cost", 0))
        rarity = int(h.get("rarity", 0))

        if CFG_AUTHORITATIVE and cfg:
            if cfg.get("name_zh_hant"):
                name = cfg["name_zh_hant"]
            if cfg.get("camp_zh_hant"):
                faction = cfg["camp_zh_hant"]
            if cfg.get("family_zh_hant"):
                clan = cfg["family_zh_hant"]
            if cfg.get("cost") is not None and cfg["cost"] != cost:
                if drift_log is not None:
                    drift_log.append({"hero": jp, "field": "cost", "game8": cost, "cfg": cfg["cost"]})
                cost = cfg["cost"]
            if cfg.get("star") is not None and cfg["star"] != rarity:
                if drift_log is not None:
                    drift_log.append({"hero": jp, "field": "rarity", "game8": rarity, "cfg": cfg["star"]})
                rarity = cfg["star"]

        entry = {
            "name": name,
            "name_jp": jp,
            "rarity": rarity,
            "cost": cost,
            "faction": faction,
            "clan": clan,
            "gender": h.get("gender", ""),
            "portrait": h.get("portrait", ""),
            "detail_url": h.get("detail_url", ""),
            "unique_skill": skill_name_map.get(h.get("unique_skill"), h.get("unique_skill")),
            "teachable_skill": skill_name_map.get(h.get("teachable_skill"), h.get("teachable_skill")),
            "assembly_skill": h.get("assembly_skill"),
            "stats": h.get("stats", {}),
            "traits": traits,
            "bingxue": h.get("bingxue"),  # JP-direction-keyed; re-keyed to CHT in main()
        }
        if CFG_AUTHORITATIVE and cfg.get("id") is not None:
            entry["cfg_id"] = cfg["id"]
        out.append(entry)
    return out


def split_commander_description(desc: str) -> tuple[str, str]:
    # Match patterns: 大將技：, 大將技:, 【大將技】
    m = re.search(r"[。\n\s]*(?:【大將技】|大將技[：:])\s*", desc)
    if m:
        main = desc[:m.start()].rstrip()
        commander = desc[m.end():].rstrip(" 。\n")
        return main, commander
    return desc, ""


def _extract_commander_desc(tr: dict, battle: dict) -> str:
    """Try multiple sources for commander description."""
    # 1. Explicit field in frontend
    if tr.get("commander_description"):
        return tr["commander_description"]
    # 2. bonus.commander in frontend
    bonus = tr.get("bonus", {})
    if isinstance(bonus, dict):
        cmd = bonus.get("commander", {})
        if isinstance(cmd, dict) and cmd.get("description"):
            return cmd["description"]
    # 3. bonus.commander in battle
    bonus = battle.get("bonus", {})
    if isinstance(bonus, dict):
        cmd = bonus.get("commander", {})
        if isinstance(cmd, dict) and cmd.get("description"):
            return cmd["description"]
    return ""


def build_skills(skills_data: dict, proto_by_jp: dict | None = None) -> list[dict]:
    """Build frontend skill list from canonical data dict.
    Each entry has raw/vars/text/battle sub-keys.
    proto_by_jp: optional {jp_key: proto_entry} keyed on both eff and orig
    JP. When CFG_AUTHORITATIVE, cfg fields override LLM names + metadata."""
    proto_by_jp = proto_by_jp or {}
    out = []

    for key, entry in skills_data.items():
        cr = entry.get("raw", {})
        tr = entry.get("text", {})
        bt = entry.get("battle", {})
        vars_dict = entry.get("vars", {})
        cfg = (proto_by_jp.get(key) or {}).get("cfg") or {}

        tr_desc = (tr.get("description") or "").strip()
        raw_desc = tr_desc or cr.get("description", "")
        description, commander_description = split_commander_description(raw_desc)
        if not commander_description:
            commander_description = _extract_commander_desc(tr, bt)
        raw_jp_desc = (cr.get("description") or "").strip()
        description_jp, commander_description_jp = split_commander_description(raw_jp_desc)
        if not commander_description_jp:
            commander_description_jp = (
                cr.get("commander_description")
                or bt.get("commander_description")
                or ""
            )

        name_cht = tr.get("name") or key
        skill_type = cr.get("type", tr.get("type", ""))
        target = cr.get("target", tr.get("target", ""))
        brief = tr.get("brief_description", "")
        brief_jp = cr.get("brief_description", "")

        if CFG_AUTHORITATIVE and cfg:
            if cfg.get("name_zh_hant"):
                name_cht = cfg["name_zh_hant"]
            if cfg.get("target_tips_zh_hant"):
                target = cfg["target_tips_zh_hant"]
            if cfg.get("short_tips_zh_hant"):
                brief = cfg["short_tips_zh_hant"]
            if cfg.get("short_tips_ja"):
                brief_jp = cfg["short_tips_ja"]
            kind_hans = cfg.get("skill_kind")
            if kind_hans and kind_hans in ZH_HANS_TO_HANT_TYPE:
                skill_type = ZH_HANS_TO_HANT_TYPE[kind_hans]

        is_unique = bool(cr.get("is_unique"))
        source_hero = cr.get("source_hero", "")

        out_entry = {
            "name": name_cht,
            "name_jp": key,
            "type": skill_type,
            "rarity": cr.get("rarity", tr.get("rarity", "")),
            "target": target,
            "activation_rate": cr.get("activation_rate", tr.get("activation_rate", "")),
            "description": description,
            "description_jp": description_jp,
            "commander_description": commander_description,
            "commander_description_jp": commander_description_jp,
            "vars": vars_dict,
            "source_hero": source_hero,
            "unique_hero": source_hero if is_unique else "",
            "is_unique": is_unique,
            "is_teachable": bool(cr.get("is_teachable")),
            "is_fixed": is_unique and not cr.get("is_teachable"),
            "icon": "",
            "tags": tr.get("tags", []),
            "brief_description": brief,
            "brief_description_jp": brief_jp,
        }
        if CFG_AUTHORITATIVE and cfg.get("id") is not None:
            out_entry["cfg_id"] = cfg["id"]
        out.append(out_entry)

    return out


def main():
    heroes_raw = yaml.safe_load(HEROES_CRAWLED.read_text("utf-8"))

    # Load hero name translations (optional)
    heroes_translated = {}
    ht_path = HEROES_TRANSLATED
    if ht_path.exists():
        heroes_translated = yaml.safe_load(ht_path.read_text("utf-8")) or {}

    skills_data = yaml.safe_load(SKILLS_CANONICAL.read_text("utf-8")) or {}
    traits_data = yaml.safe_load(TRAITS_CANONICAL.read_text("utf-8")) or {}

    # Phase 3: when CFG_AUTHORITATIVE=1, prototype's `cfg` block overrides
    # LLM names + metadata. Loaded unconditionally so the off-path is also
    # exercised (and so future flips don't surprise).
    proto_skills = _load_prototype("skills")
    proto_skills_by_jp = _index_proto_skills_by_jp(proto_skills)
    proto_heroes = _load_prototype("heroes")

    skill_name_map = _build_skill_name_map(skills_data, proto_skills_by_jp)
    drift_log: list = []

    heroes = build_heroes(
        heroes_raw, traits_data, skill_name_map, heroes_translated,
        proto_heroes=proto_heroes, drift_log=drift_log,
    )
    skills = build_skills(skills_data, proto_by_jp=proto_skills_by_jp)

    # Apply overrides (highest priority).
    # When CFG_AUTHORITATIVE, fill missing fields on `_action: add` entries
    # from cfg, and surface override↔cfg disagreements for review. Override
    # values still win — cfg only fills via setdefault.
    overrides = load_overrides()
    override_conflicts: list[dict] = []
    skill_classification: dict = {"pre_launch": [], "cfg_only": [], "cfg_and_g8": []}
    hero_classification: dict = {"pre_launch": [], "cfg_only": [], "cfg_and_g8": []}
    skill_cfg_fn = None
    hero_cfg_fn = None
    if CFG_AUTHORITATIVE:
        cfg_skill_lookup, cfg_hero_lookup = _load_cfg_lookups()

        g8_skill_jp_keys = set(proto_skills_by_jp)
        g8_hero_jp_keys = {h.get("name") for h in heroes_raw if h.get("name")}
        skill_classification = _classify_add_overrides(
            overrides.get("skills", {}), cfg_skill_lookup, g8_skill_jp_keys,
        )
        hero_classification = _classify_add_overrides(
            overrides.get("heroes", {}), cfg_hero_lookup, g8_hero_jp_keys,
        )

        skill_cfg_fn = lambda k: _cfg_fields_for_skill_override(k, cfg_skill_lookup)
        hero_cfg_fn = lambda k: _cfg_fields_for_hero_override(k, cfg_hero_lookup)

        skill_conflicts = _detect_override_cfg_conflicts(
            overrides.get("skills", {}), skill_cfg_fn,
        )
        hero_conflicts = _detect_override_cfg_conflicts(
            overrides.get("heroes", {}), hero_cfg_fn,
        )
        override_conflicts = (
            [{"scope": "skill", **c} for c in skill_conflicts]
            + [{"scope": "hero", **c} for c in hero_conflicts]
        )

    override_count = 0
    if overrides.get("skills"):
        skills = apply_skill_overrides(skills, overrides["skills"], skill_cfg_fn)
        override_count += len(overrides["skills"])
    if overrides.get("heroes"):
        heroes = apply_hero_overrides(heroes, overrides["heroes"], hero_cfg_fn)
        override_count += len(overrides["heroes"])

    if CFG_AUTHORITATIVE:
        heroes, skills = _append_cfg_supplements(heroes, skills)

    heroes, skills, sim_merge_stats = _merge_shinsen_sim_data(heroes, skills)
    skills, game8_skill_count = _merge_game8_skill_index(skills)

    # Enrich override-added hero traits with affinity from canonical traits.yaml.
    # Override heroes have inline trait dicts that lack affinity; the canonical
    # traits.yaml (populated by migration) has the structured data.
    for h in heroes:
        for t in h.get("traits") or []:
            if t.get("affinity"):
                continue
            canon = traits_data.get(t.get("name_jp", "")) or traits_data.get(t.get("name", ""))
            if canon and isinstance(canon, dict):
                passive = canon.get("passive")
                if isinstance(passive, dict) and passive.get("affinity"):
                    t["affinity"] = passive["affinity"]

    # Post-process: normalize text, fix types, sort
    heroes, skills = postprocess(heroes, skills)

    # Build bingxue catalog + re-key each hero's bingxue from JP direction to
    # CHT direction (handles the 臨戦↔機略 localization swap) so the frontend
    # can display without knowing about the swap. Done BEFORE writing heroes.json
    # so a single write produces the final file.
    bingxue_data = yaml.safe_load(BINGXUE_CANONICAL.read_text("utf-8")) if BINGXUE_CANONICAL.exists() else {}
    bingxue_out = {}
    for jp_name, entry in (bingxue_data or {}).items():
        raw = entry.get("raw", {})
        jp_dir = raw.get("direction", "")
        cht_dir = BINGXUE_JP_TO_CHT_DIR.get(jp_dir, jp_dir)
        bingxue_out[jp_name] = {
            "name": entry.get("name") or jp_name,
            "name_jp": jp_name,
            "direction": cht_dir,
            "direction_jp": jp_dir,
            "tier": raw.get("tier", ""),
            "description": (entry.get("text") or {}).get("description", ""),
            "description_jp": raw.get("effect", ""),
            "vars": entry.get("vars") or {},
        }

    for h in heroes:
        hero_bx = h.get("bingxue")
        if not hero_bx:
            continue
        h["bingxue"] = {
            BINGXUE_JP_TO_CHT_DIR.get(jp_dir, jp_dir): groups
            for jp_dir, groups in hero_bx.items()
        }

    # Write all build artifacts
    enemy_formations = _build_enemy_formations(heroes, skills)
    HEROES_JSON.parent.mkdir(parents=True, exist_ok=True)
    HEROES_JSON.write_text(json.dumps(heroes, ensure_ascii=False, indent=2), "utf-8")
    SKILLS_JSON.write_text(json.dumps(skills, ensure_ascii=False, indent=2), "utf-8")
    BINGXUE_JSON.write_text(json.dumps(bingxue_out, ensure_ascii=False, indent=2), "utf-8")
    ENEMY_FORMATIONS_JSON.write_text(json.dumps(enemy_formations, ensure_ascii=False, indent=2), "utf-8")

    statuses_yaml = yaml.safe_load(STATUSES_YAML.read_text("utf-8"))
    STATUSES_JSON.write_text(json.dumps(statuses_yaml, ensure_ascii=False, indent=2), "utf-8")

    # Stats
    traits_with_translation = sum(
        1 for h in heroes for t in h["traits"] if t["name"] != t.get("name_jp", t["name"])
    )
    heroes_with_cht = sum(1 for h in heroes if h.get("name") != h.get("name_jp"))
    print(f"[done] {len(heroes)} heroes → {HEROES_JSON}")
    print(f"[done] {len(skills)} skills → {SKILLS_JSON}")
    print(f"[done] {len(bingxue_out)} bingxue options → {BINGXUE_JSON}")
    print(f"[info] {heroes_with_cht} hero names translated to CHT")
    print(f"[info] {traits_with_translation} traits translated to CHT")
    if override_count:
        print(f"[info] {override_count} overrides applied")
    if sim_merge_stats["heroes"] or sim_merge_stats["skills"]:
        print(
            "[info] shinsen simulator metadata merged: "
            f"{sim_merge_stats['heroes']} heroes, "
            f"{sim_merge_stats['skills']} skills, "
            f"{sim_merge_stats['enemy_formations']} enemy formations available"
        )
    if game8_skill_count:
        print(f"[info] Game8 skill descriptions merged: {game8_skill_count}")
    if CFG_AUTHORITATIVE:
        print(f"[info] CFG_AUTHORITATIVE=1 (cfg.json wins for names + metadata)")
        _print_coverage_hint("heroes", hero_classification)
        _print_coverage_hint("skills", skill_classification)
        if drift_log:
            CFG_HERO_DRIFT_PATH.write_text(
                yaml.safe_dump(drift_log, allow_unicode=True, sort_keys=False),
                "utf-8",
            )
            print(f"[info] {len(drift_log)} hero cost/rarity drifts → {CFG_HERO_DRIFT_PATH}")
        elif CFG_HERO_DRIFT_PATH.exists():
            CFG_HERO_DRIFT_PATH.unlink()
        if override_conflicts:
            CFG_OVERRIDE_CONFLICTS_PATH.write_text(
                yaml.safe_dump(override_conflicts, allow_unicode=True, sort_keys=False),
                "utf-8",
            )
            print(
                f"[warn] {len(override_conflicts)} override fields differ from cfg "
                f"→ {CFG_OVERRIDE_CONFLICTS_PATH}"
            )
            print("       (review whether the override is now redundant - cfg may have caught up)")
        elif CFG_OVERRIDE_CONFLICTS_PATH.exists():
            CFG_OVERRIDE_CONFLICTS_PATH.unlink()
    else:
        # Stale cfg-mode artifacts from a previous =1 run shouldn't linger
        # in =0 mode — they no longer reflect the build that just ran.
        for p in (CFG_HERO_DRIFT_PATH, CFG_OVERRIDE_CONFLICTS_PATH):
            if p.exists():
                p.unlink()


if __name__ == "__main__":
    main()
