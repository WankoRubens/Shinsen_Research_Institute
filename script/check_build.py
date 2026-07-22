"""
Post-build invariants on the frontend JSON files.

Validates only what can be seen in `.build/*.json` — reference resolution,
required fields, and duplicate skill names.
Override-agnostic by design: if overrides broke something, the JSON will
show it; if the LLM missed something, the JSON will show it.

Pipeline-coverage questions (e.g. "is every crawled JP entry accounted for?")
live in `check_coverage.py` — it's a separate concern that needs to know
about overrides.

Usage:
    python script/check_build.py
"""

import json
import sys

from paths import ENEMY_FORMATIONS_JSON, HEROES_JSON, SKILLS_JSON


def check() -> list[str]:
    heroes = json.loads(HEROES_JSON.read_text("utf-8"))
    skills = json.loads(SKILLS_JSON.read_text("utf-8"))
    formations = json.loads(ENEMY_FORMATIONS_JSON.read_text("utf-8"))
    print(
        f"[check-build] heroes={len(heroes)} skills={len(skills)} "
        f"enemy_formations={len(formations)}"
    )

    errors: list[str] = []

    # ---- Reference resolution + required-field checks ---------------------
    skill_by_name = {s["name"]: s for s in skills}
    skill_by_jp = {s.get("name_jp"): s for s in skills if s.get("name_jp")}

    def find_skill(name: str):
        return skill_by_name.get(name) or skill_by_jp.get(name)

    for h in heroes:
        if not h.get("name"):
            errors.append(f"Hero missing name: {h}")
            continue
        if not h.get("stats"):
            errors.append(f"Hero '{h['name']}' missing stats")
        if not h.get("portrait"):
            errors.append(f"Hero '{h['name']}' missing portrait")
        if not h.get("faction"):
            errors.append(f"Hero '{h['name']}' missing faction")

        for ref_field in ("unique_skill", "teachable_skill"):
            ref = h.get(ref_field)
            if ref and not find_skill(ref):
                errors.append(f"Hero '{h['name']}' {ref_field}='{ref}' not found in skills.json")

    for s in skills:
        if not s.get("name"):
            errors.append(f"Skill missing name: {s}")
        if not s.get("type"):
            errors.append(f"Skill '{s.get('name','')}' missing type")
        if not s.get("description"):
            errors.append(f"Skill '{s.get('name','')}' missing description")

    seen_names: set[str] = set()
    for s in skills:
        n = s.get("name")
        if n and n in seen_names:
            errors.append(f"Duplicate skill name: '{n}'")
        if n:
            seen_names.add(n)

    # ---- Enemy formation completeness ------------------------------------
    def build_lookup(items: list[dict]) -> dict[str, dict]:
        lookup: dict[str, dict] = {}
        for item in items:
            for key in (
                item.get("sim_id"),
                item.get("name"),
                item.get("name_jp"),
                *(item.get("aliases") or []),
            ):
                if key:
                    lookup[key] = item
        return lookup

    hero_lookup = build_lookup(heroes)
    skill_lookup = build_lookup(skills)
    if not formations:
        errors.append("No enemy formations generated")
    for formation in formations:
        formation_id = formation.get("id") or formation.get("name") or "?"
        members = formation.get("members") or []
        if len(members) != 3:
            errors.append(f"Formation '{formation_id}' must have exactly 3 members")
            continue
        for member in members:
            hero_ref = member.get("commander_id")
            if not hero_ref or hero_ref not in hero_lookup:
                errors.append(f"Formation '{formation_id}' hero '{hero_ref}' not found in heroes.json")
            for field in ("skill1_id", "skill2_id"):
                skill_ref = member.get(field)
                if not skill_ref or skill_ref not in skill_lookup:
                    errors.append(
                        f"Formation '{formation_id}' {field}='{skill_ref}' not found in skills.json"
                    )

    return errors


def main():
    errors = check()

    if errors:
        print(f"\n{len(errors)} BUILD ERROR(S):")
        for e in errors:
            print(f"  {e}")
        print("\n[hint] Most build errors mean the translated YAML has missing or malformed fields.")
        print("       Re-run: uv run script/llm_translate.py  (optionally with --name or --limit)")
        sys.exit(1)
    print("[check-build] All post-build checks passed.")


if __name__ == "__main__":
    main()
