'use client'

import Link from 'next/link'
import { ArrowRight, Coins, Gem, House, Map, MessageCircle, Play, Shield, Sparkles, Star, Target, Trophy } from 'lucide-react'
import { useToast } from './ToastProvider'
import RanchScene from './RanchScene'

const crops = [
  { type: 'corn',    label: 'Sunset corn',   rarity: 'Common', color: 'gold' },
  { type: 'crystal', label: 'Moon crystal',  rarity: 'Rare',   color: 'violet' },
  { type: 'flower',  label: 'Dust bloom',    rarity: 'Epic',   color: 'coral' },
]

export default function HomeClient() {
  const { notify } = useToast()

  return (
    <>
      <section className="hero-shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> SEASON 01 · THE DUSTY TRAIL</div>
          <h1>Build your <span>legend.</span><br />Own the frontier.</h1>
          <p>Bandit Buddy is a living, breathing ranch game on-chain. Grow your land, collect rare buddies, and ride into a world where every choice is yours to keep.</p>
          <div className="hero-buttons">
            <a
              className="primary-button"
              href="https://dapp.banditbuddy.xyz"
              target="_blank"
              rel="noreferrer"
              onClick={() => notify('Your adventure is loading...')}
            >
              <Play size={17} fill="currentColor" /> Play now <ArrowRight size={17} />
            </a>
            <Link className="secondary-button" href="/collection">
              <Gem size={17} /> Explore collection
            </Link>
            <Link className="sale-hero-link" href="/token-sale">
              <Coins size={16} /> Join $FARM sale <ArrowRight size={14} />
            </Link>
          </div>
          <div className="hero-trust">
            <div className="avatar-stack"><span>BB</span><span>JR</span><span>MK</span><span>+4k</span></div>
            <span>4,200+ frontier folks already riding</span>
          </div>
        </div>
        <div className="hero-art-wrap">
          <div className="hero-stamp"><Star size={13} fill="currentColor" /> PLAY · GROW · OWN</div>
          <RanchScene />
        </div>
      </section>

      <section className="home-breeding-banner" aria-label="Breeding feature highlight">
        <div className="home-breeding-icon"><Sparkles size={21} /></div>
        <div>
          <span className="section-kicker">COMING IN PHASE 2 · BREEDING</span>
          <h2>Find the dog with the <em>perfect bloodline.</em></h2>
          <p>Genesis Dogs become the starting point for rare Excellent traits, cooldown strategy, and a new $FARM-powered economy.</p>
        </div>
        <Link className="text-button" href="/roadmap">See the breeding roadmap <ArrowRight size={15} /></Link>
      </section>

      <section className="player-strip" aria-label="Player profile and quick stats">
        <div className="player-profile">
          <div className="profile-avatar">BB</div>
          <div>
            <span className="profile-kicker">Rancher profile</span>
            <strong>Bandit Buddy <span className="verified">✓</span></strong>
            <small>Level 09 · Dustbowl County</small>
          </div>
        </div>
        <div className="level-meter">
          <div className="meter-label"><span>Frontier XP</span><b>2,480 / 3,000</b></div>
          <div className="meter-track"><i /></div>
        </div>
        <div className="quick-stat"><Coins size={21} /><div><small>Dust coins</small><strong>18,420</strong></div></div>
        <div className="quick-stat"><Gem size={21} /><div><small>Rare gems</small><strong>246</strong></div></div>
        <button className="profile-more" aria-label="Open profile" onClick={() => notify('Profile panel coming soon')}>
          <ArrowRight size={19} />
        </button>
      </section>

      <section className="content-grid">
        <div className="content-main">
          <div className="section-heading">
            <div>
              <span className="section-kicker">A little help from your friends</span>
              <h2>Today on the ranch</h2>
            </div>
            <button className="text-button" onClick={() => notify('All quests are up to date')}>
              View all quests <ArrowRight size={15} />
            </button>
          </div>
          <div className="quest-grid">
            <article className="quest-card quest-featured">
              <div className="quest-icon orange"><Target size={21} /></div>
              <div className="quest-info">
                <span className="quest-status">Daily bounty · 2h left</span>
                <h3>Harvest the sunflowers</h3>
                <p>Trade your harvest at the outpost before sunset.</p>
                <div className="quest-progress"><span><i /></span><b>7 / 10</b></div>
              </div>
              <button className="round-arrow" onClick={() => notify('Quest opened')}><ArrowRight size={17} /></button>
            </article>
            <article className="quest-card">
              <div className="quest-icon purple"><Shield size={21} /></div>
              <div className="quest-info">
                <span className="quest-status">Weekly challenge</span>
                <h3>Defend the homestead</h3>
                <p>Keep your streak alive for bonus XP.</p>
                <div className="quest-reward"><Trophy size={14} /> +320 XP <span>·</span> <Gem size={14} /> 12</div>
              </div>
              <button className="round-arrow" onClick={() => notify('Challenge accepted')}><ArrowRight size={17} /></button>
            </article>
          </div>

          <div className="section-heading collection-heading" id="collection">
            <div>
              <span className="section-kicker">Assets you can actually own</span>
              <h2>Your collection</h2>
            </div>
            <Link className="text-button" href="/collection">View collection <ArrowRight size={15} /></Link>
          </div>
          <div className="collection-grid">
            {crops.map((crop) => (
              <Link className={`collectible ${crop.color}`} key={crop.label} href="/collection">
                <div className={`crop-art ${crop.type}`}><span /><span /><span /></div>
                <div><strong>{crop.label}</strong><small><span className="rarity-dot" /> {crop.rarity}</small></div>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </div>

        <aside className="side-panel">
          <div className="panel-title">
            <span><Map size={16} /> Frontier map</span>
            <button onClick={() => notify('Map expanded')}><ArrowRight size={16} /></button>
          </div>
          <div className="mini-map">
            <span className="map-route route-one" />
            <span className="map-route route-two" />
            <span className="map-marker marker-home"><House size={13} /></span>
            <span className="map-marker marker-gem"><Gem size={13} /></span>
            <span className="map-marker marker-bounty"><Target size={13} /></span>
            <span className="map-mountain" />
            <span className="map-tree tree-one" />
            <span className="map-tree tree-two" />
          </div>
          <div className="map-footer">
            <span><i className="online-dot" /> 1,283 online</span>
            <strong>3 regions discovered</strong>
          </div>
          <div className="community-card">
            <div className="community-icon"><MessageCircle size={20} /></div>
            <div><strong>Pull up a chair</strong><p>Join the campfire and meet fellow ranchers.</p></div>
            <Link href="/community"><ArrowRight size={16} /></Link>
          </div>
        </aside>
      </section>
    </>
  )
}
