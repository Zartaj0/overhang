# Overhang — Exit Intelligence for Solana Memes

Live app: https://overhang-five.vercel.app  
Telegram bot: @OverhangBot

## What it does
Analyzes any Solana token and tells you how to exit without wrecking the price.
Fetches 8 live Birdeye endpoints, computes slippage/overhang score, gives a staged exit plan.

## Stack
- Next.js 14 App Router, TypeScript
- Vercel (Edge runtime for API routes)
- Birdeye Solana API (free tier)
- Telegram Bot API (webhook)

## Environment variables (Vercel)
- `BIRDEYE_API_KEY` — Birdeye API key
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `NEXT_PUBLIC_BASE_URL` — https://overhang-five.vercel.app

## Key files
- `lib/birdeye.ts` — all Birdeye API calls (8 endpoints)
- `lib/score.ts` — scoring engine (`computeOverhang`)
- `app/page.tsx` — main UI with `TokenSearch` component
- `app/api/analyze/route.ts` — main analysis endpoint
- `app/api/tokens/route.ts` — token list/search (top-50 by 24h volume)
- `app/api/telegram/route.ts` — Telegram bot webhook handler
- `app/api/og/route.ts` — OpenGraph image

## Birdeye free tier gotchas
- Use `limit=50` for `/defi/txs/token` — 100 silently returns empty
- `/defi/token_security` returns 401 on free tier — wrapped in try/catch, returns `{}`
- Volume field is `v24hUSD` not `volume24h` on token overview
- Trade objects don't have `volumeUsd` — compute from `quote.uiAmount * quote.price`
- Rate limit 429: retry after 1.2s (handled in `lib/birdeye.ts` `get()`)
- Birdeye token URL format: `https://birdeye.so/token/<address>?chain=solana`
- Wallet URL format: `https://birdeye.so/wallet/<address>?chain=solana` (not `/profile/`)

## Deploy
```bash
vercel --prod
```

## Telegram webhook setup (one-time)
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://overhang-five.vercel.app/api/telegram"
```
