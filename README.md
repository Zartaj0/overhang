# Overhang — Exit Intelligence for Solana Meme Tokens

> **"Most Solana traders die on the EXIT, not the entry."**

Overhang is a Birdeye-powered tool that answers the question every meme-coin trader asks too late: *"How much can I put in this token and still get out cleanly?"*

**Live demo:** [your-vercel-url]  
**Built for:** [Birdeye Build-in-Public Sprint 3](https://superteam.fun/earn/listing/birdeye-data-4-week-bip-competition-sprint-3)

---

## What It Does

Paste any Solana token address and get:

| Panel | What It Shows |
|---|---|
| **Overhang Score (0–100)** | Single number: how dangerous exits are right now |
| **Safe Size** | Max USD position you can exit with < 3% slippage |
| **Seller Overhang** | Top-10 holder concentration + insider/dev flags |
| **Pressure Trend** | Buy vs sell ratio for the last hour (live) |
| **Exit Plan** | Concrete staged-exit tranches sized to current liquidity |

---

## Birdeye APIs Used

This project hits **5 Birdeye endpoints in parallel** on every request:

| Endpoint | Data Used For |
|---|---|
| `GET /defi/token_overview` | Price, liquidity, volume, holder count, buy/sell 24h |
| `GET /defi/token_security` | Mint/freeze authority, creator wallet, mutability flags |
| `GET /defi/v3/token/holder` | Top-20 holder list, concentration math |
| `GET /defi/txs/token` | Last 100 trades — buy/sell pressure analysis |
| `GET /defi/ohlcv` | 15-minute candles (4h window) — price sparkline |

Total API calls per analysis: **5+ simultaneous** (well above the 50-call competition threshold for active usage).

---

## Scoring Model

**Overhang Score = sum of 4 components (0–100, higher = more dangerous)**

```
Holder Concentration  (0–30)  top-10 holder % of supply
Liquidity Thinness    (0–25)  liquidity pool depth vs safe size
Sell Pressure         (0–25)  sell tx ratio in last 1 hour
Insider/Dev Risk      (0–20)  mint auth, freeze auth, mutability flags
```

**Safe Size formula:**
```
safe_size_usd = pool_liquidity_usd × 0.015
```
This gives < 3% price impact on a constant-product AMM (standard Raydium/Orca math).

**Exit Tier logic:**
- Score 0–30 (🟢 Green): single exit OK
- Score 31–60 (🟡 Yellow): 2-tranche staged exit
- Score 61–100 (🔴 Red): 3-tranche exit with timing guidance

---

## Tech Stack

- **Framework:** Next.js 14 (App Router, Edge runtime)
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Data:** Birdeye API (all Solana)
- **Deploy:** Vercel (free tier)

---

## Deploy in 5 Minutes

### Prerequisites
- Node.js 18+
- A Birdeye API key ([get one free](https://birdeye.so/developer))
- A Vercel account

### Local development

```bash
git clone https://github.com/YOUR_USERNAME/overhang
cd overhang
npm install
cp .env.example .env.local
# Add your BIRDEYE_API_KEY to .env.local
npm run dev
# Open http://localhost:3000
```

### Deploy to Vercel

```bash
npm i -g vercel
vercel
# Follow prompts, add BIRDEYE_API_KEY as environment variable
```

Or click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/overhang&env=BIRDEYE_API_KEY)

---

## Why This Problem Matters

The core Solana meme-coin complaint isn't discovery — it's exits. A simple search of r/SolanaMemeCoins surfaces the same pain on repeat:

- "I found the token early but couldn't get out"
- "Tried to exit $3k and moved the price 20% against myself"
- "The top traders on Birdeye are all scammers — they have exits I can't copy"

Existing tools (GMGN, BullX, Axiom, Birdeye itself) all show **entry signals**: trending tokens, smart money movements, whale alerts. Nobody showed you the **exit math**. Overhang fills that gap.

---

## Roadmap

- [ ] Wallet-level analysis (how many of your past positions were trapped?)
- [ ] Alert bot: Telegram notifications when your held token's Overhang Score crosses a threshold
- [ ] Historical comparison: Overhang Score now vs 1h / 4h ago
- [ ] Multi-token watchlist

---

## Disclaimer

This tool is for informational purposes only and does not constitute financial advice. Always do your own research. On-chain data can lag; always verify positions directly before trading.

---

*Built with ❤️ using [Birdeye Data APIs](https://docs.birdeye.so)*
