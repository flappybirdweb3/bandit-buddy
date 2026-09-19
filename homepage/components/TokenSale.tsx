'use client'

import { useEffect, useState, useCallback } from 'react'
import { ArrowRight, BookOpen, Shield, Sparkles, Users, Wallet, Loader2, ExternalLink } from 'lucide-react'
import { ethers } from 'ethers'
import { useToast } from './ToastProvider'
import {
  ACTIVE_CHAIN_ID, BSC_TESTNET_CHAIN_ID, CONTRACTS,
  FARM_TOKEN_SALE_ABI, ERC20_ABI, BSC_TESTNET_RPC,
} from '../lib/tokenSaleContracts'

// ── Types ────────────────────────────────────────────────────────────────────

interface RoundOnChain {
  sold:            bigint
  totalAllocation: bigint
  startTime:       bigint
  endTime:         bigint
  requiresWhitelist: boolean
}

interface ChainData {
  rounds: (RoundOnChain | null)[]
  paused: boolean
}

// ── Static sale round config (mirrors on-chain params) ───────────────────────

const SALE_ROUNDS = [
  {
    id: 0,
    key:       'angel',
    name:      'Angel round',
    supply:    '5% supply',
    price:     0.001,
    priceWei:  ethers.parseUnits('0.001', 18),
    unlock:    '0% TGE',
    vesting:   '18 months',
    cliff:     '3 months',
    copy:      'The earliest supporters fund the game foundation, from UI/UX and backend build to the first playable frontier.',
    startIso:  '2026-10-01T00:00:00+07:00',
    endIso:    '2026-10-30T23:59:59+07:00',
    fdv:       '$1M',
    target:    '50,000,000 FARM',
    whitelist: true,
  },
  {
    id: 1,
    key:       'private',
    name:      'Private sale',
    supply:    '7% supply',
    price:     0.0025,
    priceWei:  ethers.parseUnits('0.0025', 18),
    unlock:    '5% TGE',
    vesting:   '18 months',
    cliff:     '0 months',
    copy:      'Strategic VCs and Web3 guilds help turn early traction into a growing partner network and a stronger player economy.',
    startIso:  '2026-11-01T00:00:00+07:00',
    endIso:    '2026-11-30T23:59:59+07:00',
    fdv:       '$2.5M',
    target:    '70,000,000 FARM',
    whitelist: true,
  },
  {
    id: 2,
    key:       'public',
    name:      'Public sale / IDO',
    supply:    '5% supply',
    price:     0.005,
    priceWei:  ethers.parseUnits('0.005', 18),
    unlock:    '25% TGE',
    vesting:   '12 months',
    cliff:     '0 months',
    copy:      'The community round opens the frontier wider, with a clear 5x valuation step-up from the earliest planned entry.',
    startIso:  '2026-12-01T00:00:00+07:00',
    endIso:    '2026-12-30T23:59:59+07:00',
    fdv:       '$5M',
    target:    '50,000,000 FARM',
    whitelist: false,
  },
]

// ── Helper ───────────────────────────────────────────────────────────────────

function SaleCountdown({ startIso, endIso }: { startIso: string; endIso: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const startMs = new Date(startIso).getTime()
  const endMs   = new Date(endIso).getTime()
  const active  = now >= startMs && now < endMs
  const ended   = now >= endMs
  const target  = now < startMs ? startMs : endMs
  const rem     = Math.max(0, target - now)
  const d       = Math.floor(rem / 86400000)
  const h       = Math.floor(rem / 3600000) % 24
  const m       = Math.floor(rem / 60000) % 60
  const s       = Math.floor(rem / 1000) % 60
  const pad     = (v: number) => v.toString().padStart(2, '0')

  return (
    <div className="countdown">
      <span className={active ? 'countdown-status live' : 'countdown-status'}>
        {ended ? 'ROUND ENDED' : now < startMs ? 'STARTS IN' : 'ENDS IN'}
      </span>
      {!ended && <strong>{d}d <b>{pad(h)}:{pad(m)}:{pad(s)}</b></strong>}
      <small>
        {new Date(startMs).toLocaleDateString('en-GB')} — {new Date(endMs).toLocaleDateString('en-GB')}
      </small>
    </div>
  )
}

function ProgressBar({ sold, total }: { sold: bigint; total: bigint }) {
  const pct = total === 0n ? 0 : Number((sold * 10000n) / total) / 100
  return (
    <div className="round-progress">
      <div className="round-progress-bar">
        <i style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span>{pct.toFixed(1)}% sold · {Number(ethers.formatEther(total - sold)).toLocaleString(undefined, { maximumFractionDigits: 0 })} FARM remaining</span>
    </div>
  )
}

// ── Read public chain data (no wallet needed) ────────────────────────────────

async function fetchChainData(): Promise<ChainData> {
  const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC)
  const contracts = CONTRACTS[BSC_TESTNET_CHAIN_ID]
  const sale = new ethers.Contract(contracts.farmTokenSale, FARM_TOKEN_SALE_ABI, provider)

  const [r0, r1, r2, paused] = await Promise.all([
    sale.rounds(0).catch(() => null),
    sale.rounds(1).catch(() => null),
    sale.rounds(2).catch(() => null),
    sale.paused().catch(() => false),
  ])

  const toOnChain = (r: any): RoundOnChain | null => {
    if (!r) return null
    return {
      sold:              BigInt(r.sold),
      totalAllocation:   BigInt(r.totalAllocation),
      startTime:         BigInt(r.startTime),
      endTime:           BigInt(r.endTime),
      requiresWhitelist: Boolean(r.requiresWhitelist),
    }
  }

  return { rounds: [toOnChain(r0), toOnChain(r1), toOnChain(r2)], paused }
}

// ── Wallet helpers ───────────────────────────────────────────────────────────

declare global {
  interface Window { ethereum?: any }
}

async function connectWallet(): Promise<{ address: string; provider: ethers.BrowserProvider }> {
  if (!window.ethereum) throw new Error('No wallet found. Install MetaMask or Trust Wallet.')
  const provider = new ethers.BrowserProvider(window.ethereum)
  const accounts: string[] = await provider.send('eth_requestAccounts', [])
  if (!accounts.length) throw new Error('No account selected.')

  const { chainId } = await provider.getNetwork()
  if (Number(chainId) !== ACTIVE_CHAIN_ID) {
    try {
      await provider.send('wallet_switchEthereumChain', [{ chainId: `0x${ACTIVE_CHAIN_ID.toString(16)}` }])
    } catch {
      await provider.send('wallet_addEthereumChain', [{
        chainId: `0x${ACTIVE_CHAIN_ID.toString(16)}`,
        chainName: 'BSC Testnet',
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        rpcUrls: [BSC_TESTNET_RPC],
        blockExplorerUrls: ['https://testnet.bscscan.com'],
      }])
    }
  }

  return { address: accounts[0], provider }
}

// ── Purchase Panel ───────────────────────────────────────────────────────────

type Step = 'select' | 'connect' | 'approve' | 'buy' | 'done'

function TokenPurchasePanel({ chainData }: { chainData: ChainData | null }) {
  const { notify }    = useToast()
  const [roundId, setRoundId]       = useState(2)
  const [usdtInput, setUsdtInput]   = useState('100')
  const [step, setStep]             = useState<Step>('select')
  const [wallet, setWallet]         = useState<{ address: string; provider: ethers.BrowserProvider } | null>(null)
  const [usdtBalance, setUsdtBalance] = useState<bigint | null>(null)
  const [userSpent, setUserSpent]   = useState<bigint | null>(null)
  const [txHash, setTxHash]         = useState('')
  const [farmReceived, setFarmReceived] = useState<bigint>(0n)
  const [loading, setLoading]       = useState(false)
  const [errMsg, setErrMsg]         = useState('')

  const round     = SALE_ROUNDS[roundId]
  const onChain   = chainData?.rounds[roundId] ?? null
  const usdtWei   = (() => { try { return ethers.parseUnits(usdtInput || '0', 18) } catch { return 0n } })()
  const farmEst   = usdtWei > 0n ? (usdtWei * BigInt(1e18)) / round.priceWei : 0n
  const contracts = CONTRACTS[BSC_TESTNET_CHAIN_ID]

  const loadUserInfo = useCallback(async (addr: string, provider: ethers.BrowserProvider) => {
    const p = new ethers.JsonRpcProvider(BSC_TESTNET_RPC)
    const usdt = new ethers.Contract(contracts.usdt, ERC20_ABI, p)
    const sale = new ethers.Contract(contracts.farmTokenSale, FARM_TOKEN_SALE_ABI, p)
    const [bal, sp] = await Promise.all([
      usdt.balanceOf(addr).catch(() => 0n),
      sale.spent(roundId, addr).catch(() => 0n),
    ])
    setUsdtBalance(BigInt(bal))
    setUserSpent(BigInt(sp))
  }, [roundId, contracts])

  const handleConnect = async () => {
    setLoading(true)
    setErrMsg('')
    try {
      const w = await connectWallet()
      setWallet(w)
      await loadUserInfo(w.address, w.provider)
      setStep('approve')
    } catch (e: any) {
      setErrMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!wallet) return
    setLoading(true)
    setErrMsg('')
    try {
      const signer = await wallet.provider.getSigner()
      const usdt   = new ethers.Contract(contracts.usdt, ERC20_ABI, signer)
      const currentAllowance: bigint = await usdt.allowance(wallet.address, contracts.farmTokenSale)

      if (currentAllowance >= usdtWei) {
        setStep('buy')
        return
      }

      notify('Waiting for USDT approval signature…')
      const tx = await usdt.approve(contracts.farmTokenSale, usdtWei)
      notify('Approving USDT…')
      await tx.wait()
      notify('USDT approved!')
      setStep('buy')
    } catch (e: any) {
      setErrMsg(e.message?.slice(0, 120) ?? 'Approval failed')
    } finally {
      setLoading(false)
    }
  }

  const handleBuy = async () => {
    if (!wallet) return
    setLoading(true)
    setErrMsg('')
    try {
      const signer = await wallet.provider.getSigner()
      const sale   = new ethers.Contract(contracts.farmTokenSale, FARM_TOKEN_SALE_ABI, signer)
      notify('Waiting for purchase signature…')
      const tx = await sale.buy(roundId, usdtWei)
      notify('Processing purchase…')
      const receipt = await tx.wait()
      const purchasedEvent = receipt?.logs
        ?.map((l: any) => { try { return sale.interface.parseLog(l) } catch { return null } })
        ?.find((e: any) => e?.name === 'Purchased')
      const farmsGot: bigint = purchasedEvent ? BigInt(purchasedEvent.args.farmAmount) : farmEst
      setFarmReceived(farmsGot)
      setTxHash(tx.hash)
      setStep('done')
    } catch (e: any) {
      setErrMsg(e.message?.slice(0, 120) ?? 'Purchase failed')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') return (
    <div className="purchase-panel claim-panel">
      <div className="success-hero">
        <div className="success-check">✓</div>
        <span className="section-kicker">PURCHASE COMPLETE</span>
        <h2>Your $FARM is<br /><em>on the trail.</em></h2>
        <p>Your tokens are now locked in the vesting vault and will unlock as per your round schedule.</p>
        <div className="claim-stat"><small>$FARM received</small><strong>{Number(ethers.formatEther(farmReceived)).toLocaleString(undefined, { maximumFractionDigits: 2 })} FARM</strong></div>
        <a
          href={`https://testnet.bscscan.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-button"
          style={{ display:'flex', alignItems:'center', gap:4, marginTop:8 }}
        >
          View on BscScan <ExternalLink size={13} />
        </a>
      </div>
      <div className="claim-summary">
        <div className="claim-stat"><small>Round</small><strong>{round.name}</strong></div>
        <div className="claim-stat"><small>TGE unlock</small><strong>{round.unlock}</strong></div>
        <div className="claim-stat"><small>Vesting</small><strong>{round.vesting} linear</strong></div>
        {round.cliff !== '0 months' && <div className="claim-stat"><small>Cliff</small><strong>{round.cliff}</strong></div>}
        <div className="claim-actions">
          <button className="text-button" onClick={() => { setStep('select'); setTxHash(''); setFarmReceived(0n) }}>Buy more $FARM</button>
        </div>
      </div>
    </div>
  )

  const stepLabel: Record<Step, string> = {
    select:  '01 Choose round',
    connect: '02 Connect wallet',
    approve: '02 Connect wallet',
    buy:     '03 Review & buy',
    done:    '✓ Done',
  }
  const steps = ['01 Choose round', '02 Connect wallet', '03 Review & buy']
  const activeIdx = step === 'select' ? 0 : step === 'connect' ? 1 : step === 'approve' ? 1 : 2

  return (
    <div className="purchase-panel">
      <div className="purchase-stepper">
        {steps.map((s, i) => <span key={s} className={i === activeIdx ? 'active' : i < activeIdx ? 'done' : ''}>{s}</span>)}
      </div>

      <div className="purchase-grid">
        <div className="purchase-main">
          <span className="section-kicker">Buy $FARM token</span>
          <h2>Choose your entry<br /><em>into the frontier.</em></h2>
          <p className="purchase-intro">Select a sale round, enter your USDT amount, and sign once to purchase your FARM allocation.</p>

          {chainData?.paused && (
            <div className="error-banner">Sale is currently paused by admin. Check back soon.</div>
          )}

          <div className="round-select-grid">
            {SALE_ROUNDS.map((r) => {
              const oc = chainData?.rounds[r.id]
              const pct = oc && oc.totalAllocation > 0n
                ? Number((oc.sold * 100n) / oc.totalAllocation)
                : 0
              return (
                <button
                  key={r.key}
                  className={roundId === r.id ? 'round-select active' : 'round-select'}
                  onClick={() => { setRoundId(r.id); if (step !== 'select') setStep('select') }}
                >
                  <span>{r.name}</span>
                  <strong>${r.price} <small>/ FARM</small></strong>
                  <small>{r.supply} · {new Date(r.startIso).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}</small>
                  {oc && <small style={{ color: pct >= 99 ? '#ef4444' : '#10b981' }}>{pct}% sold</small>}
                </button>
              )
            })}
          </div>

          {onChain && (
            <ProgressBar sold={onChain.sold} total={onChain.totalAllocation} />
          )}

          <div className="purchase-form">
            <div className="form-heading">
              <span>USDT amount</span>
              <span>1 FARM = ${round.price} USDT</span>
            </div>
            {usdtBalance !== null && (
              <div className="balance-hint">
                Balance: {Number(ethers.formatUnits(usdtBalance, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
                <button className="text-button" onClick={() => setUsdtInput(ethers.formatUnits(usdtBalance, 18))}>MAX</button>
              </div>
            )}
            <div className="amount-box">
              <input
                aria-label="USDT amount"
                inputMode="decimal"
                value={usdtInput}
                onChange={(e) => setUsdtInput(e.target.value)}
                placeholder="100"
              />
              <span className="currency-label">USDT</span>
            </div>
            <div className="conversion">
              <span>You receive</span>
              <strong>{Number(ethers.formatEther(farmEst)).toLocaleString(undefined, { maximumFractionDigits: 2 })} $FARM</strong>
            </div>
            {userSpent !== null && userSpent > 0n && (
              <div className="already-spent">
                Already purchased: {Number(ethers.formatUnits(userSpent, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
              </div>
            )}

            {errMsg && <div className="error-banner">{errMsg}</div>}

            {step === 'select' && (
              <button className="primary-button purchase-cta" onClick={handleConnect} disabled={loading || !!chainData?.paused}>
                {loading ? <><Loader2 size={15} className="spin" /> Connecting…</> : <>Connect wallet to continue <Wallet size={15} /></>}
              </button>
            )}
            {(step === 'approve') && (
              <button className="primary-button purchase-cta" onClick={handleApprove} disabled={loading || usdtWei === 0n}>
                {loading ? <><Loader2 size={15} className="spin" /> Approving USDT…</> : <>Approve {usdtInput} USDT <ArrowRight size={15} /></>}
              </button>
            )}
            {step === 'buy' && (
              <button className="primary-button purchase-cta" onClick={handleBuy} disabled={loading || usdtWei === 0n}>
                {loading ? <><Loader2 size={15} className="spin" /> Buying…</> : <>Confirm purchase — {Number(ethers.formatEther(farmEst)).toLocaleString(undefined, { maximumFractionDigits: 0 })} FARM <ArrowRight size={15} /></>}
              </button>
            )}

            {wallet && (
              <small className="wallet-connected">
                Connected: {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)} · BSC Testnet
              </small>
            )}
            {!wallet && (
              <small className="purchase-note">MetaMask / Trust Wallet · BSC Testnet (chain 97)</small>
            )}
          </div>
        </div>

        <aside className="purchase-summary">
          <div className="summary-mascot"><img src="/bandit-buddy-mascot.png" alt="Bandit Buddy mascot" /></div>
          <span className="live-round-label">{round.name.toUpperCase()}</span>
          <h3>Allocation summary</h3>
          <div className="summary-line"><span>Pay</span><strong>{usdtInput || '0'} USDT</strong></div>
          <div className="summary-line"><span>Receive</span><strong>{Number(ethers.formatEther(farmEst)).toLocaleString(undefined, { maximumFractionDigits: 2 })} FARM</strong></div>
          <div className="vesting-box">
            <Shield size={15} />
            <div>
              <strong>Vesting locked</strong>
              <p>
                {round.unlock} at TGE · {round.vesting} linear vesting
                {round.cliff !== '0 months' && ` · ${round.cliff} cliff`}
              </p>
            </div>
          </div>
          {round.whitelist && (
            <div className="whitelist-note">
              <Shield size={13} /> Whitelist required for this round
            </div>
          )}
          <div className="trust-list">
            <span><Shield size={13} /> Funds go directly to contract</span>
            <span><BookOpen size={13} /> Vesting enforced on-chain</span>
            <span><Users size={13} /> Community allocation</span>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TokenSale() {
  const [chainData, setChainData] = useState<ChainData | null>(null)

  useEffect(() => {
    fetchChainData()
      .then(setChainData)
      .catch(() => {})
  }, [])

  return (
    <section className="docs-page">
      <div className="docs-hero">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> BANDIT BUDDY · WEB3 BRIEF</span>
          <h1>Own your<br /><span>piece of play.</span></h1>
          <p>A transparent look at the $FARM ecosystem, community allocation, and the path to a healthier player-owned economy.</p>
        </div>
        <div className="docs-stamp">
          <img src="/bandit-buddy-mascot.png" alt="Bandit Buddy raccoon mascot" />
          <strong>$FARM</strong>
          <small>COMMUNITY SALE</small>
        </div>
      </div>

      <TokenPurchasePanel chainData={chainData} />

      <div className="trust-strip">
        <span><Shield size={15} /> On-chain vesting</span>
        <span><span>⏱</span> 30-day windows</span>
        <span><Wallet size={15} /> MetaMask / Trust</span>
        <span><BookOpen size={15} /> Public brief</span>
      </div>

      <div className="sale-stats">
        <div>
          <strong>{chainData ? Number(ethers.formatEther(chainData.rounds.reduce((acc, r) => acc + (r?.sold ?? 0n), 0n))).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</strong>
          <span>FARM sold across all rounds</span>
        </div>
        <div><strong>1B</strong><span>total supply</span></div>
        <div><strong>$5M</strong><span>target Public FDV</span></div>
      </div>

      <div className="sale-live-hero">
        <div className="live-copy">
          <span className="live-kicker"><span /> NEXT SALE WINDOW</span>
          <h2>The public round is your<br /><em>frontier moment.</em></h2>
          <p>Join the community allocation at the clearest valuation step-up in the journey. Connect your wallet before the window opens.</p>
          <div className="live-proof">
            <span><Shield size={14} /> On-chain vesting</span>
            <span><Users size={14} /> Community-led</span>
            <span><Sparkles size={14} /> 5x step-up</span>
          </div>
        </div>
        <div className="live-action">
          <span className="live-round-label">PUBLIC SALE / IDO</span>
          <strong>$0.005 <small>/ $FARM</small></strong>
          <SaleCountdown startIso="2026-12-01T00:00:00+07:00" endIso="2026-12-30T23:59:59+07:00" />
          {chainData?.rounds[2] && (
            <ProgressBar sold={chainData.rounds[2]!.sold} total={chainData.rounds[2]!.totalAllocation} />
          )}
        </div>
      </div>

      <div className="sale-rounds">
        {SALE_ROUNDS.map((r, i) => {
          const oc = chainData?.rounds[r.id]
          return (
            <article key={r.key} className={`sale-card sale-round ${r.key}`}>
              <div className="round-head">
                <span className="round-badge">0{i + 1}</span>
                <div>
                  <span className="section-kicker">{r.name} · {r.supply}</span>
                  <h2>${r.price} <small>/ $FARM</small></h2>
                </div>
                <strong>{r.key === 'angel' ? '$50K' : r.key === 'private' ? '$175K' : '$250K'}</strong>
              </div>
              <p>{r.copy}</p>
              {oc && <ProgressBar sold={oc.sold} total={oc.totalAllocation} />}
              <SaleCountdown startIso={r.startIso} endIso={r.endIso} />
              <div className="round-meta">
                <span>FDV <b>{r.fdv}</b></span>
                {r.cliff !== '0 months' ? <span>Cliff <b>{r.cliff}</b></span> : <span>Unlock <b>{r.unlock}</b></span>}
                <span>Vesting <b>{r.vesting}</b></span>
                <span>Target <b>{r.target}</b></span>
              </div>
            </article>
          )
        })}
      </div>

      <div className="sale-grid">
        <article className="sale-card">
          <span className="section-kicker">Allocation</span>
          <h2>Built for the frontier</h2>
          {[['Ecosystem & P2E', '40%'], ['Treasury & marketing', '18%'], ['Team & advisors', '15%'], ['Seed sale', '12%'], ['Liquidity & MM', '10%'], ['Public sale / IDO', '5%']].map(([name, value]) => (
            <div className="allocation" key={name}><span>{name}</span><strong>{value}</strong><i style={{ width: value }} /></div>
          ))}
        </article>
        <article className="sale-card sale-highlight">
          <span className="section-kicker">Community sale</span>
          <h2>Join the first crew</h2>
          <p>Angel buyers enter at $0.001 and see a 5x target step-up at the $0.005 Public Sale valuation. Tokens vest on-chain — no counterparty risk.</p>
          <div className="sale-price"><strong>1 $FARM</strong><span>= $0.005 IDO target</span></div>
          <a
            href={`https://testnet.bscscan.com/address/${CONTRACTS[BSC_TESTNET_CHAIN_ID].farmTokenSale}`}
            target="_blank"
            rel="noopener noreferrer"
            className="primary-button"
            style={{ display:'flex', alignItems:'center', gap:6, textDecoration:'none' }}
          >
            View contract <ExternalLink size={14} />
          </a>
        </article>
      </div>

      <div className="docs-disclaimer">
        <Shield size={15} />
        <span>
          Contract: <a
            href={`https://testnet.bscscan.com/address/${CONTRACTS[BSC_TESTNET_CHAIN_ID].farmTokenSale}`}
            target="_blank" rel="noopener noreferrer"
          >
            {CONTRACTS[BSC_TESTNET_CHAIN_ID].farmTokenSale}
          </a> · BSC Testnet (Chain 97) ·
          Not financial advice. Token mechanics, eligibility, and vesting are governed by the on-chain contract.
        </span>
      </div>
    </section>
  )
}
