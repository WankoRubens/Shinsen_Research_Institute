import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class AiLineupOptimizerProgressTest(unittest.TestCase):
    def setUp(self):
        self.source = (ROOT / "src" / "views" / "AiLineupOptimizer.vue").read_text(encoding="utf-8")

    def test_selected_tiers_are_evaluated(self):
        self.assertIn("selectedTemplateTierSet", self.source)
        self.assertIn("selectedTemplateTierSet.value.has", self.source)
        self.assertIn("selectedTemplateTiers[option.value]", self.source)

    def test_results_and_browser_are_updated_after_each_candidate(self):
        self.assertIn("topResults.value = rankedTopResults(retained)", self.source)
        self.assertIn("progress.done += 1", self.source)
        self.assertIn("Promise.race(inFlight)", self.source)

    def test_long_matchup_evaluation_yields_to_the_browser(self):
        self.assertIn("const evaluateLineup = async", self.source)
        self.assertIn("pool.evaluate", self.source)
        self.assertIn("const inFlight = new Set<Promise<void>>()", self.source)

    def test_fixed_hero_positions_can_be_toggled(self):
        state = (ROOT / "src" / "composables" / "useAiLineupOptimizerState.ts").read_text(encoding="utf-8")

        self.assertIn("const reorderFixedHeroes = ref(true)", state)
        self.assertIn('active-text="可変"', self.source)
        self.assertIn('inactive-text="固定"', self.source)
        self.assertIn("if (reorderFixedHeroes.value)", self.source)
        self.assertIn("team[role] = cloneRole(seedTeam[role])", self.source)

    def test_only_precisely_implemented_skills_are_used(self):
        self.assertIn("precise-battle-implemented-only", self.source)
        self.assertIn("battleSkillImplementation(skill).status === 'implemented'", self.source)
        self.assertIn("unsupportedFixedSkillNames.value.length === 0", self.source)
        self.assertNotIn("IMPLEMENTED_BATTLE_SKILL_NAMES", self.source)


if __name__ == "__main__":
    unittest.main()
