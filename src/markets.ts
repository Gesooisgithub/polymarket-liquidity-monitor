import { CONFIG } from "./config";
import { CandidateMarket } from "./types";

interface ClobRewardsRate {
  asset_address: string;
  rewards_daily_rate: number;
}

interface ClobRewards {
  rates: ClobRewardsRate[] | null;
  min_size: number;
  max_spread: number;
}

interface ClobToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

interface ClobMarket {
  condition_id: string;
  question: string;
  end_date_iso: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  accepting_orders: boolean;
  enable_order_book: boolean;
  rewards: ClobRewards;
  tokens: ClobToken[];
}

interface SamplingMarketsResponse {
  data: ClobMarket[];
  next_cursor: string;
  limit: number;
  count: number;
}

const END_CURSOR = "LTE=";

export async function fetchAndFilter(): Promise<CandidateMarket[]> {
  const allMarkets: ClobMarket[] = [];
  let cursor = "";
  let page = 0;

  while (true) {
    page++;
    process.stdout.write(`\rFetching reward markets... page ${page} (${allMarkets.length} so far)`);
    const url = `${CONFIG.CLOB_API}/sampling-markets${cursor ? `?next_cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CLOB sampling-markets error: ${res.status}`);
    const body = (await res.json()) as SamplingMarketsResponse;
    allMarkets.push(...body.data);
    if (!body.next_cursor || body.next_cursor === END_CURSOR) break;
    cursor = body.next_cursor;
  }

  console.log(`\rFetched ${allMarkets.length} reward-distributing markets from CLOB`);

  const now = Date.now();
  const candidates: CandidateMarket[] = [];

  for (const m of allMarkets) {
    if (!m.active || m.closed || m.archived || !m.accepting_orders || !m.enable_order_book) continue;

    const rates = m.rewards?.rates ?? [];
    if (rates.length === 0) continue;

    const totalDailyRewards = rates.reduce((s, r) => s + (r.rewards_daily_rate ?? 0), 0);
    if (totalDailyRewards < CONFIG.MIN_DAILY_REWARDS) continue;

    const endDate = new Date(m.end_date_iso);
    const daysToExpiry = (endDate.getTime() - now) / (1000 * 60 * 60 * 24);
    if (daysToExpiry < CONFIG.MIN_DAYS_TO_EXPIRY) continue;

    const minSize = m.rewards?.min_size ?? 0;
    if (minSize > CONFIG.BUDGET_USD) continue;

    const maxSpread = (m.rewards?.max_spread ?? 0) / 100;
    if (m.tokens.length < 2) continue;

    candidates.push({
      conditionId: m.condition_id,
      question: m.question,
      endDate,
      daysToExpiry,
      yesTokenId: m.tokens[0].token_id,
      noTokenId: m.tokens[1].token_id,
      totalDailyRewards,
      minSize,
      maxSpread,
    });
  }

  console.log(`${candidates.length} candidates after filtering`);

  return candidates;
}
