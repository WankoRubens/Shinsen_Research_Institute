"""
Narrow LLM tasks for filling gaps in cfg-derived data (Phase 4).

Replaces most uses of llm_translate.py once Phase 4 ships. Each --task is a
deterministic, scope-limited job:

  --task=tips_zh_hant   Fill skills where cfg.tips lacks a zh-hant counterpart
                        in multi_lang. OpenCC s2tw + LLM polish for the
                        residual term-level cleanup. ~25 entries today.
  --task=placeholders   (Phase 4b) Map cfg's {N%}/{2}/{3%} → {var:name} using
                        the game8-side variable list. Heuristic + LLM fallback.

Output goes to data/prototype/*_filled.yaml — gitignored, regenerable from cfg
+ LLM cache. build_frontend_data.py reads these on the cfg-authoritative path.

Usage:
    uv run script/llm_fill.py --task=tips_zh_hant
    uv run script/llm_fill.py --task=tips_zh_hant --limit 5     # try a sample first
    uv run script/llm_fill.py --task=tips_zh_hant --force       # ignore cache
    uv run script/llm_fill.py --task=tips_zh_hant --name 風林    # filter by name substring
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

import yaml

from llm_core import (
    DEFAULT_MODEL,
    TIPS_ZH_HANT_POLISH_PROMPT,
    call_llm,
    get_token_totals,
    has_kana,
    load_llm_cache,
    opencc_s2tw,
    reset_token_totals,
    save_llm_cache,
)
from paths import LLM_CACHE_DIR, PROTOTYPE_DIR, TIPS_ZH_HANT_FILLED


def _load_proto_skills() -> dict:
    path = PROTOTYPE_DIR / "skills_proto.yaml"
    if not path.exists():
        raise SystemExit(
            f"{path} missing. Run `uv run script/merge_sources.py` first."
        )
    return yaml.safe_load(path.read_text("utf-8")) or {}


def _candidates_tips(proto: dict, name_filter: str | None, limit: int | None) -> list[tuple[str, str]]:
    """(jp_key, tips_zh_hans) for skills that have hans but no hant."""
    out: list[tuple[str, str]] = []
    for jp_key, entry in proto.items():
        cfg = entry.get("cfg") or {}
        if not cfg.get("tips_zh_hans") or cfg.get("tips_zh_hant"):
            continue
        # match.confidence must be high/low so we have a real cfg link
        conf = (entry.get("match") or {}).get("confidence")
        if conf not in ("high", "low"):
            continue
        if name_filter and name_filter not in jp_key:
            continue
        out.append((jp_key, cfg["tips_zh_hans"]))
        if limit and len(out) >= limit:
            break
    return out


def _cache_key(opencc_text: str, model: str) -> str:
    """Cache key folds in OpenCC output + model — re-poliching same input is a hit."""
    h = hashlib.sha256(f"tips_polish|{model}|{opencc_text}".encode("utf-8")).hexdigest()
    return f"tips_polish_{h[:16]}"


def _polish_one(opencc_text: str, model: str, force: bool) -> tuple[str, bool]:
    """Returns (polished_text, was_cached). Empty input passes through."""
    if not opencc_text:
        return "", True
    key = _cache_key(opencc_text, model)
    cache_dir = LLM_CACHE_DIR / "tips_polish"
    if not force:
        cached = load_llm_cache(key, cache_dir)
        if cached and cached.get("polished"):
            return cached["polished"], True

    polished = call_llm(
        prompt=opencc_text,
        system_prompt=TIPS_ZH_HANT_POLISH_PROMPT,
        model=model,
    ).strip()
    save_llm_cache(key, {"input": opencc_text, "polished": polished}, cache_dir)
    return polished, False


def _validate(jp_key: str, polished: str) -> list[str]:
    issues: list[str] = []
    if has_kana(polished):
        issues.append(f"{jp_key}: polished output contains kana")
    if "知略" in polished:
        issues.append(f"{jp_key}: '知略' should be '智略'")
    if "計略傷害" in polished:
        issues.append(f"{jp_key}: '計略傷害' should be '謀略傷害'")
    return issues


def task_tips_zh_hant(args: argparse.Namespace) -> int:
    proto = _load_proto_skills()
    candidates = _candidates_tips(proto, args.name, args.limit)
    if not candidates:
        print("[llm_fill] no tips_zh_hant candidates — proto already covers everything")
        return 0
    print(f"[llm_fill] {len(candidates)} skills missing tips_zh_hant")

    # First pass: deterministic OpenCC. The LLM polish only handles the
    # residual term cleanup that character-level conversion can't catch.
    opencc_pairs = [(jp, opencc_s2tw(hans)) for jp, hans in candidates]

    reset_token_totals()
    filled: dict[str, dict] = {}
    issues: list[str] = []
    cached_hits = 0

    # Warm-cache pattern: process the first call alone, then any remaining
    # benefit from the now-cached system prompt. (Parallelism is not worth
    # it at 25 entries; sequential keeps log readable.)
    for i, (jp_key, opencc_text) in enumerate(opencc_pairs):
        polished, was_cached = _polish_one(opencc_text, args.model, args.force)
        if was_cached:
            cached_hits += 1
        problems = _validate(jp_key, polished)
        issues.extend(problems)
        filled[jp_key] = {
            "tips_zh_hans": dict(candidates)[jp_key],
            "tips_opencc": opencc_text,
            "tips_zh_hant": polished,
            "issues": problems or None,
        }
        status = "cache" if was_cached else "llm"
        flag = " ⚠" if problems else ""
        print(f"  [{i+1}/{len(opencc_pairs)}] {jp_key} ({status}){flag}")

    # Write results
    TIPS_ZH_HANT_FILLED.parent.mkdir(parents=True, exist_ok=True)
    TIPS_ZH_HANT_FILLED.write_text(
        yaml.safe_dump(filled, allow_unicode=True, sort_keys=False, default_flow_style=False),
        "utf-8",
    )
    print(f"[llm_fill] wrote {TIPS_ZH_HANT_FILLED} ({len(filled)} entries; {cached_hits} cached, {len(filled)-cached_hits} llm)")

    totals = get_token_totals()
    if totals["calls"]:
        print(
            f"[llm_fill] tokens: prompt={totals['prompt']} "
            f"completion={totals['completion']} cached={totals['cached']} "
            f"calls={totals['calls']}"
        )

    if issues:
        print(f"\n[llm_fill] {len(issues)} issue(s):")
        for line in issues:
            print(f"  - {line}")
        return 1
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--task",
        choices=["tips_zh_hant"],  # placeholders / hero_names / battle_engine come later
        required=True,
    )
    p.add_argument("--limit", type=int, default=None, help="process at most N entries")
    p.add_argument("--name", type=str, default=None, help="filter by JP key substring")
    p.add_argument("--force", action="store_true", help="ignore cache")
    p.add_argument("--model", type=str, default=DEFAULT_MODEL)
    args = p.parse_args()

    if args.task == "tips_zh_hant":
        return task_tips_zh_hant(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
