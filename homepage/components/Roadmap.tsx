import { Clock, Coins, Shield, Sparkles } from 'lucide-react'

const phases = [
  { phase: 'Phase 1 · Genesis Gacha',       status: 'NOW',  copy: 'Launch the simple ERC-1155 Gacha loop and establish Genesis Dogs.' },
  { phase: 'Phase 2 · Breeding evolution',   status: 'NEXT', copy: 'Bridge Genesis Dogs into ERC-721 Genetic NFTs through the Evolution Portal.' },
  { phase: 'Phase 3 · Genetic marketplace',  status: 'LATER', copy: 'Trade rare bloodlines, Excellent options, and player-built dog strategies.' },
]

const trail = [
  { label: 'NOW',     title: 'Foundation',         copy: 'Ranch core, wallet-ready collectibles, first bounties',                     status: 'live' },
  { label: 'NEXT',    title: 'Social-Fi guilds',   copy: 'Free and premium guilds, staking dashboard, crew rewards',                  status: 'next' },
  { label: 'THEN',    title: 'Fusion economy',     copy: 'Guard Dog upgrades, burn mechanics, pity protection and crafting sinks',    status: 'later' },
  { label: 'HORIZON', title: 'On-chain launch',    copy: 'Audited contracts, oracle randomness, marketplace and regional expansion',  status: 'later' },
]

export default function Roadmap() {
  return (
    <section className="docs-page">
      <div className="docs-hero">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> BANDIT BUDDY · WEB3 BRIEF</span>
          <h1>A trail worth<br /><span>following.</span></h1>
          <p>From the first campfire to a living on-chain world. Here is where we are headed, and what we are building next.</p>
        </div>
        <div className="docs-stamp">
          <img src="/bandit-buddy-mascot.png" alt="Bandit Buddy raccoon mascot" />
          <strong>SEASON 01</strong>
          <small>THE DUSTY TRAIL</small>
        </div>
      </div>

      <div className="roadmap-list">
        {phases.map(({ phase, status, copy }) => (
          <div key={phase} className={`roadmap-row${status === 'NEXT' ? ' featured' : ''}`}>
            <span className={`roadmap-status ${status === 'NOW' ? 'active' : status === 'NEXT' ? 'next' : 'later'}`}>{status}</span>
            <div><strong>{phase}</strong><p>{copy}</p></div>
            <b>{phases.indexOf({ phase, status, copy } as typeof phases[0]) + 1 < 10 ? `0${phases.indexOf({ phase, status, copy } as typeof phases[0]) + 1}` : phases.indexOf({ phase, status, copy } as typeof phases[0]) + 1}</b>
          </div>
        ))}
      </div>

      <div className="roadmap-callout breeding-feature">
        <div className="breeding-icon"><Sparkles size={25} /></div>
        <div>
          <span className="section-kicker">PHASE 2 EXPANSION · BANDIT DOG GENETICS</span>
          <h2>Breed the rarest<br /><em>frontier bloodlines.</em></h2>
          <p>After the Genesis Gacha phase, Bandit Buddy evolves into a player-owned genetics economy. Breed ERC-721 Genetic dogs, discover Excellent traits, and build the perfect protector for your farm.</p>
          <div className="breeding-signals">
            <span><Shield size={14} /> Excellent traits</span>
            <span><Clock size={14} /> Cooldown protected</span>
            <span><Coins size={14} /> $FARM sink</span>
          </div>
        </div>
        <div className="breeding-badge"><strong>PHASE 2</strong><small>IN THE TRAIL MAP</small></div>
      </div>

      <div className="breeding-grid">
        <article>
          <span className="doc-number">01</span>
          <h3>Genetic DNA</h3>
          <p>Each dog carries a unique 256-bit DNA profile with dominant and recessive genes that shape rarity, appearance, and abilities.</p>
        </article>
        <article>
          <span className="doc-number">02</span>
          <h3>Excellent options</h3>
          <p>Hunt for Ferocity, Agility, Perception, Luck, and Aura traits. One line is Rare; three lines become Legendary; four to five can become Divine.</p>
        </article>
        <article>
          <span className="doc-number">03</span>
          <h3>Breed with purpose</h3>
          <p>Generation-based cooldowns and a $FARM breeding fee control supply while fusion burning keeps weak offspring out of the economy.</p>
        </article>
      </div>

      <div className="roadmap-list">
        {trail.map(({ label, title, copy, status }) => (
          <article className="roadmap-row" key={label}>
            <span className={`roadmap-marker ${status}`}>{status === 'live' ? '✓' : '→'}</span>
            <div><small>{label}</small><h2>{title}</h2><p>{copy}</p></div>
            <b>{status === 'live' ? 'SHIPPED' : status === 'next' ? 'IN BUILD' : 'PLANNED'}</b>
          </article>
        ))}
      </div>
    </section>
  )
}
