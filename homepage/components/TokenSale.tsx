'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, Shield, Sparkles, Users, Wallet } from 'lucide-react'
import { useToast } from './ToastProvider'

function SaleCountdown({ start, end }: { start: string; end: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const active = now >= startMs && now < endMs
  const target = now < startMs ? startMs : endMs
  const remaining = Math.max(0, target - now)
  const days = Math.floor(remaining / 86400000)
  const hours = Math.floor(remaining / 3600000) % 24
  const minutes = Math.floor(remaining / 60000) % 60
  const seconds = Math.floor(remaining / 1000) % 60
  const pad = (v: number) => v.toString().padStart(2, '0')

  return (
    <div className="countdown">
      <span className={active ? 'countdown-status live' : 'countdown-status'}>
        {now < startMs ? 'STARTS IN' : active ? 'ENDS IN' : 'ROUND ENDED'}
      </span>
      {now <= endMs && <strong>{days}d <b>{pad(hours)}:{pad(minutes)}:{pad(seconds)}</b></strong>}
      <small>{new Date(startMs).toLocaleDateString('en-GB')} — {new Date(endMs).toLocaleDateString('en-GB')}</small>
    </div>
  )
}

const saleRounds = [
  { id: 'angel',   name: 'Angel round',       supply: '5% supply', price: 0.001,  start: '01 Oct 2026', end: '30 Oct 2026', unlock: '0% TGE',  vesting: '18 months', cliff: '3 months', copy: 'The earliest supporters fund the game foundation, from UI/UX and backend build to the first playable frontier.',                                              startIso: '2026-10-01T00:00:00+07:00', endIso: '2026-10-30T23:59:59+07:00', fdv: '$1M',   target: '' },
  { id: 'private', name: 'Private sale',       supply: '7% supply', price: 0.0025, start: '01 Nov 2026', end: '30 Nov 2026', unlock: '5% TGE',  vesting: '18 months', cliff: '0 months', copy: 'Strategic VCs and Web3 guilds help turn early traction into a growing partner network and a stronger player economy.',                                       startIso: '2026-11-01T00:00:00+07:00', endIso: '2026-11-30T23:59:59+07:00', fdv: '$2.5M', target: '' },
  { id: 'public',  name: 'Public sale / IDO', supply: '5% supply', price: 0.005,  start: '01 Dec 2026', end: '30 Dec 2026', unlock: '25% TGE', vesting: '12 months', cliff: '0 months', copy: 'The community round opens the frontier wider, with a clear 5x valuation step-up from the earliest planned entry.',                                           startIso: '2026-12-01T00:00:00+07:00', endIso: '2026-12-30T23:59:59+07:00', fdv: '$5M',   target: '50M tokens' },
]

function TokenPurchasePanel() {
  const { notify } = useToast()
  const [roundId, setRoundId] = useState('public')
  const [payCurrency, setPayCurrency] = useState<'FARM' | 'USDT'>('USDT')
  const [amount, setAmount] = useState('1000')
  const [connected, setConnected] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [complete, setComplete] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [purchasedAt] = useState(() => new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))

  const round = saleRounds.find((r) => r.id === roundId) ?? saleRounds[2]
  const numericAmount = Math.max(0, Number(amount) || 0)
  const tokens = payCurrency === 'USDT' ? numericAmount / round.price : numericAmount
  const total  = payCurrency === 'USDT' ? numericAmount : numericAmount * round.price

  if (complete) return (
    <div className="purchase-panel claim-panel">
      <div className="success-hero">
        <div className="success-check">✓</div>
        <span className="section-kicker">PURCHASE COMPLETE · PREVIEW RECEIPT</span>
        <h2>Your $FARM is<br /><em>on the trail.</em></h2>
        <p>Purchase recorded successfully. Your tokens are now tracked in the vesting vault and can be claimed as they unlock.</p>
        <span className="receipt-id">Receipt BB-{round.id.toUpperCase()}-{purchasedAt.replace(/\D/g, '').slice(-6)}</span>
      </div>
      <div className="claim-summary">
        <div className="claim-stat"><small>Purchased</small><strong>{purchasedAt}</strong></div>
        <div className="claim-stat"><small>Rate</small><strong>${round.price} / FARM</strong></div>
        <div className="claim-stat"><small>Allocation</small><strong>{tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} FARM</strong></div>
        <div className="vesting-timeline">
          <div className="vesting-title">
            <span>Vesting schedule</span>
            <b>{claimed ? 'Claimed' : `${round.unlock} unlocked at TGE`}</b>
          </div>
          <div className="vesting-bar">
            <i style={{ width: claimed ? '25%' : round.id === 'angel' ? '0%' : round.id === 'private' ? '5%' : '25%' }} />
          </div>
          <div className="vesting-points">
            <span><b>{round.unlock}</b><small>TGE unlock</small></span>
            <span><b>{round.cliff === '0 months' ? 'Starts TGE' : round.cliff}</b><small>{round.cliff === '0 months' ? 'Linear vesting' : 'Cliff period'}</small></span>
            <span><b>{round.vesting}</b><small>Fully vested</small></span>
          </div>
        </div>
        <div className="claim-actions">
          <button className="primary-button" disabled={claimed} onClick={() => { setClaimed(true); notify('Claim request submitted in preview') }}>
            {claimed ? 'Claim submitted' : `Claim ${round.unlock === '0% TGE' ? 'unlocked' : 'available'} $FARM`} <ArrowRight size={15} />
          </button>
          <button className="text-button" onClick={() => setComplete(false)}>Buy more $FARM</button>
        </div>
        <small className="claim-note">Claiming will require a wallet signature. No funds move in this preview.</small>
      </div>
    </div>
  )

  return (
    <div className="purchase-panel">
      <div className="purchase-stepper">
        <span className="active">01 Choose round</span>
        <span>02 Connect wallet</span>
        <span>03 Review & buy</span>
      </div>
      <div className="purchase-grid">
        <div className="purchase-main">
          <span className="section-kicker">Buy $FARM token</span>
          <h2>Choose your entry<br /><em>into the frontier.</em></h2>
          <p className="purchase-intro">Select a sale round, enter your amount, and review your allocation before signing. You stay in control at every step.</p>
          <div className="round-select-grid">
            {saleRounds.map((r) => (
              <button key={r.id} className={round.id === r.id ? 'round-select active' : 'round-select'} onClick={() => setRoundId(r.id)}>
                <span>{r.name}</span>
                <strong>${r.price} <small>/ FARM</small></strong>
                <small>{r.supply} · {r.start}</small>
              </button>
            ))}
          </div>
          <div className="purchase-form">
            <div className="form-heading"><span>Amount</span><span>1 FARM = ${round.price} USDT</span></div>
            <div className="amount-box">
              <input aria-label="Amount to purchase" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select aria-label="Payment currency" value={payCurrency} onChange={(e) => setPayCurrency(e.target.value as 'FARM' | 'USDT')}>
                <option value="USDT">USDT</option>
                <option value="FARM">FARM</option>
              </select>
            </div>
            <div className="conversion"><span>You receive</span><strong>{tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} $FARM</strong></div>
            <button className="primary-button purchase-cta" onClick={() => { if (!connected) { setConnected(true); notify('Wallet connected in preview') } else setReviewing(true) }}>
              {connected ? 'Review purchase' : 'Connect wallet to continue'} <Wallet size={15} />
            </button>
            <small className="purchase-note">MetaMask / Trust Wallet · Network and gas details appear before signing</small>
          </div>
        </div>

        <aside className="purchase-summary">
          <div className="summary-mascot"><img src="/bandit-buddy-mascot.png" alt="Bandit Buddy mascot" /></div>
          <span className="live-round-label">{round.name.toUpperCase()}</span>
          <h3>Allocation summary</h3>
          <div className="summary-line"><span>Pay with</span><strong>{total.toLocaleString(undefined, { maximumFractionDigits: 4 })} {payCurrency}</strong></div>
          <div className="summary-line"><span>Receive</span><strong>{tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} FARM</strong></div>
          <div className="vesting-box">
            <Shield size={15} />
            <div>
              <strong>Vesting locked</strong>
              <p>{round.unlock} at TGE · then {round.vesting} linear vesting{round.cliff !== '0 months' ? ` · ${round.cliff} cliff` : ''}</p>
            </div>
          </div>
          <div className="trust-list">
            <span><Shield size={13} /> Terms shown before signature</span>
            <span><BookOpen size={13} /> Public sale brief available</span>
            <span><Users size={13} /> Community allocation</span>
          </div>
          {reviewing && (
            <div className="review-box">
              <strong>Ready to review</strong>
              <p>Wallet signature is simulated in this preview. No funds will move.</p>
              <button onClick={() => { setReviewing(false); setComplete(true); notify('Purchase completed in preview') }}>Confirm preview</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

export default function TokenSale() {
  const { notify } = useToast()

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

      <TokenPurchasePanel />

      <div className="trust-strip">
        <span><Shield size={15} /> Clear allocation</span>
        <span><span>⏱</span> 30-day windows</span>
        <span><Wallet size={15} /> Wallet-ready</span>
        <span><BookOpen size={15} /> Public brief</span>
      </div>

      <div className="sale-stats">
        <div><strong>1B</strong><span>total supply</span></div>
        <div><strong>40%</strong><span>ecosystem & P2E</span></div>
        <div><strong>$5M</strong><span>target Public FDV</span></div>
      </div>

      <div className="sale-live-hero">
        <div className="live-copy">
          <span className="live-kicker"><span /> NEXT SALE WINDOW</span>
          <h2>The public round is your<br /><em>frontier moment.</em></h2>
          <p>Join the community allocation at the clearest valuation step-up in the journey. Connect your wallet, confirm eligibility, and be ready before the window closes.</p>
          <div className="live-proof">
            <span><Shield size={14} /> Transparent terms</span>
            <span><Users size={14} /> Community-led</span>
            <span><Sparkles size={14} /> 5x step-up</span>
          </div>
        </div>
        <div className="live-action">
          <span className="live-round-label">PUBLIC SALE / IDO</span>
          <strong>$0.005 <small>/ $FARM</small></strong>
          <SaleCountdown start="2026-12-01T00:00:00+07:00" end="2026-12-30T23:59:59+07:00" />
          <button className="primary-button" onClick={() => notify('Connect wallet to join the public sale waitlist')}>
            Join the waitlist <ArrowRight size={15} />
          </button>
          <small className="cta-note">No transaction is executed in this preview.</small>
        </div>
      </div>

      <div className="sale-rounds">
        {saleRounds.map((r, i) => (
          <article key={r.id} className={`sale-card sale-round ${r.id}`}>
            <div className="round-head">
              <span className="round-badge">0{i + 1}</span>
              <div>
                <span className="section-kicker">{r.name} · {r.supply}</span>
                <h2>${r.price} <small>/ $FARM</small></h2>
              </div>
              <strong>${r.id === 'angel' ? '50K' : r.id === 'private' ? '175K' : '250K'}</strong>
            </div>
            <p>{r.copy}</p>
            <SaleCountdown start={r.startIso} end={r.endIso} />
            <div className="round-meta">
              <span>FDV <b>{r.fdv}</b></span>
              {r.cliff !== '0 months' ? <span>Cliff <b>{r.cliff}</b></span> : <span>Unlock <b>{r.unlock}</b></span>}
              <span>Vesting <b>{r.vesting}</b></span>
              {r.target && <span>Target <b>{r.target}</b></span>}
            </div>
          </article>
        ))}
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
          <p>Seed buyers enter at $0.001 and see a 5x target step-up at the $0.005 Public Sale valuation. Final terms remain subject to eligibility, audits, vesting, and local law.</p>
          <div className="sale-price"><strong>1 $FARM</strong><span>= $0.005 IDO target</span></div>
          <button className="primary-button" onClick={() => notify('Connect wallet to view sale eligibility')}>
            Connect wallet <Wallet size={15} />
          </button>
          <small>No transaction is executed in this preview.</small>
        </article>
      </div>

      <div className="docs-disclaimer">
        <Shield size={15} />
        <span>This is an illustrative product brief, not financial advice. Token mechanics, eligibility, audits, vesting, and regulatory treatment must be confirmed before launch.</span>
      </div>
    </section>
  )
}
