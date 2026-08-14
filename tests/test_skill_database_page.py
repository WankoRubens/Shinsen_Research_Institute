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
        cls.event_materials = (ROOT / "src/constants/eventSkillMaterials.ts").read_text(encoding="utf-8")

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
        self.assertIn("hero.teachable_skill", self.view)
        self.assertIn("hero.unique_skill", self.view)
        self.assertIn("hero.assembly_skill", self.view)
        self.assertIn("...row.searchHeroes", self.view)
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

    def test_event_skills_show_required_materials(self):
        self.assertIn("if (skill.is_event_skill) return '事件'", self.view)
        self.assertIn("必要素材", self.view)
        self.assertIn("eventSkillMaterial(skill)", self.view)

        for skill_name in (
            "姻戚同盟", "離心の計", "城盗り", "機に乗ず", "大器の萌芽", "自立の志",
            "専横専断", "家中整序", "破天の轟", "雷神斬り", "南蛮渡来", "疑心暗鬼",
            "直諫敢行", "会盟の陣", "出奇制勝", "三河武士", "越後先手組", "追い崩し",
        ):
            with self.subTest(skill_name=skill_name):
                self.assertIn(f"'{skill_name}':", self.event_materials)

    def test_mobile_rows_fit_the_viewport(self):
        self.assertIn("grid-template-areas:", self.view)
        self.assertIn('"name type"', self.view)
        self.assertIn(".skill-table thead { display: none; }", self.view)
        self.assertIn("min-width: 0;", self.view)

    def test_search_and_filters_stay_visible_while_scrolling(self):
        toolbar = self.view[self.view.index(".skill-toolbar {"):]
        self.assertIn("position: sticky;", toolbar)
        self.assertIn("top: 0;", toolbar)
        self.assertIn("z-index: 10;", toolbar)
        self.assertIn(".skill-toolbar { top: -12px;", toolbar)


if __name__ == "__main__":
    unittest.main()
