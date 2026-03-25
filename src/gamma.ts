import { CONFIG } from "./config";
import { CandidateMarket } from "./types";

export async function fetchAndFilter(): Promise<CandidateMarket[]> {
  const allMarkets: any[] = [];
  let offset = 0;

  while (true) {
    process.stdout.write(`\rFetching markets... page ${offset / 100 + 1} (${offset + 100})`);
    const url = `${CONFIG.GAMMA_API}/markets?active=true&closed=false&clob_rewards_eligible=true&limit=100&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
    const batch: any[] = await res.json() as any[];
    allMarkets.push(...batch);
    if (batch.length < 100) break;
    offset += 100;
  }

  console.log(`\rFetched ${allMarkets.length} reward-eligible markets from Gamma`);

  const now = Date.now();
  const candidates: CandidateMarket[] = [];

  for (const m of allMarkets) {
    const clobRewards: any[] | null = m.clobRewards;
    if (!clobRewards || clobRewards.length === 0) continue;

    const totalDailyRewards = clobRewards.reduce(
      (sum: number, r: any) => sum + (r.rewardsDailyRate ?? 0),
      0
    );
    if (totalDailyRewards < CONFIG.MIN_DAILY_REWARDS) continue;

    const endDate = new Date(m.endDate);
    const daysToExpiry = (endDate.getTime() - now) / (1000 * 60 * 60 * 24);
    if (daysToExpiry < CONFIG.MIN_DAYS_TO_EXPIRY) continue;

    const minSize: number = m.rewardsMinSize ?? 0;
    if (minSize > CONFIG.BUDGET_USD) continue;

    const maxSpread: number = (m.rewardsMaxSpread ?? 0) / 100;
    const tokenIds: string[] = typeof m.clobTokenIds === "string"
      ? JSON.parse(m.clobTokenIds)
      : m.clobTokenIds ?? [];
    if (tokenIds.length < 2) continue;

    candidates.push({
      conditionId: m.conditionId,
      question: m.question,
      endDate,
      daysToExpiry,
      yesTokenId: tokenIds[0],
      noTokenId: tokenIds[1],
      totalDailyRewards,
      minSize,
      maxSpread,
    });
  }

  console.log(`${candidates.length} candidates after filtering`);

  return candidates;
}
