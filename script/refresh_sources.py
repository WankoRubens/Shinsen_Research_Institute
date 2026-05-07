"""
Refresh both data sources (game8.jp crawl + Sialia cfg.json) and run the
cfg consistency check.

Pipeline (sequential):
  1. crawl_heroes.py         — game8 crawl (forwards crawl-related flags)
  2. fetch_cfg.py            — Sialia cfg.json (forwards --force)
  3. cfg_diff.py             — diff vs prior cfg + internal consistency

Each step is run as a subprocess. Failure of an earlier step short-circuits.
Use --skip-crawl or --skip-cfg to selectively run only one source. Use
--cfg-mode to control warn/block behaviour of cfg_diff.

This is meant to be the single entry point for "freshen up the inputs"
before running the build pipeline. See: package.json `npm run refresh`.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent


def _run(name: str, cmd: list[str]) -> int:
    print(f"\n[refresh_sources] === {name} ===", flush=True)
    print(f"[refresh_sources] $ {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd, cwd=REPO_ROOT)
    if result.returncode != 0:
        print(
            f"[refresh_sources] {name} failed with exit code "
            f"{result.returncode}",
            file=sys.stderr,
        )
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-crawl",
        action="store_true",
        help="Skip game8 crawl step (only fetch cfg + diff).",
    )
    parser.add_argument(
        "--skip-cfg",
        action="store_true",
        help="Skip cfg fetch and diff steps (only crawl).",
    )
    parser.add_argument(
        "--cfg-mode",
        choices=("warn", "block"),
        default="warn",
        help="Threshold mode for cfg_diff (default: warn — Phase 1-3 default).",
    )
    parser.add_argument(
        "--no-detail",
        action="store_true",
        help="Pass-through: skip crawl detail pages (faster, less complete).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Pass-through: max heroes to crawl detail for.",
    )
    parser.add_argument(
        "--name",
        help="Pass-through: filter heroes by name (substring match).",
    )
    parser.add_argument(
        "--refresh-index",
        action="store_true",
        help="Pass-through: re-fetch crawl index page.",
    )
    parser.add_argument(
        "--force-crawl",
        action="store_true",
        help="Pass-through: ignore crawl cache (heavy — re-fetches every page).",
    )
    parser.add_argument(
        "--force-cfg",
        action="store_true",
        help="Force fetch_cfg to re-archive even if bytes match current.",
    )
    args = parser.parse_args()

    uv = shutil.which("uv") or "uv"

    # --- 1. crawl game8 ----------------------------------------------------
    if not args.skip_crawl:
        crawl_cmd = [uv, "run", "script/crawl_heroes.py"]
        if not args.no_detail:
            crawl_cmd.append("--detail")
        if args.limit is not None:
            crawl_cmd.extend(["--limit", str(args.limit)])
        if args.name:
            crawl_cmd.extend(["--name", args.name])
        if args.refresh_index:
            crawl_cmd.append("--refresh-index")
        if args.force_crawl:
            crawl_cmd.append("--force")
        rc = _run("crawl_heroes", crawl_cmd)
        if rc != 0:
            return rc

    # --- 2. fetch cfg ------------------------------------------------------
    if not args.skip_cfg:
        cfg_cmd = [uv, "run", "script/fetch_cfg.py"]
        if args.force_cfg:
            cfg_cmd.append("--force")
        rc = _run("fetch_cfg", cfg_cmd)
        if rc != 0:
            return rc

        # --- 3. diff cfg ---------------------------------------------------
        diff_cmd = [uv, "run", "script/cfg_diff.py", "--mode", args.cfg_mode]
        rc = _run("cfg_diff", diff_cmd)
        if rc != 0:
            return rc

    print("\n[refresh_sources] all steps complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
