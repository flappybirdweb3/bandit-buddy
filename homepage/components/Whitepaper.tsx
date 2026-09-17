import { BookOpen, Shield } from 'lucide-react'

export default function Whitepaper() {
  return (
    <section className="docs-page">
      <div className="docs-hero">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> BANDIT BUDDY · WEB3 BRIEF</span>
          <h1>The frontier,<br /><span>by design.</span></h1>
          <p>A plain-language overview of the game economy, ownership model, and systems that make Bandit Buddy a player-shaped frontier.</p>
        </div>
        <div className="docs-stamp">
          <img src="/bandit-buddy-mascot.png" alt="Bandit Buddy raccoon mascot" />
          <strong>v0.1</strong>
          <small>OPEN BRIEFING</small>
        </div>
      </div>

      <div className="docs-callout">
        <BookOpen size={18} />
        <div>
          <strong>What matters most</strong>
          <p>Guilds create a free path into the game; premium staking adds optional rewards. Fusion uses three Guard Dog NFTs plus a fee and burns the inputs, while commit–reveal and oracle checks make random outcomes auditable.</p>
        </div>
        <span>Based on<br />the brief</span>
      </div>

      <div className="docs-grid">
        <article>
          <span className="doc-number">01</span>
          <h2>Play loop</h2>
          <p>Grow land, complete bounties, collect buddies, and reinvest resources into a ranch that becomes more capable over time.</p>
        </article>
        <article>
          <span className="doc-number">02</span>
          <h2>Guild access</h2>
          <p>Free guild slots lower the barrier to entry. Premium guilds can stake $FARM for enhanced benefits without making ownership mandatory.</p>
        </article>
        <article>
          <span className="doc-number">03</span>
          <h2>Fusion economy</h2>
          <p>Combine three Guard Dog NFTs and a fee to mint an upgraded dog. The three source NFTs are burned, creating a clear supply sink.</p>
        </article>
        <article>
          <span className="doc-number">04</span>
          <h2>Fair randomness</h2>
          <p>Commit–reveal flow and an oracle-backed randomness source help players verify that rare drops and upgrades were not manipulated.</p>
        </article>
      </div>

      <div className="docs-disclaimer">
        <Shield size={15} />
        <span>This is an illustrative product brief, not financial advice. Token mechanics, eligibility, audits, vesting, and regulatory treatment must be confirmed before launch.</span>
      </div>
    </section>
  )
}
