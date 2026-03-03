import unittest

from logistics_engine import LogisticsCalculator


class LogisticsCalculatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.calc = LogisticsCalculator()

    def test_competitor_light_category_and_min_volume(self) -> None:
        data = self.calc.competitor_price(weight_kg=9500, volume_m3=0.3)
        self.assertEqual(data["rounded_weight"], 10_000)
        self.assertEqual(data["category"], "heavy")
        self.assertEqual(data["billable_volume"], 1.0)
        self.assertEqual(data["their_price"], 198.0)

    def test_lcl_totals(self) -> None:
        data = self.calc.lcl_totals(volume_m3=38, usd_rub_rate=100)
        self.assertAlmostEqual(data["sea_lcl_cost"], 4350.0)
        self.assertAlmostEqual(data["inland_le_20_usd"], 725.0)
        self.assertAlmostEqual(data["inland_gt_20_usd"], 825.0)
        self.assertAlmostEqual(data["lcl_total_le_20"], 5195.0)
        self.assertAlmostEqual(data["lcl_total_gt_20"], 5295.0)

    def test_fcl_overweight_and_weight_limit(self) -> None:
        data = self.calc.fcl_total(weight_kg=26_500, volume_m3=40)
        self.assertEqual(data["base_fcl_rate"], 7040)
        self.assertEqual(data["overweight_tons"], 7)
        self.assertEqual(data["overweight_cost"], 420)
        self.assertEqual(data["containers_by_weight"], 2)
        self.assertEqual(data["fcl_total"], 15040)

    def test_recommendation_worst_case_logic(self) -> None:
        result = self.calc.calculate(weight_kg=15_000, volume_m3=5, usd_rub_rate=100)
        self.assertEqual(result.recommendation, "LCL")


if __name__ == "__main__":
    unittest.main()
