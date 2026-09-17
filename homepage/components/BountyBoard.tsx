'use client'

import { ArrowRight, Clock, Coins, Compass, Gem, Sparkles, Trophy } from 'lucide-react'
import { useToast } from './ToastProvider'

const bounties = [
  { title: 'The Great Sunflower Heist',  tag: 'Harvest',    reward: '420',   bonus: '1 Rare Gem',     progress: '7 / 10', tone: 'orange', icon: '✦', time: '2h 14m left',  posted: 'Daily bounty' },
  { title: 'Wanted: Dust Devil',          tag: 'Expedition', reward: '800',   bonus: 'Bandit Badge',   progress: '2 / 5',  tone: 'purple', icon: '◆', time: '18h left',     posted: 'Community quest' },
  { title: 'Build the Watchtower',        tag: 'Crafting',   reward: '1,250', bonus: 'Plot Blueprint', progress: '40%',    tone: 'green',  icon: '⌂', time: '2d 6h left',   posted: 'Frontier project' },
  { title: 'Trade Route Scout',           tag: 'Social',     reward: '260',   bonus: '75 Dust coins',  progress: '1 / 3',  tone: 'gold',   icon: '↗', time: '5h 40m left',  posted: 'Weekly challenge' },
]

export default function BountyBoard() {
  const { notify } = useToast()

  return (
    <section className="bounty-page">
      <div className="bounty-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> BOUNTY BOARD · DUSTBOWL COUNTY</span>
          <h1>Good deeds.<br /><span>Great rewards.</span></h1>
          <p>Pick a job, rally your buddies, and earn assets that stay yours. Every bounty pushes the frontier forward.</p>
        </div>
        <div className="board-poster">
          <span>WANTED</span><strong>BRAVE<br />RANCHERS</strong><small>REWARDS ARE ON-CHAIN</small><i>✦</i>
        </div>
      </div>

      <div className="bounty-toolbar">
        <div className="bounty-tabs">
          <button className="selected">All bounties <b>12</b></button>
          <button>Mine <b>3</b></button>
          <button>Completed</button>
        </div>
        <button className="filter-button" onClick={() => notify('Filters are ready for your next hunt')}>
          Filter jobs <Compass size={15} />
        </button>
      </div>

      <div className="bounty-layout">
        <div className="bounty-list">
          {bounties.map((bounty) => (
            <article className="bounty-card" key={bounty.title}>
              <div className={`bounty-emblem ${bounty.tone}`}>
                <span>{bounty.icon}</span><small>{bounty.tag}</small>
              </div>
              <div className="bounty-details">
                <div className="bounty-meta">
                  <span>{bounty.posted}</span>
                  <time><Clock size={12} /> {bounty.time}</time>
                </div>
                <h2>{bounty.title}</h2>
                <p>Team up with fellow frontier folks to complete this mission and claim your share of the valley.</p>
                <div className="bounty-progress">
                  <span><i style={{ width: bounty.progress.includes('%') ? bounty.progress : '70%' }} /></span>
                  <b>{bounty.progress}</b>
                </div>
              </div>
              <div className="bounty-reward">
                <small>REWARD</small>
                <strong><Coins size={17} /> {bounty.reward}</strong>
                <span><Gem size={13} /> {bounty.bonus}</span>
                <button onClick={() => notify(`${bounty.title} added to your trail`)}>
                  Accept bounty <ArrowRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="board-side">
          <div className="side-title">
            <span><Trophy size={16} /> Leaderboard</span>
            <span className="live-pill">LIVE</span>
          </div>
          <div className="leader"><b>01</b><span className="leader-avatar">JR</span><div><strong>Jesse R.</strong><small>Dust collector</small></div><em>8,240</em></div>
          <div className="leader"><b>02</b><span className="leader-avatar green">MK</span><div><strong>Mika K.</strong><small>Trail blazer</small></div><em>7,910</em></div>
          <div className="leader"><b>03</b><span className="leader-avatar purple">BB</span><div><strong>Bandit Buddy</strong><small>You</small></div><em>6,840</em></div>
          <div className="board-tip">
            <Sparkles size={17} />
            <strong>Tip from the campfire</strong>
            <p>Complete bounties together to unlock bonus multipliers for the whole crew.</p>
          </div>
        </aside>
      </div>
    </section>
  )
}
