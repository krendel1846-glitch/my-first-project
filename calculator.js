const CONFIG = {
  SEA_CONTAINER_COST: 8700,
  SEA_CONTAINER_VOLUME: 76,
  FCL_20_RATE: 5930,
  FCL_40_RATE: 7040,
  WEIGHT_BASE_LIMIT: 20000,
  OVERWEIGHT_RATE_PER_TON: 60,
  MAX_CONTAINER_WEIGHT: 26000,
  INLAND_RUB_LE_20T: 145000,
  INLAND_RUB_GT_20T: 165000,
  INLAND_CONTAINER_VOLUME: 76,
  IMPORT_DECLARATION: 120,
  LIGHT_RATE_PER_M3: 140,
  HEAVY_RATE_PER_M3: 168,
};

const LIGHT_FIX_STEPS = [
  [1, 5, 30],
  [6, 16, 31],
  [17, 24, 32],
  [25, 35, 33],
  [36, 49, 34],
  [50, 59, 35],
  [60, 69, 36],
  [70, 79, 37],
  [80, 89, 38],
  [90, 99, 39],
  [100, Number.MAX_SAFE_INTEGER, 40],
];

function getFix(volume) {
  const roundedVolume = Math.ceil(volume);
  for (const [start, end, fix] of LIGHT_FIX_STEPS) {
    if (roundedVolume >= start && roundedVolume <= end) return fix;
  }
  throw new Error(`No fixed surcharge for volume=${volume}`);
}

function formatUsd(value) {
  return `${value.toFixed(2)} $`;
}

function calculate(weightKg, volumeM3, usdRubRate) {
  const roundedWeight = Math.ceil(weightKg / 1000) * 1000;
  const billableVolume = Math.max(1, volumeM3);

  const isHeavy = roundedWeight >= 10000;
  const category = isHeavy ? "heavy" : "light";
  const ratePerM3 = isHeavy ? CONFIG.HEAVY_RATE_PER_M3 : CONFIG.LIGHT_RATE_PER_M3;
  const fix = getFix(billableVolume);
  const theirPrice = ratePerM3 * billableVolume + fix;

  const seaLclCost = CONFIG.SEA_CONTAINER_COST * (billableVolume / CONFIG.SEA_CONTAINER_VOLUME);
  const inlandLe20Usd =
    (CONFIG.INLAND_RUB_LE_20T * (billableVolume / CONFIG.INLAND_CONTAINER_VOLUME)) / usdRubRate;
  const inlandGt20Usd =
    (CONFIG.INLAND_RUB_GT_20T * (billableVolume / CONFIG.INLAND_CONTAINER_VOLUME)) / usdRubRate;

  const lclTotalLe20 = seaLclCost + inlandLe20Usd + CONFIG.IMPORT_DECLARATION;
  const lclTotalGt20 = seaLclCost + inlandGt20Usd + CONFIG.IMPORT_DECLARATION;

  let baseFclRate;
  if (billableVolume <= 33) {
    baseFclRate = CONFIG.FCL_20_RATE;
  } else if (billableVolume <= 76) {
    baseFclRate = CONFIG.FCL_40_RATE;
  } else {
    baseFclRate = CONFIG.FCL_40_RATE * Math.ceil(billableVolume / 76);
  }

  const overweightTons =
    weightKg > CONFIG.WEIGHT_BASE_LIMIT
      ? Math.ceil((weightKg - CONFIG.WEIGHT_BASE_LIMIT) / 1000)
      : 0;
  const overweightCost = overweightTons * CONFIG.OVERWEIGHT_RATE_PER_TON;
  const containersByWeight = Math.ceil(weightKg / CONFIG.MAX_CONTAINER_WEIGHT);

  const fclSingle = baseFclRate + overweightCost;
  const fclTotal = fclSingle * containersByWeight + CONFIG.IMPORT_DECLARATION;

  const worstCaseLcl = Math.max(lclTotalLe20, lclTotalGt20);
  const recommendation = worstCaseLcl < fclTotal ? "LCL" : "FCL";

  return {
    roundedWeight,
    category,
    billableVolume,
    theirPrice,
    lclTotalLe20,
    lclTotalGt20,
    fclTotal,
    recommendation,
  };
}

function renderResult(result) {
  const block = document.getElementById("result");
  block.innerHTML = `
    <div class="result-grid">
      <div class="row"><span>Округленный вес</span><span class="value">${result.roundedWeight} кг</span></div>
      <div class="row"><span>Категория</span><span class="value">${result.category}</span></div>
      <div class="row"><span>Оплачиваемый объем</span><span class="value">${result.billableVolume.toFixed(2)} м³</span></div>
      <div class="row"><span>Их цена</span><span class="value">${formatUsd(result.theirPrice)}</span></div>
      <div class="row"><span>LCL (<=20т)</span><span class="value">${formatUsd(result.lclTotalLe20)}</span></div>
      <div class="row"><span>LCL (>20т)</span><span class="value">${formatUsd(result.lclTotalGt20)}</span></div>
      <div class="row"><span>FCL</span><span class="value">${formatUsd(result.fclTotal)}</span></div>
    </div>
    <div class="recommendation"><strong>Рекомендация:</strong> ${result.recommendation}</div>
  `;
}

function init() {
  const btn = document.getElementById("calculateBtn");
  btn.addEventListener("click", () => {
    const weightKg = Number(document.getElementById("weightKg").value);
    const volumeM3 = Number(document.getElementById("volumeM3").value);
    const usdRubRate = Number(document.getElementById("usdRubRate").value);

    if (weightKg < 0 || volumeM3 < 0 || usdRubRate <= 0) {
      alert("Проверьте входные значения: вес/объем >= 0, курс > 0.");
      return;
    }

    const result = calculate(weightKg, volumeM3, usdRubRate);
    renderResult(result);
    document.getElementById("resultCard").hidden = false;
  });
}

init();
