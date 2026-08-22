import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class MobilePickerDialogsTest(unittest.TestCase):
    def test_simulation_pages_do_not_use_fixed_picker_widths(self):
        for relative_path in (
            "src/views/AiLineupOptimizer.vue",
            "src/views/BattleSimulator.vue",
            "src/views/MockBattle.vue",
        ):
            source = (ROOT / relative_path).read_text(encoding="utf-8")
            self.assertNotIn('width="920px"', source)
            self.assertNotIn('width="760px"', source)
            self.assertIn('calc(100vw - 16px)', source)
            self.assertIn('align-center', source)

    def test_picker_dialogs_are_bounded_by_the_mobile_viewport(self):
        css = (ROOT / "src/assets/tailwind.css").read_text(encoding="utf-8")
        self.assertIn(".el-dialog.sim-picker-dialog", css)
        self.assertIn("max-height: calc(100dvh - 8px)", css)
        self.assertIn("width: calc(100vw - 8px) !important", css)
        self.assertIn("overflow: hidden", css)

    def test_mobile_hero_cards_use_three_columns_for_readability(self):
        source = (ROOT / "src/components/HeroLibrary.vue").read_text(encoding="utf-8")
        self.assertIn("'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'", source)


if __name__ == "__main__":
    unittest.main()
