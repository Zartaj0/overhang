import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const symbol    = p.get('symbol')    ?? 'TOKEN'
  const name      = p.get('name')      ?? ''
  const score     = parseInt(p.get('score') ?? '50', 10)
  const tier      = (p.get('tier') ?? 'yellow') as 'green' | 'yellow' | 'red'
  const safeSize  = p.get('safeSize')  ?? '0'
  const top10     = p.get('top10')     ?? '—'
  const sellPct   = p.get('sellPct')   ?? '50'
  const tierLabel = p.get('tierLabel') ?? 'Proceed With Caution'
  const liq       = p.get('liq')       ?? '0'

  const COLORS = {
    green:  { main: '#22c55e', bg: '#052e16', border: '#16a34a', dim: '#166534' },
    yellow: { main: '#f59e0b', bg: '#1c1003', border: '#d97706', dim: '#92400e' },
    red:    { main: '#ef4444', bg: '#1c0505', border: '#dc2626', dim: '#991b1b' },
  }
  const c = COLORS[tier]
  const scoreNum = Math.min(100, Math.max(0, score))
  const circumference = 2 * Math.PI * 42
  const dashOffset = circumference * (1 - scoreNum / 100)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: 1200,
          height: 630,
          background: '#080d18',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow background */}
        <div style={{
          position: 'absolute',
          top: -100,
          left: -100,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: c.main,
          opacity: 0.06,
          filter: 'blur(80px)',
          display: 'flex',
        }} />

        {/* Left panel */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: 420,
          padding: '48px 48px',
          borderRight: `1px solid ${c.dim}33`,
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>
              OVER<span style={{ color: '#60a5fa' }}>HANG</span>
            </div>
          </div>

          {/* Score ring */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 24 }}>
            <svg width="190" height="190" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1f2937" strokeWidth="10" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={c.main}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="45" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold">{scoreNum}</text>
              <text x="50" y="62" textAnchor="middle" fill="#6b7280" fontSize="10">/100</text>
            </svg>

            <div style={{ textAlign: 'center' }}>
              <div style={{ color: c.main, fontSize: 18, fontWeight: 800 }}>{tierLabel}</div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>Overhang Score</div>
            </div>
          </div>

          {/* Birdeye badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#0f172a',
            border: '1px solid #1e3a5f',
            borderRadius: 8,
            padding: '8px 12px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ color: '#60a5fa', fontSize: 12, fontWeight: 600 }}>Powered by Birdeye</span>
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: '48px 52px',
          gap: 0,
        }}>
          {/* Token name */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
              ${symbol}
            </div>
            {name && (
              <div style={{ color: '#6b7280', fontSize: 18, marginTop: 6 }}>{name}</div>
            )}
          </div>

          {/* Stats grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Safe Exit Size', value: `$${safeSize}`, color: '#22c55e' },
              { label: 'Pool Liquidity', value: `$${liq}`, color: '#fff' },
              { label: 'Top-10 Hold', value: `${top10}%`, color: parseFloat(top10) > 50 ? '#ef4444' : '#f59e0b' },
              { label: 'Sell Pressure', value: `${sellPct}%`, color: parseFloat(sellPct) > 60 ? '#ef4444' : '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: 12,
                padding: '12px 16px',
                minWidth: 140,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Sell pressure bar */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#6b7280', fontSize: 12 }}>1-Hour Sell Pressure</span>
              <span style={{ color: '#6b7280', fontSize: 12, fontFamily: 'monospace' }}>{sellPct}% sells</span>
            </div>
            <div style={{ height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
              <div style={{
                width: `${100 - parseFloat(sellPct)}%`,
                background: '#22c55e',
                borderRadius: 4,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ color: '#4b5563', fontSize: 10 }}>← Buyers</span>
              <span style={{ color: '#4b5563', fontSize: 10 }}>Sellers →</span>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#0f172a',
            border: `1px solid ${c.dim}44`,
            borderRadius: 12,
            padding: '14px 20px',
            marginTop: 'auto',
          }}>
            <div style={{ color: '#9ca3af', fontSize: 13 }}>
              Know your exit before you ape.
            </div>
            <div style={{
              background: c.main + '22',
              border: `1px solid ${c.main}44`,
              borderRadius: 8,
              padding: '6px 14px',
              color: c.main,
              fontSize: 13,
              fontWeight: 700,
            }}>
              overhang.vercel.app
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
