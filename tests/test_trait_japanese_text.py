import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = ROOT / "script/build_frontend_data.py"


def load_manual_trait_text() -> dict:
    tree = ast.parse(BUILD_SCRIPT.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "MANUAL_TRAIT_JA_TEXT":
                    return ast.literal_eval(node.value)
    raise AssertionError("MANUAL_TRAIT_JA_TEXT is missing")


class TraitJapaneseTextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entries = load_manual_trait_text()
        cls.build_script = BUILD_SCRIPT.read_text(encoding="utf-8")

    def test_traditional_chinese_trait_names_have_japanese_text(self):
        expected_names = {
            "花枝招展": "花枝招展",
            "鐵炮大將": "鉄砲大将",
            "靈巧II": "急速Ⅱ",
            "隱忍I": "忍耐Ⅰ",
            "領兵III": "統帥Ⅲ",
        }
        for source_name, japanese_name in expected_names.items():
            with self.subTest(source_name=source_name):
                self.assertEqual(self.entries[source_name]["name_jp"], japanese_name)
                self.assertTrue(self.entries[source_name]["description_jp"])

    def test_manual_trait_text_is_applied_during_postprocessing(self):
        self.assertIn("MANUAL_TRAIT_JA_TEXT.get(t.get(\"name\", \"\"))", self.build_script)
        self.assertIn("t.update(manual_ja)", self.build_script)


if __name__ == "__main__":
    unittest.main()
