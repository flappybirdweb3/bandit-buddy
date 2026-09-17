'use client'

import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { useToast } from './ToastProvider'

const items = [
  { name: 'Moon crystal',   rarity: 'Rare',       color: 'violet', type: 'crystal', id: '#0246' },
  { name: 'Sunset corn',    rarity: 'Common',     color: 'gold',   type: 'corn',    id: '#0108' },
  { name: 'Dust bloom',     rarity: 'Epic',       color: 'coral',  type: 'flower',  id: '#0032' },
  { name: 'Lucky clover',   rarity: 'Uncommon',   color: 'green',  type: 'clover',  id: '#0177' },
  { name: 'Golden carrot',  rarity: 'Legendary',  color: 'gold',   type: 'carrot',  id: '#0009' },
  { name: 'Night cactus',   rarity: 'Rare',       color: 'violet', type: 'cactus',  id: '#0281' },
]

const filters = ['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']

export default function Collection() {
  const { notify } = useToast()
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(items[0])

  const shown = filter === 'All' ? items : items.filter((i) => i.rarity === filter)

  return (
    <section className="collection-screen">
      <div className="collection-top">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> COLLECTION · ON-CHAIN ASSETS</span>
          <h1>Small things.<br /><span>Big stories.</span></h1>
          <p>Every seed, buddy, and treasure you collect is yours to keep. Browse the pieces that make your frontier unique.</p>
        </div>
        <div className="collection-count">
          <strong>24</strong><span>assets owned</span><small>+3 this season</small>
        </div>
      </div>

      <div className="collection-layout">
        <div>
          <div className="collection-filter">
            {filters.map((f) => (
              <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          <div className="asset-grid">
            {shown.map((item) => (
              <button key={item.id} className={`asset-card ${selected.id === item.id ? 'asset-selected' : ''}`} onClick={() => setSelected(item)}>
                <div className={`asset-art ${item.color} ${item.type}`}><span /><span /><span /></div>
                <div><strong>{item.name}</strong><small>{item.rarity} · {item.id}</small></div>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </div>

        <aside className="asset-detail">
          <span className="detail-label">SELECTED ASSET</span>
          <div className={`detail-art ${selected.color} ${selected.type}`}><span /><span /><span /></div>
          <span className="rarity-badge">{selected.rarity}</span>
          <h2>{selected.name}</h2>
          <p>A frontier collectible with a story only you can tell. This asset lives in your wallet and grows with your ranch.</p>
          <div className="detail-stats">
            <span><small>Token ID</small><strong>{selected.id}</strong></span>
            <span><small>Collection</small><strong>Bandit Seeds</strong></span>
          </div>
          <button className="primary-button" onClick={() => notify(`${selected.name} details copied`)}>
            View on explorer <ArrowRight size={15} />
          </button>
        </aside>
      </div>
    </section>
  )
}
