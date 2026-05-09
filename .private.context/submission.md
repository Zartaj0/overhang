# Superteam Submission — Overhang

## Competition
Birdeye BIP Sprint 3 | deadline May 9, 2026 | winners May 11

---

## SHIP CHECKLIST (do in order)

### Step 1 — Local test (15 min)
```bash
cd overhang
npm install
cp .env.example .env.local
# Set BIRDEYE_API_KEY=your_key in .env.local
npm run dev
# Open localhost:3000 — test with BONK, WIF, POPCAT buttons
```

### Step 2 — GitHub (5 min)
```bash
git init
git add -A
git commit -m "feat: Overhang v1 — exit intelligence for Solana memes"
gh repo create overhang --public
git push origin main
```

### Step 3 — Vercel deploy (5 min)
```bash
npm i -g vercel
vercel  # follow prompts
# In Vercel dashboard → Settings → Environment Variables, add:
#   BIRDEYE_API_KEY = your key
#   NEXT_PUBLIC_BASE_URL = https://your-project.vercel.app
vercel --prod
```

### Step 4 — X thread (post BEFORE submitting — judges check BIP activity)

**Tweet 1 — Hook:**
```
Most Solana traders die on the EXIT, not the entry.

I built a @birdeye_data-powered tool that tells you exactly:
→ How much you can safely put in
→ Who's about to dump on you
→ What your staged exit should look like

Introducing Overhang 🧵 #BirdeyeAPI #BuildInPublic
```
[attach screenshot of the app with a token analyzed]

**Tweet 2 — Problem:**
```
The problem nobody talks about:

You find a token early. You buy $3K.

But 3 insiders + the bundler are sitting above you with 10x profit.
The second you try to exit — they exit THROUGH you.

You were their exit. You never knew.
```

**Tweet 3 — Solution:**
```
Overhang fixes this.

Paste any Solana token → get:

💧 Safe Size — max position with <3% slippage (real AMM math)
🐋 Whale alerts — large sells detected in last 60min
📊 Volume-weighted sell pressure (not just tx count)
📋 Staged exit plan sized to the actual pool depth

[screenshot of position simulator]
```

**Tweet 4 — Technical:**
```
Built on 8 live @birdeye_data endpoints running in parallel:

→ /defi/token_overview — price, liquidity, volume
→ /defi/token_security — mint/freeze authority, creator flags
→ /defi/v3/token/holder — top-20 holder distribution
→ /defi/txs/token — last 100 trades (volume-weighted pressure)
→ /defi/v3/ohlcv — 4h price sparkline
→ /defi/v3/token/exit-liquidity — Birdeye's own safe exit size (NEW)
→ /wallet/v2/pnl — are top holders sitting on unrealized gains? (NEW)
→ /defi/v3/token/market-data — DEX liquidity breakdown (NEW)

Safe size = Birdeye exit-liquidity API first, xyk AMM fallback.
Telegram bot available — /analyze <address> works inside any group.
```

**Tweet 5 — CTA:**
```
The Position Simulator is the feature I haven't seen anywhere else:

Enter your position size → see exact entry slippage, exit slippage,
total round-trip cost in $, and what % the token needs to move just
for you to break even.

Open source. Free.
GitHub: [link]
Try it: [vercel link]

#Solana @birdeye_data
```

### Step 5 — Superteam submission form

**Project Name:** Overhang

**One-liner:**
Birdeye-powered exit intelligence for Solana — Safe Size, Whale Alerts, and a staged Exit Plan before you ape.

**Description:**
Most Solana traders die on the EXIT, not the entry. Overhang answers the one question nobody else does: "How much can I actually put in and still get out cleanly?" Paste any token address → get an Overhang Score (0–100) powered by 8 Birdeye endpoints running in parallel, a Safe Size sourced from Birdeye's own exit-liquidity API (with xyk AMM fallback), Whale PnL Intelligence (are top holders sitting on unrealized gains?), volume-weighted sell pressure, whale transaction alerts, DEX liquidity breakdown, a visual holder distribution stack, and a staged Exit Plan with per-tranche slippage estimates. The Position Simulator lets you enter any dollar amount and see exact entry/exit slippage costs and break-even price requirement in real time. Also ships a Telegram bot — use /analyze <address> directly inside any Solana trading group.

**APIs used:** /defi/token_overview · /defi/token_security · /defi/v3/token/holder · /defi/txs/token · /defi/v3/ohlcv · /defi/v3/token/exit-liquidity · /wallet/v2/pnl · /defi/v3/token/market-data

**Live demo:** [your Vercel URL]
**GitHub:** [your GitHub URL]
**X thread:** [link to tweet 1]

---

## Why This Wins Each Pillar

| Pillar | Evidence |
|---|---|
| **Utility** | Position Simulator is a unique, directly-actionable feature no competing tool has |
| **Technical Depth** | 8 endpoints in parallel, Birdeye exit-liquidity API, holder PnL via /wallet/v2/pnl, real AMM math, volume-weighted scoring, whale detection, DEX breakdown |
| **Presentation** | OG share cards, clean dark UI, visual holder stack, animated score ring, exitLiquiditySource badge |
| **Community** | Telegram bot (/analyze in any group), X share generates rich preview card + tweetable text with pre-filled @birdeye_data |

---

## What's In The Build

### New vs Sprint 1 winners
- RugBurn: rug scanner → Overhang: *exit* intelligence (different question entirely)
- ZeroSniper: risk score UI → Overhang: *actionable exit plan* with real math
- Smart Bird: signal bot → Overhang: *position-aware slippage simulation*

### Key differentiators
1. **Position Simulator** — type your $$ → see exact round-trip slippage cost + break-even % needed
2. **Volume-weighted sell pressure** — a single $20K whale sell outweighs 50 retail buys; we measure that correctly
3. **Whale tx detection** — flags individual large sells in last hour (threshold: 2% of pool depth)
4. **Whale PnL Intelligence** — calls `/wallet/v2/pnl` for top 3 holders; if they're in unrealized profit, they're an overhead sell risk — shown in USD
5. **Birdeye exit-liquidity API** — uses `/defi/v3/token/exit-liquidity` as primary source for safe exit size, with AMM fallback; displays "Birdeye API" vs "AMM Computed" badge
6. **DEX breakdown** — shows how liquidity is split across Raydium, Orca, Meteora etc.; warns if >80% on one DEX
7. **Holder distribution visual** — color-coded stack showing whale vs retail proportion
8. **OG image generation** — shareable token analysis card for X (1200x630)
9. **Telegram bot** — /analyze <address> works inside any Solana trading group, returns full analysis
10. **Real AMM math** — safe size fallback: `safeSize = (0.03 × liq/2) / (1 - 0.03)`
