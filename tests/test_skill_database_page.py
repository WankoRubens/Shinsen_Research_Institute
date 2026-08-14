import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class SkillDatabasePageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.view = (ROOT / "src/views/SkillDatabaseView.vue").read_text(encoding="utf-8")
        cls.router = (ROOT / "src/router/index.ts").read_text(encoding="utf-8")
        cls.pages = (ROOT / "src/config/publishedPages.ts").read_text(encoding="utf-8")
        cls.sidebar = (ROOT / "src/components/layout/SidebarBody.vue").read_text(encoding="utf-8")
        cls.workflow = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")
        cls.effects = (ROOT / "src/lib/battleSkillEffects.ts").read_text(encoding="utf-8")

    def test_route_and_navigation_are_registered(self):
        self.assertIn("path: 'skills'", self.router)
        self.assertIn("name: 'skillDb'", self.router)
        self.assertIn("{ name: 'skillDb'", self.sidebar)

    def test_skill_page_is_public_and_deployed(self):
        self.assertGreaterEqual(self.pages.count("'skillDb'"), 2)
        self.assertIn("traitDb,skillDb,settings", self.workflow)

    def test_table_contains_skill_columns(self):
        for heading in ("戦法名", "種類", "発動率", "実装状況", "効果（最大Lv）", "由来"):
            with self.subTest(heading=heading):
                self.assertIn(f">{heading}<", self.view)

    def test_skills_are_searchable_and_filterable(self):
        self.assertIn("戦法名・効果・武将名を検索", self.view)
        self.assertIn("selectedType", self.view)
        self.assertIn("selectedStatus", self.view)
        self.assertIn("BATTLE_SKILL_TYPE_PRIORITY", self.view)

    def test_implementation_status_distinguishes_individual_and_common_logic(self):
        self.assertIn("battleSkillImplementation(skill)", self.view)
        self.assertIn("個別戦法ロジック", self.effects)
        self.assertIn("戦法説明ベースの共通処理", self.effects)
        self.assertIn("実装済み", self.view)
        self.assertIn("一部実装", self.view)
        self.assertIn("未実装", self.view)


if __name__ == "__main__":
    unittest.main()
