/**
 * Telegram bot webhook handler for Overhang.
 *
 * Setup (one-time, after deploying to Vercel):
 *   curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-app.vercel.app/api/telegram"
 *
 * Commands:
 *   /start          — welcome message
 *   /analyze <addr> — full Overhang analysis
 *   /help           — usage instructions
 */
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
import { computeOverhang, fmtUSD, fmtPct } from '@/lib/score'

export const runtime = 'edge'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://overhang.vercel.app'
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)
}

async function sendMessage(chatId: number, text: string, parseMode = 'MarkdownV2') {
  await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, disable_web_page_preview: true }),
  })
}

// Escape characters that break Telegram MarkdownV2
function esc(s: string): string {
  return s.replace(/([_*[\]()~`>#+=|{}.!\\-])/g, '\\$1')
}

async function runAnalysis(chatId: number, address: string) {
  await sendMessage(chatId, `🔍 *Analyzing* \`${esc(address.slice(0, 8))}…\`\nFetching 8 Birdeye endpoints in parallel\\.\\.\\. ⏳`, 'MarkdownV2')

  try {
    // Phase 1: parallel calls
    const [overview, security, holders, trades, ohlcv, exitLiq, markets] = await Promise.all([
      getTokenOverview(address),
      getTokenSecurity(address),
      getTokenHolders(address, 20),
      getTokenTrades(address, 50),
      getOHLCV(address),
      getExitLiquidity(address),
      getTokenMarkets(address),
    ])

    // Phase 2: top-holder PnL
    const top3 = (holders.items ?? []).slice(0, 3).map(h => h.owner)
    const holderPnLs = await Promise.all(top3.map(w => getWalletPnLForToken(w, address)))
    while (holderPnLs.length < 5) holderPnLs.push(null)

    const r = computeOverhang(overview, security, holders, trades, ohlcv, exitLiq, holderPnLs, markets)

    const tierEmoji = r.tier === 'green' ? '🟢' : r.tier === 'yellow' ? '🟡' : '🔴'
    const sellPct = r.buyVol1h + r.sellVol1h > 0
      ? ((r.sellVol1h / (r.buyVol1h + r.sellVol1h)) * 100).toFixed(0)
      : '0'

    // Whale PnL line
    const pnlLine = r.holdersInProfit > 0
      ? `⚠️ *${r.holdersInProfit} whale\\(s\\) in profit* — \\$${esc(fmtUSD(r.totalHolderOverhang))} overhead`
      : `✅ Top holders at a loss — lower dump pressure`

    // Whale tx line
    const whaleSells = r.whaleTxs.filter(w => w.side === 'sell')
    const whaleLine = whaleSells.length > 0
      ? `🚨 *${whaleSells.length} whale sell\\(s\\)* in last hour`
      : `✅ No whale exits in last 60 min`

    // Exit source
    const srcLabel = r.exitLiquiditySource === 'birdeye_api' ? '🔵 Birdeye API' : '📐 AMM computed'

    // DEX line
    const topDex = r.dexBreakdown[0]
    const dexLine = topDex
      ? `🏦 ${esc(topDex.name.charAt(0).toUpperCase() + topDex.name.slice(1))}: ${esc(topDex.liquidityPct.toFixed(0))}% of liquidity`
      : ''

    const msg = [
      `${tierEmoji} *\\$${esc(r.token.symbol)} — ${esc(r.tierLabel)}*`,
      `Overhang Score: *${r.total}/100*`,
      ``,
      `💧 Pool liquidity: *\\$${esc(fmtUSD(r.token.liquidity))}*`,
      `🔒 Safe exit size: *\\$${esc(fmtUSD(r.safeSize))}* per tranche ${esc(`(${srcLabel})`)}`,
      `🐋 Top\\-10 holders: *${esc(r.topHolderPercent.toFixed(1))}%* of supply`,
      `📊 Sell pressure: *${esc(sellPct)}%* of 1h vol`,
      ``,
      pnlLine,
      whaleLine,
      dexLine,
      ``,
      `📋 *Exit Plan \\(${r.exitPlan.length} leg${r.exitPlan.length > 1 ? 's' : ''}\\):*`,
      ...r.exitPlan.map((step, i) =>
        `${i + 1}\\. ${esc(step.tranche)} — *${esc(step.size)}*\n   _${esc(step.timing)}_`
      ),
      ``,
      `🔗 [Full analysis](${esc(`${BASE_URL}/?a=${address}`)}) · [Birdeye](${esc(`https://birdeye.so/token/${address}?chain=solana`)})`,
      ``,
      `_\\#BirdeyeAPI \\#Solana_`,
    ].filter(Boolean).join('\n')

    await sendMessage(chatId, msg, 'MarkdownV2')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    await sendMessage(chatId,
      `❌ *Analysis failed*\n\n${esc(msg)}\n\nCheck that the address is a valid Solana token mint\\.`,
      'MarkdownV2'
    )
  }
}

const WELCOME = `👋 *Welcome to Overhang\\!*

Know your exit before you ape into any Solana token\\.

*Commands:*
• /analyze \`<token mint>\` — full exit intelligence
• /help — show this message

*Example:*
\`/analyze DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263\`

Powered by 8 live \\@birdeye\\_data endpoints\\.`

const HELP = `📖 *Overhang Bot Help*

Paste any Solana token mint address after /analyze\\.

I'll fetch live data from Birdeye and tell you:
• 💧 *Safe exit size* — max you can sell with <3% slippage
• 🐋 *Whale PnL* — are top holders in profit and ready to dump?
• 📊 *Volume\\-weighted sell pressure* — last 60 minutes
• 🚨 *Whale transactions* — large sells detected
• 🏦 *DEX breakdown* — where the liquidity actually lives
• 📋 *Staged exit plan* — how to get out without wrecking yourself

[Try the full app](${BASE_URL}) for more detail\\.`

export async function POST(req: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
  }

  let body: TelegramUpdate
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = body?.message
  if (!message?.text || !message?.chat?.id) {
    return NextResponse.json({ ok: true }) // ignore non-text updates
  }

  const chatId = message.chat.id
  const text   = message.text.trim()

  // Handle commands
  if (text.startsWith('/start')) {
    await sendMessage(chatId, WELCOME, 'MarkdownV2')
  } else if (text.startsWith('/help')) {
    await sendMessage(chatId, HELP.replace('${BASE_URL}', BASE_URL), 'MarkdownV2')
  } else if (text.startsWith('/analyze')) {
    const parts = text.split(/\s+/)
    const addr  = parts[1]?.trim()

    if (!addr) {
      await sendMessage(chatId,
        `❓ *Usage:* /analyze \`<token mint address>\`\n\nExample:\n\`/analyze DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263\``,
        'MarkdownV2'
      )
    } else if (!isValidSolanaAddress(addr)) {
      await sendMessage(chatId,
        `❌ *Invalid address*\n\nThat doesn't look like a Solana token mint\\. Please paste the full base58 address\\.`,
        'MarkdownV2'
      )
    } else {
      // Fire and don't await — Telegram requires < 5s response
      // Use waitUntil if available (Vercel Edge), otherwise just fire
      void runAnalysis(chatId, addr)
    }
  } else if (isValidSolanaAddress(text)) {
    // User just pasted a raw address — be helpful
    void runAnalysis(chatId, text)
  } else {
    await sendMessage(chatId,
      `🤔 I don't understand that\\. Try /analyze \`<token address>\` or /help\\.`,
      'MarkdownV2'
    )
  }

  return NextResponse.json({ ok: true })
}

// Telegram update type (minimal)
interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number; type: string }
    text?: string
  }
}
