from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
MOCK_BATTLE = ROOT / "src" / "views" / "MockBattle.vue"


class MockBattleResultReportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = MOCK_BATTLE.read_text(encoding="utf-8")

    def test_result_report_shows_team_and_member_totals(self) -> None:
        for marker in (
            'class="report-scoreboard"',
            "sideSummary('ally').dead",
            "sideSummary('ally').wounded",
            'class="report-member-grid"',
            'v-for="member in battleReportMembers"',
            '<dt>発動</dt>',
            '<dt>撃破</dt>',
            '<dt>救援</dt>',
        ):
            self.assertIn(marker, self.source)

    def test_report_keeps_all_six_members_in_one_row(self) -> None:
        self.assertIn("grid-template-columns: repeat(6, minmax(0, 1fr));", self.source)
        self.assertIn("overflow-x: auto;", self.source)
        self.assertIn("min-width: 960px;", self.source)

    def test_normal_attack_totals_include_converted_normal_attacks(self) -> None:
        self.assertIn("/の(?:計略)?通常攻撃[:：]/.test(entry.message)", self.source)


if __name__ == "__main__":
    unittest.main()
