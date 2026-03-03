from __future__ import annotations

from dataclasses import dataclass
from math import ceil
from typing import Dict, Iterable, Tuple


@dataclass(frozen=True)
class PricingConfig:
    sea_container_cost: float = 8700
    sea_container_volume: float = 76

    fcl_20_rate: float = 5930
    fcl_40_rate: float = 7040

    weight_base_limit: int = 20_000
    overweight_rate_per_ton: float = 60
    max_container_weight: int = 26_000

    inland_rub_le_20t: float = 145_000
    inland_rub_gt_20t: float = 165_000
    inland_container_volume: float = 76

    import_declaration: float = 120

    light_rate_per_m3: float = 140
    heavy_rate_per_m3: float = 168


LIGHT_FIX_STEPS: Tuple[Tuple[int, int, float], ...] = (
    (1, 5, 30),
    (6, 16, 31),
    (17, 24, 32),
    (25, 35, 33),
    (36, 49, 34),
    (50, 59, 35),
    (60, 69, 36),
    (70, 79, 37),
    (80, 89, 38),
    (90, 99, 39),
    (100, 10**9, 40),
)

# NOTE: The prompt says heavy has a separate table but does not provide exact values.
# Until those values are known, we reuse the same breakpoints and allow overriding.
DEFAULT_HEAVY_FIX_STEPS: Tuple[Tuple[int, int, float], ...] = LIGHT_FIX_STEPS


@dataclass(frozen=True)
class CalculationResult:
    rounded_weight: int
    category: str
    billable_volume: float
    their_price: float
    lcl_total_le_20: float
    lcl_total_gt_20: float
    fcl_total: float
    recommendation: str


class LogisticsCalculator:
    def __init__(
        self,
        config: PricingConfig | None = None,
        heavy_fix_steps: Iterable[Tuple[int, int, float]] | None = None,
    ) -> None:
        self.config = config or PricingConfig()
        self.heavy_fix_steps = tuple(heavy_fix_steps or DEFAULT_HEAVY_FIX_STEPS)

    @staticmethod
    def _rounded_weight(weight_kg: float) -> int:
        return ceil(weight_kg / 1000) * 1000

    @staticmethod
    def _billable_volume(volume_m3: float) -> float:
        return max(1.0, volume_m3)

    @staticmethod
    def _fix_for_volume(volume_m3: float, steps: Iterable[Tuple[int, int, float]]) -> float:
        rounded_volume = ceil(volume_m3)
        for start, end, fix in steps:
            if start <= rounded_volume <= end:
                return fix
        raise ValueError(f"No fixed surcharge configured for volume={volume_m3}")

    def competitor_price(self, weight_kg: float, volume_m3: float) -> Dict[str, float | str | int]:
        rounded_weight = self._rounded_weight(weight_kg)
        billable_volume = self._billable_volume(volume_m3)

        if rounded_weight >= 10_000:
            category = "heavy"
            rate_per_m3 = self.config.heavy_rate_per_m3
            fix = self._fix_for_volume(billable_volume, self.heavy_fix_steps)
        else:
            category = "light"
            rate_per_m3 = self.config.light_rate_per_m3
            fix = self._fix_for_volume(billable_volume, LIGHT_FIX_STEPS)

        their_price = rate_per_m3 * billable_volume + fix
        return {
            "rounded_weight": rounded_weight,
            "billable_volume": billable_volume,
            "category": category,
            "rate_per_m3": rate_per_m3,
            "fix": fix,
            "their_price": their_price,
        }

    def lcl_totals(self, volume_m3: float, usd_rub_rate: float) -> Dict[str, float]:
        billable_volume = self._billable_volume(volume_m3)
        sea_lcl_cost = self.config.sea_container_cost * (billable_volume / self.config.sea_container_volume)
        inland_le_20_usd = (
            self.config.inland_rub_le_20t * (billable_volume / self.config.inland_container_volume)
        ) / usd_rub_rate
        inland_gt_20_usd = (
            self.config.inland_rub_gt_20t * (billable_volume / self.config.inland_container_volume)
        ) / usd_rub_rate

        lcl_total_le_20 = sea_lcl_cost + inland_le_20_usd + self.config.import_declaration
        lcl_total_gt_20 = sea_lcl_cost + inland_gt_20_usd + self.config.import_declaration

        return {
            "sea_lcl_cost": sea_lcl_cost,
            "inland_le_20_usd": inland_le_20_usd,
            "inland_gt_20_usd": inland_gt_20_usd,
            "lcl_total_le_20": lcl_total_le_20,
            "lcl_total_gt_20": lcl_total_gt_20,
        }

    def fcl_total(self, weight_kg: float, volume_m3: float) -> Dict[str, float | int]:
        billable_volume = self._billable_volume(volume_m3)
        if billable_volume <= 33:
            base_fcl_rate = self.config.fcl_20_rate
        elif billable_volume <= 76:
            base_fcl_rate = self.config.fcl_40_rate
        else:
            base_fcl_rate = self.config.fcl_40_rate * ceil(billable_volume / 76)

        overweight_tons = ceil((weight_kg - self.config.weight_base_limit) / 1000) if weight_kg > self.config.weight_base_limit else 0
        overweight_cost = overweight_tons * self.config.overweight_rate_per_ton
        containers_by_weight = ceil(weight_kg / self.config.max_container_weight)

        fcl_single = base_fcl_rate + overweight_cost
        fcl_total = fcl_single * containers_by_weight + self.config.import_declaration
        return {
            "base_fcl_rate": base_fcl_rate,
            "overweight_tons": overweight_tons,
            "overweight_cost": overweight_cost,
            "containers_by_weight": containers_by_weight,
            "fcl_single": fcl_single,
            "fcl_total": fcl_total,
        }

    def calculate(self, weight_kg: float, volume_m3: float, usd_rub_rate: float) -> CalculationResult:
        comp = self.competitor_price(weight_kg, volume_m3)
        lcl = self.lcl_totals(volume_m3, usd_rub_rate)
        fcl = self.fcl_total(weight_kg, volume_m3)

        worst_case_lcl = max(lcl["lcl_total_le_20"], lcl["lcl_total_gt_20"])
        recommendation = "LCL" if worst_case_lcl < fcl["fcl_total"] else "FCL"

        return CalculationResult(
            rounded_weight=int(comp["rounded_weight"]),
            category=str(comp["category"]),
            billable_volume=float(comp["billable_volume"]),
            their_price=float(comp["their_price"]),
            lcl_total_le_20=float(lcl["lcl_total_le_20"]),
            lcl_total_gt_20=float(lcl["lcl_total_gt_20"]),
            fcl_total=float(fcl["fcl_total"]),
            recommendation=recommendation,
        )
