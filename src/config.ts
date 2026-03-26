export const CONFIG = {
  BUDGET_USD: 100,
  MAX_MARKETS: 10,
  MIN_DAILY_REWARDS: 20.0,
  MIN_DAYS_TO_EXPIRY: 5,
  MIN_MIDPOINT: 0.15,
  MAX_MIDPOINT: 0.85,
  CONCURRENCY_LIMIT: 5,

  GAMMA_API: "https://gamma-api.polymarket.com",
  CLOB_API: "https://clob.polymarket.com",
} as const;
