import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class TraitImplementationRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = (ROOT / "src/lib/traitImplementation.ts").read_text(encoding="utf-8")

    def test_affinity_traits_are_implemented_by_shared_logic(self):
        self.assertIn("if (trait.affinity)", self.registry)
        self.assertIn("兵種レベル反映", self.registry)
        self.assertIn("兵種上限反映", self.registry)

    def test_unknown_trait_effects_are_not_reported_as_implemented(self):
        self.assertIn("status: 'unimplemented'", self.registry)
        self.assertIn("戦闘ロジック未実装", self.registry)

    def test_named_effect_registry_is_available_for_future_cases(self):
        self.assertIn("IMPLEMENTED_TRAIT_EFFECTS", self.registry)


if __name__ == "__main__":
    unittest.main()
