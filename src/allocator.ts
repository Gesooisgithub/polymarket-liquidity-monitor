import { CONFIG } from "./config";
import { ScoredMarket, AllocatedMarket } from "./types";

export function allocate(sortedMarkets: ScoredMarket[]): AllocatedMarket[] {
  let remainingBudget = CONFIG.BUDGET_USD;
  const selected = new Map<string, AllocatedMarket>();
  let unselected = [...sortedMarkets];

  // Pass 1 — select top markets by rewardPerDollar
  for (const market of sortedMarkets) {
    if (selected.size >= CONFIG.MAX_MARKETS) break;
    if (remainingBudget < market.minSize) continue;

    remainingBudget -= market.minSize;
    selected.set(market.conditionId, {
      ...market,
      allocatedSize: market.minSize,
      estimatedDailyRewards: 0,
    });
    unselected = unselected.filter(m => m.conditionId !== market.conditionId);
  }

  // Pass 2 — redistribute remaining budget
  while (remainingBudget > 0) {
    const newCandidates =
      selected.size < CONFIG.MAX_MARKETS
        ? unselected
            .filter(m => m.minSize <= remainingBudget)
            .map(m => ({ market: m as any, score: m.rewardPerDollar, isNew: true, id: m.conditionId }))
        : [];

    const existingCandidates = [...selected.values()].map(m => ({
      market: m,
      score:
        m.existingTotalSize > 0
          ? (m.totalDailyRewards * m.existingTotalSize) /
            Math.pow(m.existingTotalSize + m.allocatedSize, 2)
          : 0,
      isNew: false,
      id: m.conditionId,
    }));

    const candidates = [...newCandidates, ...existingCandidates].filter(c => c.score > 0);
    if (candidates.length === 0) break;

    const best = candidates.reduce((a, b) => (a.score > b.score ? a : b));

    if (best.isNew) {
      remainingBudget -= best.market.minSize;
      selected.set(best.id, {
        ...best.market,
        allocatedSize: best.market.minSize,
        estimatedDailyRewards: 0,
      });
      unselected = unselected.filter(m => m.conditionId !== best.id);
    } else {
      const increment = Math.min(5.0, remainingBudget);
      const m = selected.get(best.id)!;
      m.allocatedSize += increment;
      remainingBudget -= increment;
    }
  }

  // Compute final estimated daily rewards
  for (const m of selected.values()) {
    m.estimatedDailyRewards =
      (m.allocatedSize / (m.existingTotalSize + m.allocatedSize)) * m.totalDailyRewards;
  }

  return [...selected.values()];
}
