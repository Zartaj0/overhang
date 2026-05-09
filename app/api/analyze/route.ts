import { NextRequest, NextResponse } from 'next/server'
import {
  getTokenOverview,
  getTokenSecurity,
  getTokenHolders,
  getTokenTrades,
  getOHLCV,
  getExitLiquidity,
  getWalletPnLForToken,
  getTokenMarkets,
} from '@/lib/birdeye'
import { computeOverhang, fmtUSD } from '@/lib/score'

export const runtime = 'edge'

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')?.trim()

  if (!address) {
    return NextResponse.json({ error: 'Missing address param' }, { status: 400 })
  }
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json({ error: 'Invalid Solana address format' }, { status: 400 })
  }
  if (!process.env.BIRDEYE_API_KEY) {
    return NextResponse.json({ error: 'BIRDEYE_API_KEY not configured on server' }, { status: 500 })
  }

  try {
    // ── Phase 1a: Core token data (3 calls) ───────────────────────────────────
    const [overview, security, holders] = await Promise.all([
      getTokenOverview(address),
      getTokenSecurity(address),
      getTokenHolders(address, 20),
    ])

    // ── Phase 1b: Market data (4 calls) — staggered to avoid 429 ─────────────
    const [trades, ohlcv, exitLiq, markets] = await Promise.all([
      getTokenTrades(address, 100),
      getOHLCV(address),
      getExitLiquidity(address),
      getTokenMarkets(address),
    ])

    // ── Phase 2: Wallet PnL for top 3 holders (sequential after phase 1) ─────
    // These tell us whether top holders are sitting on unrealized gains (= dump risk)
    const top3Wallets = (holders.items ?? []).slice(0, 3).map(h => h.owner)
    const holderPnLs = await Promise.all(
      top3Wallets.map(wallet => getWalletPnLForToken(wallet, address))
    )
    // Pad to 5 slots so score.ts can always index [0]–[4] safely
    while (holderPnLs.length < 5) holderPnLs.push(null)

    const result = computeOverhang(overview, security, holders, trades, ohlcv, exitLiq, holderPnLs, markets)

    // ── Build OG image URL ───────────────────────────────────────────────────
    const sellPct = result.buyVol1h + result.sellVol1h > 0
      ? ((result.sellVol1h / (result.buyVol1h + result.sellVol1h)) * 100).toFixed(0)
      : '50'

    const ogParams = new URLSearchParams({
      symbol:    result.token.symbol ?? 'TOKEN',
      name:      result.token.name ?? '',
      score:     String(result.total),
      tier:      result.tier,
      tierLabel: result.tierLabel,
      safeSize:  fmtUSD(result.safeSize),
      top10:     result.topHolderPercent.toFixed(1),
      sellPct,
      liq:       fmtUSD(result.token.liquidity),
    })

    const enriched = {
      ...result,
      ogImageUrl: `/api/og?${ogParams.toString()}`,
    }

    return NextResponse.json(enriched, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[analyze]', message)
    return NextResponse.json(
      { error: `Data fetch failed: ${message}. Check your Birdeye API key and token address.` },
      { status: 502 }
    )
  }
}
