'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import type { OverhangResult, HolderWithPnL } from '@/lib/score'
import { simulatePosition, fmtUSD, fmtPct } from '@/lib/score'
import clsx from 'clsx'

// ─── Demo tokens ──────────────────────────────────────────────────────────────
const DEMO_TOKENS = [
  { label: 'BONK',   address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { label: 'WIF',    address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { label: 'POPCAT', address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' },
  { label: 'BOME',   address: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82' },
]

// ─── Color config ─────────────────────────────────────────────────────────────
const TC = {
  green:  { ring: '#22c55e', glow: '0 0 30px #22c55e33', bg: 'bg-green-950/40',  border: 'border-green-500/25',  text: 'text-green-400',  badge: 'bg-green-900/60 text-green-300 border-green-700/50' },
  yellow: { ring: '#f59e0b', glow: '0 0 30px #f59e0b33', bg: 'bg-yellow-950/40', border: 'border-yellow-500/25', text: 'text-yellow-400', badge: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/50' },
  red:    { ring: '#ef4444', glow: '0 0 30px #ef444433', bg: 'bg-red-950/40',    border: 'border-red-500/25',    text: 'text-red-400',   badge: 'bg-red-900/60 text-red-300 border-red-700/50' },
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, tier }: { score: number; tier: 'green' | 'yellow' | 'red' }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const color = TC[tier].ring
  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg viewBox="0 0 120 120" style={{ width: 140, height: 140, position: 'absolute' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1f2937" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 60 60)"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="relative z-10 text-center">
        <div className="text-4xl font-black leading-none" style={{ color }}>{score}</div>
        <div className="text-xs text-gray-500 mt-1">/ 100</div>
      </div>
    </div>
  )
}

// ─── Breakdown Row ────────────────────────────────────────────────────────────
function BreakdownRow({ label, score, max, detail }: { label: string; score: number; max: number; detail: string }) {
  const ratio = score / max
  const barColor = ratio < 0.30 ? '#22c55e' : ratio < 0.65 ? '#f59e0b' : '#ef4444'
  return (
    <div className="group space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-xs font-mono" style={{ color: barColor }}>{score}<span className="text-gray-600">/{max}</span></span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${ratio * 100}%`, backgroundColor: barColor }} />
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{detail}</p>
    </div>
  )
}

// ─── Holder Stack ─────────────────────────────────────────────────────────────
function HolderStack({ bands }: { bands: { label: string; pct: number; color: string }[] }) {
  const validBands = bands.filter(b => b.pct > 0)
  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden gap-px">
        {validBands.map((b, i) => (
          <div key={i} style={{ width: `${b.pct}%`, backgroundColor: b.color, minWidth: b.pct > 1 ? undefined : '2px' }}
            title={`${b.label}: ${b.pct.toFixed(1)}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {validBands.map((b, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: b.color }} />
            <span className="text-xs text-gray-400">{b.label}</span>
            <span className="text-xs font-mono" style={{ color: b.color }}>{b.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Holder PnL Cards ─────────────────────────────────────────────────────────
function HolderPnLCards({ holderPnLs, holdersInProfit, totalHolderOverhang }: {
  holderPnLs: HolderWithPnL[]
  holdersInProfit: number
  totalHolderOverhang: number
}) {
  const tracked = holderPnLs.filter(h => h.unrealizedPnl !== 0 || h.currentValue > 0)
  if (!tracked.length) return null

  return (
    <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">Whale PnL Intelligence</h3>
          <p className="text-xs text-gray-500 mt-0.5">Are top holders in profit? In-profit whales = pending dump pressure.</p>
        </div>
        {totalHolderOverhang > 0 && (
          <div className="text-right">
            <div className="text-sm font-bold text-orange-400">${fmtUSD(totalHolderOverhang)}</div>
            <div className="text-xs text-gray-600">total overhead</div>
          </div>
        )}
      </div>

      {/* Summary bar */}
      <div className={clsx(
        'flex items-center gap-3 rounded-xl p-3 mb-4 border',
        holdersInProfit >= 3 ? 'bg-red-950/40 border-red-700/40'
          : holdersInProfit >= 1 ? 'bg-yellow-950/40 border-yellow-700/40'
          : 'bg-green-950/40 border-green-700/40'
      )}>
        <span className="text-xl">{holdersInProfit >= 3 ? '🔴' : holdersInProfit >= 1 ? '🟡' : '🟢'}</span>
        <div>
          <div className={clsx('text-sm font-semibold',
            holdersInProfit >= 3 ? 'text-red-300' : holdersInProfit >= 1 ? 'text-yellow-300' : 'text-green-300'
          )}>
            {holdersInProfit === 0 ? 'Top holders appear to be at a loss — lower dump risk'
              : holdersInProfit === 1 ? '1 top whale is in profit — moderate overhead'
              : `${holdersInProfit} top whales in profit — ${fmtUSD(totalHolderOverhang)} in unrealized gains above you`}
          </div>
        </div>
      </div>

      {/* Per-holder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tracked.slice(0, 3).map((h, i) => (
          <div key={i} className={clsx(
            'rounded-xl p-3 border',
            h.isInProfit ? 'bg-red-950/30 border-red-700/40' : 'bg-gray-800/50 border-gray-700/40'
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-300">{h.label}</span>
              <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded',
                h.isInProfit ? 'bg-red-900/60 text-red-300' : 'bg-gray-700 text-gray-400'
              )}>
                {h.isInProfit ? '▲ In Profit' : '▼ At Loss'}
              </span>
            </div>
            <div className="space-y-1">
              {h.unrealizedPnl !== 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Unrealized PnL</span>
                  <span className={clsx('text-xs font-mono font-bold',
                    h.unrealizedPnl > 0 ? 'text-red-400' : 'text-green-400'
                  )}>
                    {h.unrealizedPnl > 0 ? '+' : ''}${fmtUSD(h.unrealizedPnl)}
                  </span>
                </div>
              )}
              {h.unrealizedPct !== 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Return</span>
                  <span className={clsx('text-xs font-mono', h.unrealizedPct > 0 ? 'text-orange-400' : 'text-blue-400')}>
                    {h.unrealizedPct > 0 ? '+' : ''}{h.unrealizedPct.toFixed(0)}%
                  </span>
                </div>
              )}
              {h.currentValue > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Position value</span>
                  <span className="text-xs font-mono text-white">${fmtUSD(h.currentValue)}</span>
                </div>
              )}
            </div>
            <div className="mt-2">
              <a
                href={`https://birdeye.so/wallet/${h.address}?chain=solana`}
                target="_blank" rel="noopener"
                className="text-xs text-gray-700 hover:text-blue-400 font-mono truncate block transition-colors"
                title={h.address}
              >
                {h.address.slice(0,6)}…{h.address.slice(-4)} ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── DEX Breakdown ───────────────────────────────────────────────────────────
function DexBreakdown({ dexBreakdown }: { dexBreakdown: { name: string; liquidityPct: number; liquidity: number }[] }) {
  if (!dexBreakdown.length) return null
  const DEX_COLORS: Record<string, string> = {
    raydium: '#5865f2', orca: '#00c2ff', meteora: '#a855f7',
    jupiter: '#f97316', whirlpool: '#06b6d4',
  }
  const getColor = (name: string) => DEX_COLORS[name.toLowerCase()] ?? '#6b7280'

  return (
    <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">Liquidity by DEX</h3>
        <span className="text-xs text-gray-600">exit fragmentation risk</span>
      </div>
      {/* Bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
        {dexBreakdown.map((d, i) => (
          <div key={i}
            style={{ width: `${d.liquidityPct}%`, backgroundColor: getColor(d.name), minWidth: d.liquidityPct > 2 ? undefined : '3px' }}
            title={`${d.name}: ${d.liquidityPct.toFixed(1)}%`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="space-y-1.5">
        {dexBreakdown.map((d, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: getColor(d.name) }} />
              <span className="text-xs text-gray-300 capitalize">{d.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400">${fmtUSD(d.liquidity)}</span>
              <span className="text-xs font-mono w-10 text-right" style={{ color: getColor(d.name) }}>{d.liquidityPct.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
      {dexBreakdown.length > 1 && dexBreakdown[0].liquidityPct > 80 && (
        <p className="text-xs text-orange-400 mt-3">
          ⚠️ {dexBreakdown[0].liquidityPct.toFixed(0)}% of liquidity concentrated on {dexBreakdown[0].name} — single DEX fragility risk.
        </p>
      )}
    </div>
  )
}

// ─── Position Simulator ───────────────────────────────────────────────────────
function PositionSimulator({ liquidity }: { liquidity: number }) {
  const [posUsd, setPosUsd] = useState(1000)
  const sim = simulatePosition(posUsd, liquidity)
  const verdictStyle = {
    ok:      { text: 'text-green-400',  label: 'Looks Good', bg: 'bg-green-900/30 border-green-700/40' },
    tight:   { text: 'text-yellow-400', label: 'Tight',      bg: 'bg-yellow-900/30 border-yellow-700/40' },
    risky:   { text: 'text-orange-400', label: 'Risky',      bg: 'bg-orange-900/30 border-orange-700/40' },
    extreme: { text: 'text-red-400',    label: 'Avoid',      bg: 'bg-red-900/30 border-red-700/40' },
  }[sim.verdict]
  const PRESETS = [500, 1000, 2500, 5000, 10000]
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Position size</span>
          <span className="text-lg font-bold text-white">${posUsd.toLocaleString()}</span>
        </div>
        <input type="range" min={100} max={Math.max(50000, liquidity * 0.2)} step={100}
          value={posUsd} onChange={e => setPosUsd(Number(e.target.value))}
          className="w-full accent-blue-500 cursor-pointer" />
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setPosUsd(p)}
              className={clsx('text-xs px-3 py-1 rounded-full border transition-colors',
                posUsd === p ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
              )}>
              ${p >= 1000 ? `${p / 1000}K` : p}
            </button>
          ))}
        </div>
      </div>
      <div className={clsx('rounded-xl border p-4', verdictStyle.bg)}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-300">Round-trip simulation</span>
          <span className={clsx('text-sm font-bold px-2 py-0.5 rounded', verdictStyle.text)}>{verdictStyle.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Entry slippage',       value: fmtPct(sim.entrySlippagePct), sub: `−$${fmtUSD(sim.entrySlippageUsd)}`,  color: sim.entrySlippagePct > 0.05 ? 'text-red-400' : 'text-yellow-400' },
            { label: 'Exit slippage',        value: fmtPct(sim.exitSlippagePct),  sub: `−$${fmtUSD(sim.exitSlippageUsd)}`,   color: sim.exitSlippagePct > 0.05  ? 'text-red-400' : 'text-yellow-400' },
            { label: 'Total round-trip cost',value: `−$${fmtUSD(sim.totalCostUsd)}`, sub: fmtPct(sim.totalCostPct),          color: sim.totalCostPct > 0.08     ? 'text-red-400' : 'text-orange-400' },
            { label: 'Break-even needed',    value: `+${sim.breakEvenMoveNeeded.toFixed(1)}%`, sub: 'just to cover costs',   color: sim.breakEvenMoveNeeded > 10 ? 'text-red-400' : 'text-gray-300' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-black/20 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className={clsx('text-base font-bold font-mono', color)}>{value}</div>
              <div className="text-xs text-gray-600">{sub}</div>
            </div>
          ))}
        </div>
        {sim.verdict === 'extreme' && (
          <p className="text-xs text-red-400 mt-3 leading-relaxed">
            ⚠️ This position costs over {(sim.totalCostPct * 100).toFixed(0)}% in slippage —
            the token needs +{sim.breakEvenMoveNeeded.toFixed(0)}% just to break even.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Exit Step Card ───────────────────────────────────────────────────────────
function ExitCard({ step, index }: { step: { tranche: string; size: string; timing: string; note: string; slippagePct?: number }; index: number }) {
  const isUrgent = step.timing.toLowerCase().includes('now')
  return (
    <div className={clsx('flex gap-3 p-3 rounded-xl border transition-colors',
      isUrgent ? 'bg-red-950/30 border-red-700/40' : 'bg-gray-800/40 border-gray-700/40'
    )}>
      <div className={clsx('flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border',
        isUrgent ? 'bg-red-900/60 border-red-600/50 text-red-300' : 'bg-blue-900/40 border-blue-600/40 text-blue-300'
      )}>{index + 1}</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white">{step.tranche}</span>
          <div className="flex items-center gap-2">
            {step.slippagePct !== undefined && (
              <span className="text-xs text-gray-500 font-mono">{(step.slippagePct * 100).toFixed(1)}% slip</span>
            )}
            <span className="text-sm font-mono text-green-400">{step.size}</span>
          </div>
        </div>
        <p className={clsx('text-xs mt-0.5 font-medium', isUrgent ? 'text-red-400' : 'text-blue-400')}>{step.timing}</p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{step.note}</p>
      </div>
    </div>
  )
}

// ─── Whale Alert ─────────────────────────────────────────────────────────────
function WhaleAlerts({ whaleTxs }: { whaleTxs: { side: 'buy' | 'sell'; volumeUsd: number; minsAgo: number }[] }) {
  if (!whaleTxs.length) return null
  return (
    <div className="rounded-xl bg-orange-950/30 border border-orange-700/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-orange-400 text-sm">🐋</span>
        <h3 className="text-sm font-semibold text-orange-300">Whale Activity (Last Hour)</h3>
      </div>
      <div className="space-y-2">
        {whaleTxs.map((w, i) => (
          <div key={i} className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2">
              <span className={w.side === 'sell' ? 'text-red-400' : 'text-green-400'}>
                {w.side === 'sell' ? '↓ SOLD' : '↑ BOUGHT'}
              </span>
              <span className="font-mono font-bold text-white">${fmtUSD(w.volumeUsd)}</span>
            </div>
            <span className="text-xs text-gray-500">{w.minsAgo}m ago</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Share Panel ──────────────────────────────────────────────────────────────
function SharePanel({ result, address }: { result: OverhangResult; address: string }) {
  const [copied, setCopied] = useState(false)
  const sellPct = result.buyVol1h + result.sellVol1h > 0
    ? (result.sellVol1h / (result.buyVol1h + result.sellVol1h) * 100).toFixed(0) : '0'
  const tierEmoji = result.tier === 'green' ? '🟢' : result.tier === 'yellow' ? '🟡' : '🔴'
  const profitLine = result.holdersInProfit > 0
    ? `⚠️ ${result.holdersInProfit} top whale(s) sitting on $${fmtUSD(result.totalHolderOverhang)} unrealized gains`
    : `✅ Top holders appear to be at a loss (less dump pressure)`
  const text = [
    `${tierEmoji} $${result.token.symbol} Exit Analysis — @birdeye_data #BirdeyeAPI`,
    ``,
    `Overhang Score: ${result.total}/100 (${result.tierLabel})`,
    `💧 Pool liquidity: $${fmtUSD(result.token.liquidity)}`,
    `🔒 Safe exit size: $${fmtUSD(result.safeSize)} per tranche`,
    `🐋 Top-10 holders: ${result.topHolderPercent.toFixed(1)}% of supply`,
    `📊 Sell pressure (1h vol): ${sellPct}%`,
    profitLine,
    result.whaleTxs.filter(w => w.side === 'sell').length > 0
      ? `🚨 ${result.whaleTxs.filter(w => w.side === 'sell').length} whale sell(s) detected in last hour`
      : `✅ No whale exits in last hour`,
    ``,
    `Know your exit before you ape 👇`,
    `${window.location.origin}/?a=${address} #Solana`,
  ].join('\n')
  const shareOnX = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  const copyText = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="space-y-3">
      <div className="bg-gray-800/50 rounded-xl p-3 font-mono text-xs text-gray-300 whitespace-pre-wrap leading-relaxed border border-gray-700/50">
        {text}
      </div>
      <div className="flex gap-2">
        <button onClick={shareOnX}
          className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white transition-colors">
          Share on 𝕏
        </button>
        <button onClick={copyText}
          className="py-2.5 px-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm font-medium text-gray-200 transition-colors">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

// ─── Token Stat Row ───────────────────────────────────────────────────────────
function TokenStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-800/60 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={clsx('text-xs font-mono font-medium', color ?? 'text-white')}>{value}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OverhangResult | null>(null)
  const [currentAddress, setCurrentAddress] = useState('')
  const resultRef = useRef<HTMLDivElement>(null)

  // Auto-analyze from ?a= URL param on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const a = params.get('a')
    if (a) { setAddress(a); analyze(a) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const analyze = useCallback(async (addr: string) => {
    const trimmed = addr.trim()
    if (!trimmed) return
    setLoading(true); setError(null); setResult(null); setCurrentAddress(trimmed)
    try {
      const res = await fetch(`/api/analyze?address=${trimmed}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setResult(data)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); analyze(address) }
  const tier = result?.tier ?? 'green'
  const tc = TC[tier]

  return (
    <div className="min-h-screen bg-[#080d18] text-white selection:bg-blue-500/30">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-[#080d18]/90 backdrop-blur-md px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-black tracking-tight">
              <span className="text-white">OVER</span><span className="text-blue-400">HANG</span>
            </div>
            <span className="hidden sm:block text-xs text-gray-600 border-l border-gray-800 pl-3">
              Exit intelligence for Solana
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-gray-500">Live · Powered by</span>
            <span className="text-blue-400 font-semibold">Birdeye</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-16">

        {/* Hero */}
        <div className={clsx('text-center transition-all duration-500', result ? 'py-6' : 'py-16')}>
          {!result && !loading && (
            <>
              <div className="inline-flex items-center gap-2 text-xs text-blue-400 bg-blue-900/30 border border-blue-700/40 rounded-full px-3 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Birdeye Build-in-Public Sprint 3
              </div>
              <h2 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
                Know your exit<br />
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  before you ape.
                </span>
              </h2>
              <p className="text-gray-400 max-w-lg mx-auto text-base leading-relaxed">
                Most Solana traders die on the exit, not the entry.
                Paste any token and get your Safe Size, Seller Overhang score,
                whale alerts, and a concrete staged Exit Plan.
              </p>
            </>
          )}
        </div>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="space-y-3 mb-8">
          <div className="flex gap-2">
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Paste Solana token mint address…" spellCheck={false}
              className="flex-1 bg-gray-900/80 border border-gray-700 rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 font-mono transition-all"
            />
            <button type="submit" disabled={loading || !address.trim()}
              className="px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-colors whitespace-nowrap">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing…
                </span>
              ) : 'Analyze →'}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">Try:</span>
            {DEMO_TOKENS.map(t => (
              <button key={t.address} type="button"
                onClick={() => { setAddress(t.address); analyze(t.address) }}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors border border-gray-700/50">
                ${t.label}
              </button>
            ))}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-700/40 text-red-400 text-sm mb-6">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-52 bg-gray-900/60 rounded-2xl border border-gray-800" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-48 bg-gray-900/60 rounded-xl border border-gray-800" />
              <div className="h-48 bg-gray-900/60 rounded-xl border border-gray-800" />
            </div>
            <div className="h-40 bg-gray-900/60 rounded-xl border border-gray-800" />
          </div>
        )}

        {/* ─── RESULTS ─────────────────────────────────────────────────────── */}
        {result && !loading && (
          <div ref={resultRef} className="space-y-4">
            {/* Stablecoin / non-meme token warning */}
            {result.token.price >= 0.97 && result.token.price <= 1.03 && (
              <div className="p-3 rounded-xl bg-yellow-950/40 border border-yellow-700/40 text-yellow-400 text-xs">
                ⚠️ <strong>Stablecoin detected.</strong> Overhang is designed for volatile Solana tokens. High holder concentration and sell pressure on stablecoins like USDC reflect exchange custodians and normal redemptions — not dump risk.
              </div>
            )}

            {/* ── Hero card ────────────────────────────────────────────────── */}
            <div className={clsx('rounded-2xl border p-6', tc.bg, tc.border)} style={{ boxShadow: tc.glow }}>
              {/* Token header */}
              <div className="flex items-center gap-3 mb-5">
                {result.token.logoURI && (
                  <img src={result.token.logoURI} alt="" className="w-9 h-9 rounded-full border border-gray-700" />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl font-black">${result.token.symbol}</span>
                    <span className="text-gray-400 text-sm">{result.token.name}</span>
                    {/* Exit liquidity source badge */}
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium',
                      result.exitLiquiditySource === 'birdeye_api'
                        ? 'bg-blue-900/50 text-blue-300 border-blue-700/50'
                        : 'bg-gray-800 text-gray-500 border-gray-700'
                    )}>
                      {result.exitLiquiditySource === 'birdeye_api' ? '🔵 Birdeye Exit API' : '📐 AMM Computed'}
                    </span>
                  </div>
                  <a href={`https://birdeye.so/token/${currentAddress}?chain=solana`} target="_blank" rel="noopener"
                    className="text-xs text-blue-500 hover:text-blue-400 font-mono">
                    View on Birdeye ↗
                  </a>
                </div>
              </div>

              {/* Score + info */}
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <ScoreRing score={result.total} tier={tier} />
                <div className="flex-1 min-w-0">
                  <div className={clsx('text-2xl font-black mb-1', tc.text)}>{result.tierLabel}</div>
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">
                    {tier === 'green'
                      ? 'Exit conditions are manageable. Standard slippage tolerance applies.'
                      : tier === 'yellow'
                      ? 'Exits are feasible but require staged selling to avoid self-impact.'
                      : 'High-risk exit conditions. Follow the staged plan carefully or face severe slippage.'}
                  </p>
                  {/* Key metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Safe Exit Size', value: `$${fmtUSD(result.safeSize)}`, sub: 'per tranche / <3% slip', vc: 'text-green-400' },
                      { label: 'Pool Liquidity', value: `$${fmtUSD(result.token.liquidity)}`, sub: 'live', vc: 'text-white' },
                      { label: 'Top-10 Hold', value: `${result.topHolderPercent.toFixed(1)}%`, sub: 'of supply',
                        vc: result.topHolderPercent > 50 ? 'text-red-400' : result.topHolderPercent > 30 ? 'text-yellow-400' : 'text-green-400' },
                    ].map(m => (
                      <div key={m.label} className="bg-black/20 rounded-xl p-3">
                        <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                        <div className={clsx('text-base font-bold font-mono', m.vc)}>{m.value}</div>
                        <div className="text-xs text-gray-600">{m.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sparkline */}
              {result.priceSparkline.length > 2 && (
                <div className="mt-5 h-20 border-t border-gray-800/50 pt-4">
                  <div className="text-xs text-gray-600 mb-1">Price (4h, 15m candles)</div>
                  <ResponsiveContainer width="100%" height={52}>
                    <LineChart data={result.priceSparkline}>
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 shadow-xl">
                            ${Number(payload[0].value).toPrecision(5)}
                          </div>
                        ) : null
                      } />
                      <Line type="monotone" dataKey="price" stroke={tc.ring} strokeWidth={2} dot={false} isAnimationActive />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* ── Whale alerts ─────────────────────────────────────────────── */}
            {result.whaleTxs.length > 0 && <WhaleAlerts whaleTxs={result.whaleTxs} />}

            {/* ── Whale PnL Intelligence ────────────────────────────────────── */}
            <HolderPnLCards
              holderPnLs={result.holderPnLs}
              holdersInProfit={result.holdersInProfit}
              totalHolderOverhang={result.totalHolderOverhang}
            />

            {/* ── Two-column ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Score Breakdown */}
              <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-5 space-y-5">
                <h3 className="text-sm font-semibold text-gray-200">Overhang Score Breakdown</h3>
                {Object.values(result.breakdown).map(b => (
                  <BreakdownRow key={b.label} label={b.label} score={b.score} max={b.max} detail={b.detail} />
                ))}
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Sell pressure */}
                <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-5">
                  <h3 className="text-sm font-semibold text-gray-200 mb-3">1-Hour Volume Pressure</h3>
                  <div className="flex gap-3 mb-3">
                    <div className="flex-1 text-center p-3 rounded-xl bg-green-950/40 border border-green-800/40">
                      <div className="text-xl font-bold text-green-400">${fmtUSD(result.buyVol1h)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Buy volume</div>
                      <div className="text-xs text-gray-600">{result.buyCount1h} trades</div>
                    </div>
                    <div className="flex-1 text-center p-3 rounded-xl bg-red-950/40 border border-red-800/40">
                      <div className="text-xl font-bold text-red-400">${fmtUSD(result.sellVol1h)}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Sell volume</div>
                      <div className="text-xs text-gray-600">{result.sellCount1h} trades</div>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-700"
                      style={{ width: `${result.buyVol1h + result.sellVol1h > 0 ? (result.buyVol1h / (result.buyVol1h + result.sellVol1h)) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>← Buyers</span><span>Sellers →</span>
                  </div>
                </div>

                {/* Token stats */}
                <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-5">
                  <h3 className="text-sm font-semibold text-gray-200 mb-3">Token Stats</h3>
                  <TokenStat label="Price" value={result.token.price < 0.0001 ? `$${result.token.price.toExponential(3)}` : `$${result.token.price.toFixed(6)}`} />
                  <TokenStat label="24h Change"
                    value={`${result.token.priceChange24h >= 0 ? '+' : ''}${result.token.priceChange24h?.toFixed(2) ?? '—'}%`}
                    color={result.token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'} />
                  <TokenStat label="Market Cap" value={`$${fmtUSD(result.token.marketCap)}`} />
                  <TokenStat label="24h Volume" value={`$${fmtUSD(result.token.volume24h)}`} />
                  <TokenStat label="Holders" value={result.token.holders?.toLocaleString() ?? '—'} />
                  <TokenStat label="Vol / Liquidity"
                    value={result.token.liquidity > 0 ? `${(result.token.volume24h / result.token.liquidity).toFixed(1)}×` : '—'}
                    color={result.token.volume24h / result.token.liquidity > 5 ? 'text-orange-400' : 'text-white'} />
                </div>
              </div>
            </div>

            {/* ── Holder Distribution Visual ────────────────────────────────── */}
            {result.holderBands.length > 0 && (
              <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-5">
                <h3 className="text-sm font-semibold text-gray-200 mb-3">Holder Distribution</h3>
                <HolderStack bands={result.holderBands} />
                <p className="text-xs text-gray-600 mt-3">
                  Red = top 3 whales controlling most supply. Green = distributed retail. Red whales can exit fastest.
                </p>
              </div>
            )}

            {/* ── DEX Breakdown ─────────────────────────────────────────────── */}
            {result.dexBreakdown.length > 0 && <DexBreakdown dexBreakdown={result.dexBreakdown} />}

            {/* ── Position Simulator ────────────────────────────────────────── */}
            <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-gray-200">Position Simulator</h3>
                <span className="text-xs bg-blue-900/50 text-blue-400 border border-blue-700/50 rounded-full px-2 py-0.5">New</span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Enter your position size to see exact slippage costs and break-even requirements.
                Uses real AMM constant-product math (xyk) against live Birdeye pool data.
              </p>
              <PositionSimulator liquidity={result.token.liquidity} />
            </div>

            {/* ── Exit Plan ─────────────────────────────────────────────────── */}
            <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-200">Staged Exit Plan</h3>
                <span className={clsx('text-xs px-2.5 py-1 rounded-full border font-medium', tc.badge)}>
                  {result.tier === 'green' ? '1 leg' : result.tier === 'yellow' ? '2 legs' : '3 legs'}
                </span>
              </div>
              <div className="space-y-2">
                {result.exitPlan.map((step, i) => <ExitCard key={i} step={step} index={i} />)}
              </div>
              <p className="text-xs text-gray-600 mt-3 leading-relaxed">
                Safe size = max position where slippage stays below 3%, calculated via xyk AMM formula
                against live Birdeye pool depth.{' '}
                {result.exitLiquiditySource === 'birdeye_api'
                  ? 'Exit size sourced directly from Birdeye\'s exit-liquidity endpoint.'
                  : 'Exit size computed via constant-product AMM formula (Birdeye endpoint returned no data).'}
              </p>
            </div>

            {/* ── Share ─────────────────────────────────────────────────────── */}
            <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-200">Share This Analysis</h3>
                <span className="text-xs text-gray-600">@birdeye_data · #BirdeyeAPI</span>
              </div>
              <SharePanel result={result} address={currentAddress} />
            </div>

          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-gray-700 pt-12 space-y-1">
          <p>
            Live data from{' '}
            <a href="https://docs.birdeye.so" target="_blank" rel="noopener" className="text-gray-600 hover:text-gray-400 underline">Birdeye APIs</a>
            {' '}· Built for Birdeye Build-in-Public Sprint 3
          </p>
          <p>Not financial advice. Always verify on-chain before trading.</p>
        </footer>
      </main>
    </div>
  )
}
