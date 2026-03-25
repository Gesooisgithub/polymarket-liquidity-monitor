# Polymarket LP Rewards Screener

Analyzes Polymarket markets to identify the best liquidity provider (LP) earning opportunities, distributing a fixed USDC budget across markets that maximize daily rewards.

**This is a monitoring-only tool** — it does not place orders, interact with any wallet, or require private keys.

## Requirements

- Node.js >= 18
- pnpm

## Setup

```bash
pnpm install
```

## Usage

```bash
npx ts-node src/screener.ts
```

## Configuration

Edit `src/config.ts`:

| Parameter | Default | Description |
|---|---|---|
| `BUDGET_USD` | 200 | Total USDC budget to allocate |
| `MAX_MARKETS` | 10 | Maximum number of selected markets |
| `MIN_DAILY_REWARDS` | 20.0 | Minimum rewards/day threshold to consider a market |
| `MIN_DAYS_TO_EXPIRY` | 3 | Discard markets expiring within N days |
| `MIN_MIDPOINT` | 0.15 | Discard markets with probability too low |
| `MAX_MIDPOINT` | 0.85 | Discard markets with probability too high |
| `CONCURRENCY_LIMIT` | 5 | Max parallel API calls to the CLOB |

## Ranking logic

1. Each market is scored by **reward per dollar invested** — markets with less competition and higher rewards score higher
2. Budget is allocated first to the most efficient markets (minSize each)
3. Remaining budget is redistributed by maximizing **marginal reward** — each additional dollar goes where it generates the highest reward increment

## Output

```
════════════════════════════════════════════════════════════════
  POLYMARKET LP SCREENER  —  2026-03-06 14:32:05
════════════════════════════════════════════════════════════════
  Budget: $200.00  |  Deployed: $200.00  |  Remaining: $0.00
  Markets: 6/10    |  Est. rewards/day: $45.00
────────────────────────────────────────────────────────────────
  #  Market                         Alloc    Rew/day   Competition
────────────────────────────────────────────────────────────────
  1  Trump signs bill...            $30      $20.00    EMPTY  ($0)
  2  Zelenskyy resigns...           $30      $10.00    EMPTY  ($0)
  3  Apple AR glasses...            $30      $5.00     EMPTY  ($0)
  4  S&P 6000...                    $50      $4.00     MED    ($100)
  5  Iran attacks Israel...         $30      $3.00     LOW    ($50)
  6  Musk ambassador...             $30      $3.00     EMPTY  ($0)
════════════════════════════════════════════════════════════════
```

| Column | Description |
|---|---|
| Market | Market name (truncated) |
| Alloc | Dollars allocated to this market |
| Rew/day | Estimated daily rewards |
| Competition | Competition level: EMPTY/LOW/MED/HIGH with total size |
