# Polymarket LP Rewards Screener

Analizza i mercati Polymarket per identificare le migliori opportunita di guadagno come liquidity provider (LP), distribuendo un budget fisso di USDC sui mercati che massimizzano le rewards giornaliere.

**Questo e esclusivamente un modulo di monitoraggio** — non piazza ordini, non interagisce con il wallet, non richiede chiavi private.

## Requisiti

- Node.js >= 18
- pnpm

## Setup

```bash
pnpm install
```

## Esecuzione singola

```bash
npx ts-node src/screener.ts
```

## Parametri configurabili

Modifica `src/config.ts`:

| Parametro | Default | Descrizione |
|---|---|---|
| `BUDGET_USD` | 200 | Budget totale in USDC da allocare |
| `MAX_MARKETS` | 10 | Numero massimo di mercati selezionati |
| `MIN_DAILY_REWARDS` | 20.0 | Soglia minima di rewards/day per considerare un mercato |
| `MIN_DAYS_TO_EXPIRY` | 3 | Scarta mercati che scadono entro N giorni |
| `MIN_MIDPOINT` | 0.15 | Scarta mercati con probabilita troppo bassa |
| `MAX_MIDPOINT` | 0.85 | Scarta mercati con probabilita troppo alta |
| `CONCURRENCY_LIMIT` | 5 | Max chiamate API parallele alla CLOB |

## Logica di ranking

1. Ogni mercato viene valutato per **reward per dollaro investito** — mercati con meno competizione e piu rewards hanno punteggio piu alto
2. Il budget viene allocato prima ai mercati piu efficienti (minSize per ciascuno)
3. Il budget rimanente viene redistribuito massimizzando il **reward marginale** — ogni dollaro aggiuntivo va dove genera il massimo incremento di rewards

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

| Colonna | Descrizione |
|---|---|
| Market | Nome del mercato (troncato) |
| Alloc | Dollari allocati su questo mercato |
| Rew/day | Rewards giornaliere stimate |
| Competition | Livello di competizione: EMPTY/LOW/MED/HIGH con size totale |
