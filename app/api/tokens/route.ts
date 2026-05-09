import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
  const key = process.env.BIRDEYE_API_KEY
  if (!key) return NextResponse.json({ tokens: [] })

  try {
    const res = await fetch(
      'https://public-api.birdeye.so/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=50&min_liquidity=500000',
      { headers: { 'X-API-KEY': key, 'x-chain': 'solana' }, next: { revalidate: 300 } }
    )
    const json = await res.json()
    const tokens = (json?.data?.tokens ?? []).map((t: Record<string, unknown>) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
      price: t.price,
      logoURI: t.logoURI,
      v24hUSD: t.v24hUSD,
    }))
    return NextResponse.json({ tokens }, { headers: { 'Cache-Control': 'public, s-maxage=300' } })
  } catch {
    return NextResponse.json({ tokens: [] })
  }
}
