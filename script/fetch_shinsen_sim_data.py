"""
Fetch public structured data from https://nobunaga-shinsen-sim.jp/.

The battle logic itself is server-side, but /api/data exposes the normalized
commander, tactic, and template enemy formation fields used by that simulator.
We store that snapshot separately from Game8/cfg data and merge only the
structured battle metadata during build_frontend_data.py.
"""

from __future__ import annotations

import json
import urllib.request

from paths import SHINSEN_SIM_API_JSON

API_URL = "https://nobunaga-shinsen-sim.jp/api/data"


def main() -> None:
    req = urllib.request.Request(
        API_URL,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
            ),
            "Accept": "application/json",
            "Accept-Language": "ja,en;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8-sig")
    data = json.loads(raw)
    SHINSEN_SIM_API_JSON.parent.mkdir(parents=True, exist_ok=True)
    SHINSEN_SIM_API_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        "utf-8",
    )
    print(
        "[done] shinsen sim data: "
        f"{len(data.get('commanders', []))} commanders, "
        f"{len(data.get('tactics', []))} tactics, "
        f"{len(data.get('enemyFormations', []))} enemy formations -> "
        f"{SHINSEN_SIM_API_JSON}"
    )


if __name__ == "__main__":
    main()
