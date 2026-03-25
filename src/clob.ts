import pLimit from "p-limit";
import { CONFIG } from "./config";
import { CandidateMarket, ScoredMarket } from "./types";

interface OrderbookLevel {
  price: number;
  size: number;
}

interface Orderbook {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchOrderbook(tokenId: string, retries = 3): Promise<Orderbook> {
  const url = `${CONFIG.CLOB_API}/book?token_id=${tokenId}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    if (res.status === 429 && attempt < retries) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`CLOB API error: ${res.status}`);
    const data: any = await res.json();
    return {
      bids: (data.bids ?? []).map((b: any) => ({ price: parseFloat(b.price), size: parseFloat(b.size) })),
      asks: (data.asks ?? []).map((a: any) => ({ price: parseFloat(a.price), size: parseFloat(a.size) })),
    };
  }
  throw new Error("CLOB API: max retries exceeded");
}

function calcMidpoint(book: Orderbook): number {
  const bestBid = book.bids.length > 0 ? Math.max(...book.bids.map(b => b.price)) : null;
  const bestAsk = book.asks.length > 0 ? Math.min(...book.asks.map(a => a.price)) : null;

  if (bestBid !== null && bestAsk !== null) return (bestBid + bestAsk) / 2;
  if (bestBid !== null) return bestBid;
  if (bestAsk !== null) return bestAsk;
  return 0.5;
}

function calcTotalSize(book: Orderbook, midpoint: number, maxSpread: number): number {
  const lowerBound = midpoint - maxSpread;
  const upperBound = midpoint + maxSpread;

  const bidSize = book.bids
    .filter(b => b.price >= lowerBound)
    .reduce((s, b) => s + b.size, 0);
  const askSize = book.asks
    .filter(a => a.price <= upperBound)
    .reduce((s, a) => s + a.size, 0);

  return bidSize + askSize;
}

export async function analyzeOrderbooks(candidates: CandidateMarket[]): Promise<ScoredMarket[]> {
  const limit = pLimit(CONFIG.CONCURRENCY_LIMIT);
  let done = 0;
  const total = candidates.length;

  const results: (ScoredMarket | null)[] = await Promise.all(
    candidates.map(market =>
      limit(async (): Promise<ScoredMarket | null> => {
        try {
          const [yesBook, noBook] = await Promise.all([
            fetchOrderbook(market.yesTokenId),
            fetchOrderbook(market.noTokenId),
          ]);

          const midpoint = calcMidpoint(yesBook);
          if (midpoint < CONFIG.MIN_MIDPOINT || midpoint > CONFIG.MAX_MIDPOINT) return null;

          const yesTotalSize = calcTotalSize(yesBook, midpoint, market.maxSpread);
          const noMidpoint = 1 - midpoint;
          const noTotalSize = calcTotalSize(noBook, noMidpoint, market.maxSpread);
          const existingTotalSize = yesTotalSize + noTotalSize;
          const rewardPerDollar = market.totalDailyRewards / (existingTotalSize + market.minSize);

          return {
            ...market,
            midpoint,
            yesTotalSize,
            noTotalSize,
            existingTotalSize,
            rewardPerDollar,
          };
        } catch (err) {
          console.warn(`[SKIP] ${market.question.slice(0, 50)}: ${err}`);
          return null;
        } finally {
          done++;
          if (done % 100 === 0 || done === total) {
            process.stdout.write(`\rAnalyzing orderbooks: ${done}/${total}`);
          }
        }
      })
    )
  );

  console.log(); // newline after progress

  const scored = results.filter(Boolean) as ScoredMarket[];
  console.log(`${scored.length} markets scored after orderbook analysis`);

  return scored.sort(
    (a, b) => b.rewardPerDollar - a.rewardPerDollar || a.minSize - b.minSize
  );
}
