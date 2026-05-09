const BASE = 'https://public-api.birdeye.so'
const KEY = process.env.BIRDEYE_API_KEY ?? ''

function headers() {
  return {
    'X-API-KEY': KEY,
    'x-chain': 'solana',
    'Content-Type': 'application/json',
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: headers(),
    next: { revalidate: 30 },
  })
  if (!res.ok) {
    throw new Error(`Birdeye ${path} → ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  return json.data ?? json
}

// ─── 1. Token Overview ───────────────────────────────────────────────────────
export interface TokenOverview {
  address: string
  symbol: string
  name: string
  decimals: number
  price: number
  priceChange24hPercent: number
  liquidity: number
  volume24h: number
  marketCap: number
  holder: number
  trade24h: number
  buy24h: number
  sell24h: number
  logoURI?: string
}

export async function getTokenOverview(address: string): Promise<TokenOverview> {
  return get<TokenOverview>(`/defi/token_overview?address=${address}`)
}

// ─── 2. Token Security ───────────────────────────────────────────────────────
export interface TokenSecurity {
  ownerAddress?: string
  creatorAddress?: string
  freezeAuthority?: string | null
  mintAuthority?: string | null
  isMutable?: boolean
  top10HolderBalance?: number
  top10HolderPercent?: number
  top10UserPercent?: number
  nonTransferable?: boolean
  transferFeeEnable?: boolean
}

export async function getTokenSecurity(address: string): Promise<TokenSecurity> {
  return get<TokenSecurity>(`/defi/token_security?address=${address}`)
}

// ─── 3. Token Holders ────────────────────────────────────────────────────────
export interface Holder {
  owner: string
  ui_amount: number
  amount: number
}

export interface HolderList {
  items: Holder[]
  total: number
}

export async function getTokenHolders(address: string, limit = 20): Promise<HolderList> {
  return get<HolderList>(`/defi/v3/token/holder?address=${address}&limit=${limit}`)
}

// ─── 4. Exit Liquidity (Birdeye's own computation — June 2025 endpoint) ──────
// Returns slippage curves at different exit sizes
export interface ExitLiquidityDepth {
  amount: number        // token amount
  amountUsd: number     // USD value
  slippage: number      // slippage as decimal (0.03 = 3%)
  priceImpact: number   // price impact as decimal
}

export interface ExitLiquidity {
  address: string
  symbol?: string
  depths?: ExitLiquidityDepth[]
  // fallback fields Birdeye may return
  exitLiquidity?: number
  liquidityUsd?: number
  maxExitSizeUsd?: number
  slippageAt1pct?: number
  slippageAt3pct?: number
  slippageAt5pct?: number
}

export async function getExitLiquidity(address: string): Promise<ExitLiquidity> {
  return get<ExitLiquidity>(`/defi/v3/token/exit-liquidity?address=${address}`)
}

// ─── 5. Recent Trades ────────────────────────────────────────────────────────
export interface Trade {
  blockUnixTime: number
  source: string
  txHash: string
  owner: string
  side: 'buy' | 'sell'
  volumeUsd: number
}

export interface TradeList {
  items: Trade[]
  total: number
}

export async function getTokenTrades(address: string, limit = 100): Promise<TradeList> {
  return get<TradeList>(
    `/defi/txs/token?address=${address}&tx_type=all&limit=${limit}&sort_type=desc`
  )
}

// ─── 6. OHLCV (15m candles, last 4h) ─────────────────────────────────────────
export interface OHLCVBar {
  unixTime: number
  o: number; h: number; l: number; c: number; v: number
}

export interface OHLCVData {
  items: OHLCVBar[]
}

export async function getOHLCV(address: string): Promise<OHLCVData> {
  const now = Math.floor(Date.now() / 1000)
  const from = now - 4 * 60 * 60
  return get<OHLCVData>(
    `/defi/v3/ohlcv?address=${address}&type=15m&time_from=${from}&time_to=${now}`
  )
}

// ─── 7. Wallet PnL per token ─────────────────────────────────────────────────
// Released August 2025 — gives realized + unrealized profit per wallet per token
export interface WalletTokenPnL {
  wallet: string
  tokenAddress: string
  realizedPnl?: number        // USD
  unrealizedPnl?: number      // USD
  unrealizedPnlPct?: number   // %
  totalPnl?: number           // USD
  totalInvested?: number      // USD
  avgEntryPrice?: number
  currentValue?: number       // USD at current price
  holdingAmount?: number      // token amount
  tradeCount?: number
}

export interface WalletPnLResponse {
  items?: WalletTokenPnL[]
  // some versions return directly
  wallet?: string
  totalPnl?: number
  realizedPnl?: number
  unrealizedPnl?: number
}

export async function getWalletPnLForToken(
  walletAddress: string,
  tokenAddress: string
): Promise<WalletTokenPnL | null> {
  try {
    const data = await get<WalletPnLResponse>(
      `/wallet/v2/pnl?wallet=${walletAddress}&token=${tokenAddress}`
    )
    // Handle both response shapes Birdeye may return
    if (data.items && data.items.length > 0) return data.items[0]
    if (data.wallet) return { wallet: walletAddress, tokenAddress, ...data } as WalletTokenPnL
    return null
  } catch {
    return null // Don't fail the whole analysis if one wallet PnL call errors
  }
}

// ─── 8. Token Markets (DEX breakdown) ───────────────────────────────────────
export interface TokenMarket {
  address: string
  source: string        // e.g. "raydium", "orca", "meteora"
  liquidity: number
  price: number
  volume24h?: number
}

export interface TokenMarketsResponse {
  items: TokenMarket[]
  total: number
}

export async function getTokenMarkets(address: string): Promise<TokenMarketsResponse> {
  return get<TokenMarketsResponse>(
    `/defi/v3/token/market-data?address=${address}&limit=5&sort_by=liquidity&sort_type=desc`
  )
}
