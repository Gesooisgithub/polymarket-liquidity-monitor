import * as readline from "readline";
import { fetchAndFilter } from "./markets";
import { analyzeOrderbooks } from "./clob";
import { allocate } from "./allocator";
import { CONFIG } from "./config";
import { AllocatedMarket, ScoredMarket } from "./types";

function competitionLabel(size: number): string {
  if (size === 0) return `EMPTY  (0 sh)`;
  if (size < 100) return `LOW    (${size.toFixed(0)} sh)`;
  if (size < 500) return `MED    (${size.toFixed(0)} sh)`;
  return `HIGH   (${size.toFixed(0)} sh)`;
}

function truncate(str: string, len: number): string {
  return str.length <= len ? str.padEnd(len) : str.slice(0, len - 3) + "...";
}

function printDiagnostics(scored: ScoredMarket[]): void {
  const dash = "\u2500".repeat(64);

  // 1. Competition distribution
  let empty = 0, low = 0, med = 0, high = 0;
  for (const m of scored) {
    if (m.existingTotalSize === 0) empty++;
    else if (m.existingTotalSize < 100) low++;
    else if (m.existingTotalSize < 500) med++;
    else high++;
  }

  console.log();
  console.log(`Competition distribution (${scored.length} scored markets):`);
  console.log(`  EMPTY  ($0):       ${String(empty).padStart(3)} markets`);
  console.log(`  LOW    (<$100):    ${String(low).padStart(3)} markets`);
  console.log(`  MED    (<$500):    ${String(med).padStart(3)} markets`);
  console.log(`  HIGH   ($500+):    ${String(high).padStart(3)} markets`);

  // 2. maxSpread distribution sorted by rewardPerDollar DESC
  const sorted = [...scored].sort((a, b) => b.rewardPerDollar - a.rewardPerDollar);

  console.log();
  console.log(`maxSpread distribution (top scored markets):`);
  for (const m of sorted) {
    const spread = `spread=${m.maxSpread.toFixed(3)}`;
    const minSize = `minSize=$${m.minSize.toFixed(0)}`;
    const competition = `competition=$${m.existingTotalSize.toFixed(0)}`;
    const rewards = `rewards=$${m.totalDailyRewards.toFixed(2)}/day`;
    const question = truncate(m.question, 40);
    console.log(`  ${spread}  ${minSize.padEnd(12)}  ${competition.padEnd(20)}  ${rewards.padEnd(20)}  ${question}`);
  }
  console.log(dash);
}

function printResults(allocated: AllocatedMarket[]): void {
  const now = new Date();
  const ts = now.toISOString().replace("T", " ").slice(0, 19);

  const totalDeployed = allocated.reduce((s, m) => s + m.allocatedSize, 0);
  const totalRewards = allocated.reduce((s, m) => s + m.estimatedDailyRewards, 0);
  const remaining = CONFIG.BUDGET_USD - totalDeployed;

  const sorted = allocated.sort((a, b) => b.estimatedDailyRewards - a.estimatedDailyRewards);
  const maxNameLen = Math.max(6, ...sorted.map(m => m.question.length));
  const tableWidth = maxNameLen + 52;

  const line = "\u2550".repeat(tableWidth);
  const dash = "\u2500".repeat(tableWidth);

  console.log();
  console.log(line);
  console.log(`  POLYMARKET LP SCREENER  \u2014  ${ts}`);
  console.log(line);
  console.log(
    `  Budget: $${CONFIG.BUDGET_USD.toFixed(2)}  |  Deployed: $${totalDeployed.toFixed(2)}  |  Remaining: $${remaining.toFixed(2)}`
  );
  console.log(
    `  Markets: ${allocated.length}/${CONFIG.MAX_MARKETS}    |  Est. rewards/day: $${totalRewards.toFixed(2)}`
  );

  console.log(`  #  ${"Market".padEnd(maxNameLen)} minSz  Alloc    Rew/day   Competition (sh)`);
  console.log(dash);

  sorted.forEach((m, i) => {
      const num = String(i + 1).padStart(2);
      const name = m.question.padEnd(maxNameLen);
      const alloc = `$${m.allocatedSize.toFixed(0)}`.padStart(6);
      const rew = `$${m.estimatedDailyRewards.toFixed(2)}`.padStart(9);
      const comp = competitionLabel(m.existingTotalSize);
      const minSz = `$${m.minSize.toFixed(0)}`.padStart(5);
      console.log(`  ${num}  ${name} ${minSz}  ${alloc}    ${rew}   ${comp}`);
    });

  console.log(line);
  console.log();
}

async function run() {
  const candidates = await fetchAndFilter();
  const scored = await analyzeOrderbooks(candidates);
  printDiagnostics(scored);
  const allocated = allocate(scored);
  printResults(allocated);
}

function promptBudget(currentBudget: number): Promise<number> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Enter budget in USD (press Enter for $${currentBudget}): `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (!trimmed) return resolve(currentBudget);
      const parsed = parseFloat(trimmed);
      if (!isFinite(parsed) || parsed <= 0) {
        console.log(`Invalid budget — keeping $${currentBudget}.`);
        return resolve(currentBudget);
      }
      resolve(parsed);
    });
  });
}

function waitForKey(): Promise<"r" | "q"> {
  return new Promise((resolve) => {
    console.log("Press R to restart or Q to quit.");
    const { stdin } = process;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    const onData = (buf: Buffer) => {
      const ch = buf.toString().toLowerCase();
      if (ch === "r" || ch === "q") {
        stdin.removeListener("data", onData);
        if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        resolve(ch);
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    CONFIG.BUDGET_USD = await promptBudget(CONFIG.BUDGET_USD);
    await run();
    const key = await waitForKey();
    if (key === "q") {
      console.log("Bye!");
      process.exit(0);
    }
    console.log("\nRestarting...\n");
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
