'use client'

import { ArrowRight, Coins, Compass, Gem, House, Sparkles } from 'lucide-react'
import { useToast } from './ToastProvider'

const stalls = [
  { name: 'Dust & Daisies',     type: 'Market stall',    value: '12.4K', icon: Coins,   tone: 'orange' },
  { name: 'Moonrise Exchange',  type: 'Trading post',    value: '8.7K',  icon: Gem,     tone: 'purple' },
  { name: 'The Stable',         type: 'Buddy services',  value: '4.2K',  icon: House,   tone: 'green' },
]

export default function Outpost() {
  const { notify } = useToast()

  return (
    <section className="outpost-page">
      <div className="outpost-hero">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> OUTPOST · DUSTBOWL COUNTY</span>
          <h1>Trade smart.<br /><span>Ride farther.</span></h1>
          <p>The Outpost is where the frontier changes hands. Swap resources, discover rare buddies, and make your next move count.</p>
          <button className="primary-button" onClick={() => notify('Market refreshed with the latest listings')}>
            <Compass size={16} /> Explore market <ArrowRight size={16} />
          </button>
        </div>
        <div className="outpost-map">
          <div className="map-sun" />
          <div className="map-hill hill-a" />
          <div className="map-hill hill-b" />
          <div className="outpost-tower"><div /><span>OUTPOST</span></div>
          <div className="trade-route" />
          <span className="map-pin pin-a"><Coins size={14} /></span>
          <span className="map-pin pin-b"><Gem size={14} /></span>
        </div>
      </div>

      <div className="market-head">
        <div>
          <span className="section-kicker">The frontier exchange</span>
          <h2>Open for business</h2>
        </div>
        <button className="filter-button" onClick={() => notify('Showing all market categories')}>
          All categories <ArrowRight size={14} />
        </button>
      </div>

      <div className="stall-grid">
        {stalls.map(({ name, type, value, icon: Icon, tone }) => (
          <article className="stall-card" key={name}>
            <div className={`stall-art ${tone}`}><Icon size={30} /><span>OPEN</span></div>
            <div className="stall-copy">
              <small>{type}</small>
              <h3>{name}</h3>
              <p>Fresh listings from trusted ranchers.</p>
              <div><strong>{value}</strong><span> volume today</span></div>
            </div>
            <button className="round-arrow" onClick={() => notify(`${name} opened`)} aria-label={`Open ${name}`}>
              <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </div>

      <div className="outpost-banner">
        <Sparkles size={18} />
        <div>
          <strong>Every trade helps build the valley</strong>
          <p>A small fee from every exchange goes back into community bounties and new frontier regions.</p>
        </div>
        <span>2.5% community share</span>
      </div>
    </section>
  )
}
