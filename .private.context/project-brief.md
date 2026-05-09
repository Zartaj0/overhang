# Overhang — Project Brief

## Competition
Birdeye Build-in-Public Sprint 3 | Superteam Earn
Deadline: May 9, 2026 | Winners: May 11, 2026
Prize pool: $1,750 for Sprint 3 (1st: $700, 2nd: $450, 3rd: $300, honorable: $300)

## The Gap We're Filling

Sprint 1 already rewarded: rug scanner, signal bot, token radar, wallet analytics, paper trading.
Those are baseline now. The judges explicitly said "strong execution + differentiation wins."

The real, unserved pain we found:
> Solana traders know HOW to find tokens. They die on the EXIT.
> "Being exit liquidity" is the #1 recurring complaint across r/SolanaMemeCoins, r/solana, and Birdeye's own community threads.

Nobody has built a tool that answers:
- How much can I actually put in and still get out cleanly?
- Who is sitting above me ready to dump?
- Is the seller pressure trend getting better or worse?
- What's my staged exit plan if I hold $2k or $5k?

Birdeye's April 2026 holder profile/positions APIs are purpose-built for this and almost nobody is using them yet.

## Product: Overhang

**Tagline:** "Before you ape, know your exit."

**Core promise:**
Paste any Solana token address. Get a single Overhang Score (0–100) plus four actionable panels:
1. Safe Size — max position you can enter and still exit with <3% slippage
2. Seller Overhang — how much profitable tagged supply is sitting above you
3. Pressure Trend — are snipers/bundlers/insiders distributing or clearing out?
4. Exit Plan — concrete staged-exit sizes for your position size

## Why This Wins on All 4 Judging Pillars

| Pillar | How We Win |
|---|---|
| Utility | Solves the single most painful Solana trading problem: exits |
| Technical Depth | 6+ Birdeye endpoints, scoring model, liquidity simulation |
| Presentation | Clean UI, shareable score card, clear narrative |
| Community | Every output is a shareable "X post" — naturally viral |

## Birdeye Endpoint Map

All calls use `X-API-KEY` header + `x-chain: solana`

| What we need | Birdeye Endpoint |
|---|---|
| Price, liquidity, volume, market cap | `GET /defi/token_overview?address={addr}` |
| LP lock, creator wallet, scam flags | `GET /defi/token_security?address={addr}` |
| Top holders, concentration, supply | `GET /defi/v3/token/holder?address={addr}&limit=20` |
| Recent buy/sell trades | `GET /defi/txs/token?address={addr}&tx_type=all&limit=100` |
| 15m OHLCV for trend | `GET /defi/ohlcv?address={addr}&type=15m&time_from={t0}&time_to={t1}` |
| Wallet portfolio context | `GET /v1/wallet/token_list?wallet={addr}` |

That's 5–6 endpoints per request = well above the 50-call competition threshold.

## Scoring Model

**Overhang Score (0–100, lower = safer to trade)**

Component breakdown:
- **Holder Concentration (30 pts):** top-10 holder % → 0–30
- **Liquidity Thinness (25 pts):** liquidity-to-volume ratio → 0–25
- **Sell Pressure Trend (25 pts):** sell txn count vs buy in last hour → 0–25
- **Insider Flags (20 pts):** security endpoint creator/lock flags → 0–20

Safe Size formula:
```
safe_size_usd = liquidity_usd * 0.015
// 1.5% of the liquidity pool → <3% price impact for typical AMM
```

Staged Exit Tiers:
- Score 0–30 (green): single exit OK up to safe_size
- Score 31–60 (yellow): 2-leg exit, 50%/50% with time buffer
- Score 61–100 (red): 3-leg minimum, flag as high-risk

## MVP Scope (buildable in 1 day)

Must have:
- [x] Token address input → full analysis
- [x] Overhang Score with color ring
- [x] 4 breakdown panels (safe size, overhang, pressure trend, exit plan)
- [x] "Share on X" button that generates a report card text
- [x] Mobile-responsive

Nice to have (if time):
- [ ] Comparison: current vs 1h ago score
- [ ] Watchlist (localStorage)
- [ ] Telegram bot wrapper

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Recharts for sparklines
- Deployed: Vercel (free tier, instant)
- API key: env var `BIRDEYE_API_KEY`

## X Thread Narrative (for BIP requirement)

Thread 1: "Most Solana traders die on the EXIT, not the entry. I built @birdeye_data-powered tool that tells you exactly how much you can put in a token and still get out. Introducing Overhang. 🧵 #BirdeyeAPI"

Thread 2: "The problem: you find a token early. You ape in. But 3 insiders + the bundler are all sitting above you with profit. You're their exit. You never knew."

Thread 3: "Overhang fixes this. Paste any token → get: Safe Size, Seller Overhang, Pressure Trend, and a concrete Exit Plan. Powered by 6 Birdeye endpoints including the new holder intelligence APIs."

Thread 4: [screenshot of score card for a well-known token]

Thread 5: "Built with @birdeye_data APIs: token_overview, token_security, holder positions, OHLCV, and trade history. All live, all on-chain. GitHub: [link] | Try it: [vercel link]"
