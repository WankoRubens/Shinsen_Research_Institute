import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class TraitDatabasePageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.view = (ROOT / "src/views/TraitDatabaseView.vue").read_text(encoding="utf-8")
        cls.router = (ROOT / "src/router/index.ts").read_text(encoding="utf-8")
        cls.pages = (ROOT / "src/config/publishedPages.ts").read_text(encoding="utf-8")
        cls.sidebar = (ROOT / "src/components/layout/SidebarBody.vue").read_text(encoding="utf-8")
        cls.workflow = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")
        cls.builder = (ROOT / "script/build_frontend_data.py").read_text(encoding="utf-8")
        cls.heroes = json.loads((ROOT / ".build/heroes.json").read_text(encoding="utf-8"))

    def test_route_and_navigation_are_registered(self):
        self.assertIn("path: 'traits'", self.router)
        self.assertIn("name: 'traitDb'", self.router)
        self.assertIn("{ name: 'traitDb'", self.sidebar)

    def test_trait_page_is_public_and_deployed(self):
        self.assertGreaterEqual(self.pages.count("'traitDb'"), 2)
        self.assertIn("heroDb,traitDb,skillDb,settings", self.workflow)

    def test_table_contains_requested_trait_columns(self):
        for heading in ("特性名", "実装状況", "効果", "所持武将", "人数"):
            with self.subTest(heading=heading):
                self.assertIn(f">{heading}<", self.view)
        self.assertNotIn(">ランク<", self.view)

    def test_traits_are_grouped_and_searchable(self):
        self.assertIn("const rows = new Map", self.view)
        self.assertIn("existing.heroes.add(heroName)", self.view)
        self.assertIn("existing.searchHeroes.add(name)", self.view)
        self.assertIn("...(hero.aliases ?? [])", self.view)
        self.assertIn("...row.searchHeroes", self.view)
        self.assertIn("特性名・効果・武将名を検索", self.view)
        self.assertNotIn("selectedRank", self.view)

    def test_implementation_status_is_visible_and_filterable(self):
        self.assertIn("traitImplementation(trait)", self.view)
        self.assertIn("実装済み", self.view)
        self.assertIn("一部実装", self.view)
        self.assertIn("未実装", self.view)
        self.assertIn("selectedStatus", self.view)

    def test_placeholder_trait_slots_are_removed(self):
        self.assertIn('if trait_name in {"", "-", "－", "―", "—"}:', self.builder)
        placeholder_names = {"", "-", "－", "―", "—"}
        for hero in self.heroes:
            for trait in hero.get("traits") or []:
                with self.subTest(hero=hero.get("name_jp"), trait=trait.get("name_jp")):
                    self.assertNotIn((trait.get("name_jp") or "").strip(), placeholder_names)

    def test_mobile_rows_fit_the_viewport(self):
        self.assertIn("grid-template-areas:", self.view)
        self.assertIn('"name status"', self.view)
        self.assertIn(".trait-table thead { display: none; }", self.view)
        self.assertIn("min-width: 0;", self.view)


if __name__ == "__main__":
    unittest.main()
