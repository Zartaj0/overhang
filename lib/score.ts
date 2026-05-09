import type {
  TokenOverview, TokenSecurity, HolderList,
  TradeList, OHLCVData, ExitLiquidity,
  WalletTokenPnL, TokenMarketsResponse
} from './birdeye'

export interface ScoreBreakdown {
  holderOverhang:   { score: number; max: number; label: string; detail: string }
  exitLiquidity:    { score: number; max: number; label: string; detail: string }
  sellPressure:     { score: number; max: number; label: string; detail: string }
  contractRisk:     { score: number; max: number; label: string; detail: string }
}

export interface HolderWithPnL {
  address: string
  holdPct: number          // % of supply
  unrealizedPnl: number    // USD — null means not fetchable
  unrealizedPct: number    // % gain on position
  currentValue: number     // USD value of their holding
  isInProfit: boolean
  label: string            // "Whale 1", "Whale 2" etc.
}

export interface WhaleTx {
  side: 'buy' | 'sell'
  volumeUsd: number
  minsAgo: number
}

export interface HolderBand {
  label: string; pct: number; color: string
}

export interface ExitStep {
  tranche: string; size: string; timing: string; note: string; slippagePct?: number
}

export interface OverhangResult {
  total: number
  tier: 'green' | 'yellow' | 'red'
  tierLabel: string
  breakdown: ScoreBreakdown
  // Exit liquidity (from Birdeye's own endpoint)
  safeSize: number              // USD — max exit under 3% slippage
  exitLiquiditySource: 'birdeye_api' | 'computed_fallback'
  // Holder intelligence
  topHolderPercent: number
  holdersInProfit: number       // count of top holders with unrealized gains
  totalHolderOverhang: number   // USD of unrealized gains sitting in top holders
  holderPnLs: HolderWithPnL[]
  // Pressure
  buyCount1h: number
  sellCount1h: number
  buyVol1h: number
  sellVol1h: number
  whaleTxs: WhaleTx[]
  // Visuals
  holderBands: HolderBand[]
  exitPlan: ExitStep[]
  priceSparkline: { time: number; price: number }[]
  // DEX breakdown
  dexBreakdown: { name: string; liquidityPct: number; liquidity: number }[]
  token: {
    symbol: string; name: string; price: number
    priceChange24h: number; liquidity: number; volume24h: number
    marketCap: number; logoURI?: string; holders: number
  }
}

// ─── AMM fallback math (used only if Birdeye exit-liquidity endpoint fails) ──
export function calcSlippage(tradeUsd: number, poolLiqUsd: number): number {
  if (poolLiqUsd <= 0) return 1
  return tradeUsd / (poolLiqUsd / 2 + tradeUsd)
}

export function calcSafeSize(poolLiqUsd: number, maxSlip = 0.03): number {
  const reserve = poolLiqUsd / 2
  return (maxSlip * reserve) / (1 - maxSlip)
}

// ─── Position simulator (stays in score.ts for reuse in UI) ──────────────────
export interface SimResult {
  entrySlippagePct: number; entrySlippageUsd: number
  exitSlippagePct: number;  exitSlippageUsd: number
  totalCostUsd: number;     totalCostPct: number
  breakEvenMoveNeeded: number
  verdict: 'ok' | 'tight' | 'risky' | 'extreme'
}

export function simulatePosition(positionUsd: number, poolLiqUsd: number): SimResult {
  const entrySlippagePct = calcSlippage(positionUsd, poolLiqUsd)
  const entrySlippageUsd = positionUsd * entrySlippagePct
  const adjustedLiq = Math.max(poolLiqUsd - positionUsd * 0.5, poolLiqUsd * 0.5)
  const exitSlippagePct  = calcSlippage(positionUsd, adjustedLiq)
  const exitSlippageUsd  = positionUsd * exitSlippagePct
  const totalCostUsd     = entrySlippageUsd + exitSlippageUsd
  const totalCostPct     = totalCostUsd / positionUsd
  const breakEvenMoveNeeded = totalCostPct * 100
  const verdict: SimResult['verdict'] =
    totalCostPct > 0.15 ? 'extreme' :
    totalCostPct > 0.08 ? 'risky' :
    totalCostPct > 0.03 ? 'tight' : 'ok'
  return { entrySlippagePct, entrySlippageUsd, exitSlippagePct, exitSlippageUsd,
           totalCostUsd, totalCostPct, breakEvenMoveNeeded, verdict }
}

// ─── Main scorer ──────────────────────────────────────────────────────────────
export function computeOverhang(
  overview:    TokenOverview,
  security:    TokenSecurity,
  holders:     HolderList,
  trades:      TradeList,
  ohlcv:       OHLCVData,
  exitLiq:     ExitLiquidity,
  holderPnLs:  (WalletTokenPnL | null)[],
  markets:     TokenMarketsResponse,
): OverhangResult {

  const liq = overview.liquidity ?? 0
  const vol = overview.volume24h ?? 0
  const price = overview.price ?? 0

  // ══ 1. Holder Overhang (0–35) ═════════════════════════════════════════════
  // Combines: concentration + whether they're in profit (new!)
  const top10Pct = security.top10HolderPercent
    ?? estimateConcentration(holders)

  let holderScore = 0
  const holderPnLDetails: HolderWithPnL[] = []
  let holdersInProfit = 0
  let totalHolderOverhang = 0   // total USD of unrealized gains in top holders

  // Base concentration score (0–20)
  if (top10Pct >= 70)       holderScore += 20
  else if (top10Pct >= 50)  holderScore += 15
  else if (top10Pct >= 35)  holderScore += 10
  else if (top10Pct >= 20)  holderScore += 5
  else                      holderScore += 1

  // Profitability bonus (0–15): are they in profit and likely to sell?
  const topHolders = (holders.items ?? []).slice(0, 5)
  const totalSupplyInTop = topHolders.reduce((s, h) => s + h.ui_amount, 0)

  topHolders.forEach((holder, i) => {
    const pnl = holderPnLs[i]
    const holdPct = estimateConcentration({ items: [holder], total: 1 }) *
                    (totalSupplyInTop > 0
                     ? topHolders.reduce((s,h)=>s+h.ui_amount,0) / (holders.items?.reduce((s,h)=>s+h.ui_amount,0) || 1)
                     : 0.1)
    const uPnl    = pnl?.unrealizedPnl ?? 0
    const uPct    = pnl?.unrealizedPnlPct ?? 0
    const curVal  = pnl?.currentValue ?? (holder.ui_amount * price)
    const inProfit = uPnl > 0

    if (inProfit) {
      holdersInProfit++
      totalHolderOverhang += uPnl
      // Each profitable whale adds risk
      holderScore += Math.min(3, Math.floor(uPct / 100))
    }

    holderPnLDetails.push({
      address: holder.owner,
      holdPct,
      unrealizedPnl: uPnl,
      unrealizedPct: uPct,
      currentValue: curVal,
      isInProfit: inProfit,
      label: `Whale ${i + 1}`,
    })
  })

  holderScore = Math.min(holderScore, 35)

  const profitableCount = holderPnLDetails.filter(h => h.isInProfit).length
  const holderDetail = profitableCount > 0
    ? `Top 10 hold ${top10Pct.toFixed(1)}% · ${profitableCount} of top 5 wallets in profit (${fmtUSD(totalHolderOverhang)} unrealized gains overhead)`
    : `Top 10 hold ${top10Pct.toFixed(1)}% · Top holders appear to be at a loss (less dump pressure)`

  // ══ 2. Exit Liquidity (0–30) ══════════════════════════════════════════════
  // Uses Birdeye's /defi/v3/token/exit-liquidity endpoint primarily
  let exitScore = 0
  let safeSize = 0
  let exitLiquiditySource: 'birdeye_api' | 'computed_fallback' = 'computed_fallback'
  let liqDetail = ''

  // Try to use Birdeye's dedicated exit liquidity API
  const birdeyeExitLiq = exitLiq.maxExitSizeUsd ?? exitLiq.exitLiquidity ?? exitLiq.liquidityUsd
  const depths = exitLiq.depths ?? []

  if (birdeyeExitLiq && birdeyeExitLiq > 0) {
    // Birdeye tells us directly what the max safe exit is
    safeSize = birdeyeExitLiq
    exitLiquiditySource = 'birdeye_api'

    if (safeSize > 100_000)      exitScore = 0
    else if (safeSize > 30_000)  exitScore = 6
    else if (safeSize > 10_000)  exitScore = 13
    else if (safeSize > 3_000)   exitScore = 20
    else if (safeSize > 500)     exitScore = 26
    else                         exitScore = 30

    liqDetail = `Birdeye exit-liquidity API: safe exit size $${fmtUSD(safeSize)} · pool depth $${fmtUSD(liq)}`
  } else if (depths.length > 0) {
    // Use depth curve from Birdeye
    const under3Pct = depths.filter(d => d.slippage <= 0.03)
    safeSize = under3Pct.length > 0
      ? Math.max(...under3Pct.map(d => d.amountUsd))
      : depths[0].amountUsd
    exitLiquiditySource = 'birdeye_api'
    exitScore = safeSize > 10000 ? 8 : safeSize > 3000 ? 16 : safeSize > 500 ? 24 : 30
    liqDetail = `Birdeye depth curve: $${fmtUSD(safeSize)} exit stays under 3% slippage`
  } else {
    // Fallback to our own AMM math
    safeSize = calcSafeSize(liq, 0.03)
    exitLiquiditySource = 'computed_fallback'
    if (liq > 1_000_000)     exitScore = 2
    else if (liq > 300_000)  exitScore = 7
    else if (liq > 100_000)  exitScore = 13
    else if (liq > 30_000)   exitScore = 20
    else if (liq > 5_000)    exitScore = 26
    else                     exitScore = 30
    liqDetail = `Pool $${fmtUSD(liq)} · Computed safe size $${fmtUSD(safeSize)} (xyk AMM formula)`
  }

  // Volume churn flag
  if (vol > liq * 3 && liq > 0) {
    exitScore = Math.min(exitScore + 2, 30)
    liqDetail += ' · High churn: 24h vol > 3× liquidity'
  }

  // ══ 3. Sell Pressure — volume-weighted (0–25) ═════════════════════════════
  const now = Date.now() / 1000
  const recentTrades = (trades.items ?? []).filter(t => t.blockUnixTime >= now - 3600)
  const buyCount  = recentTrades.filter(t => t.side === 'buy').length
  const sellCount = recentTrades.filter(t => t.side === 'sell').length
  const buyVol    = recentTrades.filter(t => t.side === 'buy').reduce((s,t) => s+(t.volumeUsd||0), 0)
  const sellVol   = recentTrades.filter(t => t.side === 'sell').reduce((s,t) => s+(t.volumeUsd||0), 0)
  const totalVol1h = buyVol + sellVol
  const sellVolRatio = totalVol1h > 0 ? sellVol / totalVol1h : 0.5

  let pressScore = 0
  if (sellVolRatio < 0.30)      pressScore = 0
  else if (sellVolRatio < 0.45) pressScore = 5
  else if (sellVolRatio < 0.60) pressScore = 12
  else if (sellVolRatio < 0.75) pressScore = 20
  else                          pressScore = 25

  const WHALE_THRESHOLD = Math.max(liq * 0.02, 5000)
  const whaleTxs: WhaleTx[] = recentTrades
    .filter(t => (t.volumeUsd||0) >= WHALE_THRESHOLD)
    .slice(0, 5)
    .map(t => ({ side: t.side, volumeUsd: t.volumeUsd||0, minsAgo: Math.round((now - t.blockUnixTime)/60) }))

  const whaleSells = whaleTxs.filter(w => w.side === 'sell')
  pressScore = Math.min(pressScore + whaleSells.length * 2, 25)

  const pressDetail = `${fmtPct(sellVolRatio)} of 1h volume is sells · $${fmtUSD(buyVol)} bought vs $${fmtUSD(sellVol)} sold`
    + (whaleSells.length > 0 ? ` · ⚠️ ${whaleSells.length} whale sell(s) detected` : '')

  // ══ 4. Contract Risk (0–10) ══════════════════════════════════════════════
  let contractScore = 0
  const flags: string[] = []
  if (security.mintAuthority)    { contractScore += 5; flags.push('Mint authority active') }
  if (security.freezeAuthority)  { contractScore += 3; flags.push('Freeze authority active') }
  if (security.transferFeeEnable){ contractScore += 2; flags.push('Transfer fee enabled') }
  if (security.isMutable)        { contractScore += 1; flags.push('Metadata mutable') }
  contractScore = Math.min(contractScore, 10)
  const contractDetail = flags.length > 0 ? flags.join(' · ') : 'No critical contract flags'

  // ══ Total ═════════════════════════════════════════════════════════════════
  const total = Math.min(holderScore + exitScore + pressScore + contractScore, 100)
  const tier: 'green'|'yellow'|'red' = total <= 30 ? 'green' : total <= 60 ? 'yellow' : 'red'
  const tierLabel = tier === 'green'
    ? 'Safe to Exit'
    : tier === 'yellow'
    ? 'Proceed With Caution'
    : 'High Risk — Staged Exit Required'

  // ══ Supporting data ════════════════════════════════════════════════════════
  const holderBands = buildHolderBands(holders, top10Pct)
  const exitPlan    = buildExitPlan(tier, safeSize, liq, whaleSells.length)
  const priceSparkline = (ohlcv.items ?? []).map(b => ({ time: b.unixTime, price: b.c }))
  const dexBreakdown = buildDexBreakdown(markets)

  return {
    total, tier, tierLabel,
    breakdown: {
      holderOverhang: { score: holderScore, max: 35, label: 'Holder Overhang (incl. profitability)', detail: holderDetail },
      exitLiquidity:  { score: exitScore,   max: 30, label: 'Exit Liquidity (Birdeye API)',          detail: liqDetail },
      sellPressure:   { score: pressScore,  max: 25, label: 'Sell Pressure (volume-weighted 1h)',    detail: pressDetail },
      contractRisk:   { score: contractScore, max: 10, label: 'Contract Risk',                       detail: contractDetail },
    },
    safeSize,
    exitLiquiditySource,
    topHolderPercent: top10Pct,
    holdersInProfit,
    totalHolderOverhang,
    holderPnLs: holderPnLDetails,
    buyCount1h: buyCount,
    sellCount1h: sellCount,
    buyVol1h: buyVol,
    sellVol1h: sellVol,
    whaleTxs,
    holderBands,
    exitPlan,
    priceSparkline,
    dexBreakdown,
    token: {
      symbol: overview.symbol, name: overview.name,
      price, priceChange24h: overview.priceChange24hPercent,
      liquidity: liq, volume24h: vol,
      marketCap: overview.marketCap,
      logoURI: overview.logoURI,
      holders: overview.holder,
    },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildHolderBands(holders: HolderList, top10Pct: number): HolderBand[] {
  const items = holders.items ?? []
  if (!items.length) return [
    { label: 'Top 10 holders', pct: top10Pct,       color: '#ef4444' },
    { label: 'Others',         pct: 100 - top10Pct, color: '#22c55e' },
  ]
  const total = items.reduce((s,h) => s + h.ui_amount, 0)
  if (!total) return []
  const pct = (n: number) => n / total * 100
  const t3  = pct(items.slice(0,3).reduce((s,h)=>s+h.ui_amount,0))
  const t10 = pct(items.slice(0,10).reduce((s,h)=>s+h.ui_amount,0))
  const t20 = pct(items.slice(0,20).reduce((s,h)=>s+h.ui_amount,0))
  return [
    { label: 'Top 3 whales',  pct: t3,                         color: '#ef4444' },
    { label: 'Holders 4–10',  pct: Math.max(0, t10 - t3),      color: '#f59e0b' },
    { label: 'Holders 11–20', pct: Math.max(0, t20 - t10),     color: '#6366f1' },
    { label: 'All others',    pct: Math.max(0, 100 - t20),     color: '#22c55e' },
  ]
}

function buildExitPlan(tier: string, safeSize: number, liq: number, whaleSells: number): ExitStep[] {
  const urgency = whaleSells > 0 ? ` ⚠️ ${whaleSells} whale sell detected — act faster` : ''
  if (tier === 'green') return [{
    tranche: 'Full position', size: `Up to $${fmtUSD(safeSize)}`,
    timing: 'Single transaction OK',
    slippagePct: calcSlippage(safeSize, liq),
    note: `Pool depth is healthy. Expected slippage < ${(calcSlippage(safeSize, liq)*100).toFixed(1)}%${urgency}`,
  }]
  if (tier === 'yellow') {
    const t1 = safeSize * 0.55, t2 = safeSize * 0.45
    return [
      { tranche: 'Tranche 1 — 55%', size: `$${fmtUSD(t1)}`, timing: 'Exit now',
        slippagePct: calcSlippage(t1, liq), note: `~${(calcSlippage(t1,liq)*100).toFixed(1)}% slippage. Secure gains immediately${urgency}` },
      { tranche: 'Tranche 2 — 45%', size: `$${fmtUSD(t2)}`, timing: '15–30 min later',
        slippagePct: calcSlippage(t2, liq), note: 'Allow pool to recover. Set 5% slippage tolerance.' },
    ]
  }
  const t1=safeSize*0.40, t2=safeSize*0.35, t3=safeSize*0.25
  return [
    { tranche: 'Tranche 1 — 40%', size: `$${fmtUSD(t1)}`, timing: 'EXIT NOW',
      slippagePct: calcSlippage(t1,liq), note: `~${(calcSlippage(t1,liq)*100).toFixed(1)}% slippage expected${urgency}` },
    { tranche: 'Tranche 2 — 35%', size: `$${fmtUSD(t2)}`, timing: '30–60 min later',
      slippagePct: calcSlippage(t2,liq), note: 'Check pressure before executing. Abort if score worsened.' },
    { tranche: 'Tranche 3 — 25%', size: `$${fmtUSD(t3)}`, timing: 'Final leg — conditional',
      slippagePct: calcSlippage(t3,liq), note: 'Only if price holds within 15% of entry. Otherwise market sell.' },
  ]
}

function buildDexBreakdown(markets: TokenMarketsResponse): { name: string; liquidityPct: number; liquidity: number }[] {
  const items = markets.items ?? []
  if (!items.length) return []
  const total = items.reduce((s,m) => s + (m.liquidity||0), 0)
  return items.slice(0,5).map(m => ({
    name: m.source ?? 'Unknown',
    liquidity: m.liquidity ?? 0,
    liquidityPct: total > 0 ? (m.liquidity||0) / total * 100 : 0,
  }))
}

function estimateConcentration(holders: HolderList): number {
  if (!holders.items?.length) return 50
  const top10 = holders.items.slice(0,10)
  const topAmt = top10.reduce((s,h)=>s+h.ui_amount,0)
  const totalAmt = holders.items.reduce((s,h)=>s+h.ui_amount,0)
  return totalAmt ? (topAmt/totalAmt)*100 : 50
}

export function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n/1_000).toFixed(1)}K`
  return n.toFixed(0)
}

export function fmtPct(n: number): string {
  return `${(n*100).toFixed(1)}%`
}
