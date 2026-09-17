'use client'

import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Backpack,
  Bell,
  BookOpen,
  Coins,
  Clock,
  Compass,
  Send,
  Gem,
  Gift,
  Hammer,
  House,
  Map,
  Menu,
  MessageCircle,
  Mountain,
  Milestone,
  Play,
  Shield,
  Sparkles,
  Star,
  Sun,
  Target,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react'

const navItems = [
  { label: 'My Ranch', icon: House },
  { label: 'Bounty Board', icon: Target },
  { label: 'Outpost', icon: Compass },
  { label: 'Community', icon: Users },
  { label: 'White paper', icon: BookOpen },
  { label: 'Roadmap', icon: Milestone },
  { label: 'Token sale', icon: Coins },
]

const crops = [
  { type: 'corn', label: 'Sunset corn', rarity: 'Common', color: 'gold' },
  { type: 'crystal', label: 'Moon crystal', rarity: 'Rare', color: 'violet' },
  { type: 'flower', label: 'Dust bloom', rarity: 'Epic', color: 'coral' },
]

const bounties = [
  { title: 'The Great Sunflower Heist', tag: 'Harvest', reward: '420', bonus: '1 Rare Gem', progress: '7 / 10', tone: 'orange', icon: '✦', time: '2h 14m left', posted: 'Daily bounty' },
  { title: 'Wanted: Dust Devil', tag: 'Expedition', reward: '800', bonus: 'Bandit Badge', progress: '2 / 5', tone: 'purple', icon: '◆', time: '18h left', posted: 'Community quest' },
  { title: 'Build the Watchtower', tag: 'Crafting', reward: '1,250', bonus: 'Plot Blueprint', progress: '40%', tone: 'green', icon: '⌂', time: '2d 6h left', posted: 'Frontier project' },
  { title: 'Trade Route Scout', tag: 'Social', reward: '260', bonus: '75 Dust coins', progress: '1 / 3', tone: 'gold', icon: '↗', time: '5h 40m left', posted: 'Weekly challenge' },
]

function BountyBoard({ onNotify }: { onNotify: (message: string) => void }) {
  return (
    <section className="bounty-page">
      <div className="bounty-heading">
        <div><span className="eyebrow"><span className="eyebrow-dot" /> BOUNTY BOARD · DUSTBOWL COUNTY</span><h1>Good deeds.<br /><span>Great rewards.</span></h1><p>Pick a job, rally your buddies, and earn assets that stay yours. Every bounty pushes the frontier forward.</p></div>
        <div className="board-poster"><span>WANTED</span><strong>BRAVE<br />RANCHERS</strong><small>REWARDS ARE ON-CHAIN</small><i>✦</i></div>
      </div>
      <div className="bounty-toolbar"><div className="bounty-tabs"><button className="selected">All bounties <b>12</b></button><button>Mine <b>3</b></button><button>Completed</button></div><button className="filter-button" onClick={() => onNotify('Filters are ready for your next hunt')}>Filter jobs <Compass size={15} /></button></div>
      <div className="bounty-layout"><div className="bounty-list">{bounties.map((bounty) => <article className="bounty-card" key={bounty.title}><div className={`bounty-emblem ${bounty.tone}`}><span>{bounty.icon}</span><small>{bounty.tag}</small></div><div className="bounty-details"><div className="bounty-meta"><span>{bounty.posted}</span><time><Clock size={12} /> {bounty.time}</time></div><h2>{bounty.title}</h2><p>Team up with fellow frontier folks to complete this mission and claim your share of the valley.</p><div className="bounty-progress"><span><i style={{ width: bounty.progress.includes('%') ? bounty.progress : '70%' }} /></span><b>{bounty.progress}</b></div></div><div className="bounty-reward"><small>REWARD</small><strong><Coins size={17} /> {bounty.reward}</strong><span><Gem size={13} /> {bounty.bonus}</span><button onClick={() => onNotify(`${bounty.title} added to your trail`)}>Accept bounty <ArrowRight size={14} /></button></div></article>)}</div><aside className="board-side"><div className="side-title"><span><Trophy size={16} /> Leaderboard</span><span className="live-pill">LIVE</span></div><div className="leader"><b>01</b><span className="leader-avatar">JR</span><div><strong>Jesse R.</strong><small>Dust collector</small></div><em>8,240</em></div><div className="leader"><b>02</b><span className="leader-avatar green">MK</span><div><strong>Mika K.</strong><small>Trail blazer</small></div><em>7,910</em></div><div className="leader"><b>03</b><span className="leader-avatar purple">BB</span><div><strong>Bandit Buddy</strong><small>You</small></div><em>6,840</em></div><div className="board-tip"><Sparkles size={17} /><strong>Tip from the campfire</strong><p>Complete bounties together to unlock bonus multipliers for the whole crew.</p></div></aside></div>
    </section>
  )
}

function Outpost({ onNotify }: { onNotify: (message: string) => void }) {
  const stalls = [
    { name: 'Dust & Daisies', type: 'Market stall', value: '12.4K', icon: Coins, tone: 'orange' },
    { name: 'Moonrise Exchange', type: 'Trading post', value: '8.7K', icon: Gem, tone: 'purple' },
    { name: 'The Stable', type: 'Buddy services', value: '4.2K', icon: House, tone: 'green' },
  ]
  return <section className="outpost-page"><div className="outpost-hero"><div><span className="eyebrow"><span className="eyebrow-dot" /> OUTPOST · DUSTBOWL COUNTY</span><h1>Trade smart.<br /><span>Ride farther.</span></h1><p>The Outpost is where the frontier changes hands. Swap resources, discover rare buddies, and make your next move count.</p><button className="primary-button" onClick={() => onNotify('Market refreshed with the latest listings')}><Compass size={16} /> Explore market <ArrowRight size={16} /></button></div><div className="outpost-map"><div className="map-sun" /><div className="map-hill hill-a" /><div className="map-hill hill-b" /><div className="outpost-tower"><div /><span>OUTPOST</span></div><div className="trade-route" /><span className="map-pin pin-a"><Coins size={14} /></span><span className="map-pin pin-b"><Gem size={14} /></span></div></div><div className="market-head"><div><span className="section-kicker">The frontier exchange</span><h2>Open for business</h2></div><button className="filter-button" onClick={() => onNotify('Showing all market categories')}>All categories <ArrowRight size={14} /></button></div><div className="stall-grid">{stalls.map(({name,type,value,icon:Icon,tone}) => <article className="stall-card" key={name}><div className={`stall-art ${tone}`}><Icon size={30} /><span>OPEN</span></div><div className="stall-copy"><small>{type}</small><h3>{name}</h3><p>Fresh listings from trusted ranchers.</p><div><strong>{value}</strong><span> volume today</span></div></div><button className="round-arrow" onClick={() => onNotify(`${name} opened`)} aria-label={`Open ${name}`}><ArrowRight size={16} /></button></article>)}</div><div className="outpost-banner"><Sparkles size={18} /><div><strong>Every trade helps build the valley</strong><p>A small fee from every exchange goes back into community bounties and new frontier regions.</p></div><span>2.5% community share</span></div></section>
}

function Community({ onNotify }: { onNotify: (message: string) => void }) {
  const [activeTab, setActiveTab] = useState('Latest')
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [posts, setPosts] = useState([{id:1,initials:'JR', name:'Jesse R.', time:'12m ago', text:'Finally unlocked the Moon crystal plot. The glow at sunset is unreal.', replies:['That glow is incredible!'], tips:12, tone:'', category:'Latest'},{id:2,initials:'MK', name:'Mika K.', time:'38m ago', text:'Anyone up for the Watchtower bounty? Need two more ranchers.', replies:[], tips:8, tone:'green', category:'Following'},{id:3,initials:'BB', name:'Bandit Buddy', time:'1h ago', text:'New trail discovered beyond Dustbowl County. Bring your best buddy.', replies:['Meet you at the north gate.'], tips:24, tone:'purple', category:'Announcements'}])
  const [tipped, setTipped] = useState<number[]>([])
  const [replyId, setReplyId] = useState<number | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const visiblePosts = activeTab === 'Latest' ? posts : posts.filter(post => post.category === activeTab)
  const publish = () => { const text = draft.trim(); if (!text) return onNotify('Write something before posting'); setPosts([{id:Date.now(),initials:'BB',name:'Bandit Buddy',time:'just now',text,replies:[],tips:0,tone:'purple',category:'Latest'},...posts]); setDraft(''); setComposerOpen(false); onNotify('Your story is now around the campfire') }
  const share = async (post: typeof posts[number]) => { try { await navigator.clipboard?.writeText(post.text); onNotify('Post link copied to clipboard') } catch { onNotify('Share link ready') } }
  return <section className="community-page"><div className="community-heading"><div><span className="eyebrow"><span className="eyebrow-dot" /> COMMUNITY · THE CAMPFIRE</span><h1>Pull up a chair.<br /><span>Tell your story.</span></h1><p>The campfire is where ranchers swap tips, find a crew, and celebrate the little wins that make the frontier feel alive.</p></div><div className="campfire-card"><div className="fire">✦</div><strong>4,200+</strong><span>ranchers around<br />the campfire</span></div></div><div className="community-layout"><main className="feed"><div className="feed-tabs">{['Latest','Following','Announcements'].map(tab => <button key={tab} className={activeTab === tab ? 'selected' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}<button className="new-post" onClick={() => setComposerOpen(true)}>+ New post</button></div>{visiblePosts.length ? visiblePosts.map(post => <article className="post-card" key={post.id}><span className={`post-avatar ${post.tone}`}>{post.initials}</span><div className="post-body"><div className="post-meta"><strong>{post.name}</strong><span>· {post.time}</span></div><p>{post.text}</p><div className="post-actions"><button className={tipped.includes(post.id) ? 'action-active' : ''} onClick={() => { if (!tipped.includes(post.id)) { setTipped([...tipped,post.id]); setPosts(posts.map(item => item.id === post.id ? {...item,tips:item.tips+1} : item)); onNotify('You tipped this rancher') } }}><span>♡</span> Tip {post.tips}</button><button onClick={() => setReplyId(replyId === post.id ? null : post.id)}><MessageCircle size={14} /> {post.replies.length} replies</button><button onClick={() => share(post)}>Share</button></div>{replyId === post.id && <div className="reply-panel">{post.replies.map((reply,index) => <p key={index}><strong>BB</strong>{reply}</p>)}<div className="reply-input"><input value={replyDraft} onChange={event => setReplyDraft(event.target.value)} placeholder="Reply to this rancher..." onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) { const text=replyDraft.trim(); if(text){setPosts(posts.map(item=>item.id===post.id?{...item,replies:[...item.replies,text]}:item));setReplyDraft('');onNotify('Reply posted')} } }} /><button onClick={() => { const text=replyDraft.trim(); if(text){setPosts(posts.map(item=>item.id===post.id?{...item,replies:[...item.replies,text]}:item));setReplyDraft('');onNotify('Reply posted')} }}>Post</button></div></div>}</div></article>) : <div className="empty-feed">No posts in this trail yet.</div>}{composerOpen && <div className="composer"><div className="composer-head"><strong>New campfire post</strong><button onClick={() => setComposerOpen(false)} aria-label="Close composer">×</button></div><textarea autoFocus value={draft} onChange={event => setDraft(event.target.value)} placeholder="What is happening on your ranch?" maxLength={280} /><div><small>{draft.length}/280</small><button className="primary-button" onClick={publish}>Publish post <ArrowRight size={14} /></button></div></div>}</main><aside className="community-sidebar"><div className="side-title"><span><Users size={16} /> Active around here</span><span className="live-pill">LIVE</span></div><div className="active-ranchers"><span>JR</span><span>MK</span><span>AL</span><span>+18</span></div><p className="side-note">Ranchers are online across 6 regions right now.</p><div className="campfire-tip"><Target size={16} /><strong>Find your crew</strong><p>Join a group bounty and earn a 1.2x reward multiplier together.</p><button onClick={() => onNotify('Crew finder opened')}>Browse crews <ArrowRight size={14} /></button></div></aside></div></section>
}

function PlayScreen({ onNotify }: { onNotify: (message: string) => void }) {
  const [selectedTool, setSelectedTool] = useState('Harvest')
  const tools = ['Harvest', 'Water', 'Craft']
  return <section className="game-screen"><div className="game-topline"><div><span className="eyebrow"><span className="eyebrow-dot" /> LIVE GAME · DUSTBOWL COUNTY</span><h1>Your ranch.<br /><span>Your rules.</span></h1><p>Welcome back, Bandit Buddy. The valley is yours to shape.</p></div><div className="game-day"><Sun size={18} /><span>Day 42</span><small>Golden hour</small></div></div><div className="game-layout"><div className="game-board"><div className="board-sky"><span className="board-sun" /><span className="board-mountain one" /><span className="board-mountain two" /></div><div className="board-land"><div className="board-house"><i /><b /></div><div className="board-barn"><i /></div><div className="board-fence" /><div className="board-plots"><span /><span /><span /><span /><span /><span /></div><div className="board-buddy">◆<small>YOU</small></div><div className="board-dog" /><div className="board-sign">BANDIT<br />VALLEY</div></div><div className="game-toolbar">{tools.map(tool => <button key={tool} className={selectedTool === tool ? 'tool-selected' : ''} onClick={() => { setSelectedTool(tool); onNotify(`${tool} tool equipped`) }}><span>{tool === 'Harvest' ? '✦' : tool === 'Water' ? '◌' : '⌂'}</span>{tool}</button>)}</div></div><aside className="game-sidebar"><div className="game-card"><div className="side-title"><span><Target size={16} /> Today&apos;s trail</span><span className="live-pill">3 ACTIVE</span></div><div className="mission"><span className="mission-icon orange"><Coins size={15} /></span><div><strong>Harvest sunflowers</strong><small>7 / 10 harvested</small><span className="mini-progress"><i /></span></div><b>+420</b></div><div className="mission"><span className="mission-icon purple"><Shield size={15} /></span><div><strong>Defend the homestead</strong><small>Streak: 4 days</small><span className="mini-progress purple"><i /></span></div><b>+320</b></div><button className="game-action" onClick={() => onNotify('Quest journal opened')}>Open quest journal <ArrowRight size={14} /></button></div><div className="game-card resources"><div className="side-title"><span><Backpack size={16} /> Satchel</span><span>6 / 12</span></div><div className="resource-row"><span>Dust coins</span><strong><Coins size={14} /> 18,420</strong></div><div className="resource-row"><span>Rare gems</span><strong className="purple-text"><Gem size={14} /> 246</strong></div><div className="resource-row"><span>Energy</span><strong className="green-text">⚡ 78 / 100</strong></div></div><button className="leave-game" onClick={() => onNotify('Ranch progress saved on-chain')}>Save & leave ranch <Shield size={14} /></button></aside></div></section>
}

function CollectionScreen({ onNotify }: { onNotify: (message: string) => void }) {
  const items = [{name:'Moon crystal',rarity:'Rare',color:'violet',type:'crystal',id:'#0246'},{name:'Sunset corn',rarity:'Common',color:'gold',type:'corn',id:'#0108'},{name:'Dust bloom',rarity:'Epic',color:'coral',type:'flower',id:'#0032'},{name:'Lucky clover',rarity:'Uncommon',color:'green',type:'clover',id:'#0177'},{name:'Golden carrot',rarity:'Legendary',color:'gold',type:'carrot',id:'#0009'},{name:'Night cactus',rarity:'Rare',color:'violet',type:'cactus',id:'#0281'}]
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState(items[0])
  const filters = ['All','Common','Uncommon','Rare','Epic','Legendary']
  const shown = filter === 'All' ? items : items.filter(item => item.rarity === filter)
  return <section className="collection-screen"><div className="collection-top"><div><span className="eyebrow"><span className="eyebrow-dot" /> COLLECTION · ON-CHAIN ASSETS</span><h1>Small things.<br /><span>Big stories.</span></h1><p>Every seed, buddy, and treasure you collect is yours to keep. Browse the pieces that make your frontier unique.</p></div><div className="collection-count"><strong>24</strong><span>assets owned</span><small>+3 this season</small></div></div><div className="collection-layout"><div><div className="collection-filter">{filters.map(item => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="asset-grid">{shown.map(item => <button key={item.id} className={`asset-card ${selected.id === item.id ? 'asset-selected' : ''}`} onClick={() => setSelected(item)}><div className={`asset-art ${item.color} ${item.type}`}><span /><span /><span /></div><div><strong>{item.name}</strong><small>{item.rarity} · {item.id}</small></div><ArrowRight size={14} /></button>)}</div></div><aside className="asset-detail"><span className="detail-label">SELECTED ASSET</span><div className={`detail-art ${selected.color} ${selected.type}`}><span /><span /><span /></div><span className="rarity-badge">{selected.rarity}</span><h2>{selected.name}</h2><p>A frontier collectible with a story only you can tell. This asset lives in your wallet and grows with your ranch.</p><div className="detail-stats"><span><small>Token ID</small><strong>{selected.id}</strong></span><span><small>Collection</small><strong>Bandit Seeds</strong></span></div><button className="primary-button" onClick={() => onNotify(`${selected.name} details copied`)}>View on explorer <ArrowRight size={15} /></button></aside></div></section>
}

function SaleCountdown({ start, end }: { start: string; end: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const startMs = new Date(start).getTime(); const endMs = new Date(end).getTime(); const active = now >= startMs && now < endMs; const target = now < startMs ? startMs : endMs; const remaining = Math.max(0, target - now); const days = Math.floor(remaining / 86400000); const hours = Math.floor(remaining / 3600000) % 24; const minutes = Math.floor(remaining / 60000) % 60; const seconds = Math.floor(remaining / 1000) % 60
  const pad = (value: number) => value.toString().padStart(2, '0')
  return <div className="countdown"><span className={active ? 'countdown-status live' : 'countdown-status'}>{now < startMs ? 'STARTS IN' : active ? 'ENDS IN' : 'ROUND ENDED'}</span>{now <= endMs && <strong>{days}d <b>{pad(hours)}:{pad(minutes)}:{pad(seconds)}</b></strong>}<small>{new Date(startMs).toLocaleDateString('en-GB')} — {new Date(endMs).toLocaleDateString('en-GB')}</small></div>
}

const saleRounds = [{ id: 'angel', name: 'Angel round', supply: '5% supply', price: 0.001, start: '01 Oct 2026', end: '30 Oct 2026', unlock: '0% TGE', vesting: '18 months', cliff: '3 months', copy: 'The earliest supporters fund the game foundation, from UI/UX and backend build to the first playable frontier.' }, { id: 'private', name: 'Private sale', supply: '7% supply', price: 0.0025, start: '01 Nov 2026', end: '30 Nov 2026', unlock: '5% TGE', vesting: '18 months', cliff: '0 months', copy: 'Strategic VCs and Web3 guilds help turn early traction into a growing partner network and a stronger player economy.' }, { id: 'public', name: 'Public sale / IDO', supply: '5% supply', price: 0.005, start: '01 Dec 2026', end: '30 Dec 2026', unlock: '25% TGE', vesting: '12 months', cliff: '0 months', copy: 'The community round opens the frontier wider, with a clear 5x valuation step-up from the earliest planned entry.' }]

function TokenPurchasePanel({ onNotify }: { onNotify: (message: string) => void }) {
  const [roundId, setRoundId] = useState('public'); const [payCurrency, setPayCurrency] = useState<'FARM' | 'USDT'>('USDT'); const [amount, setAmount] = useState('1000'); const [connected, setConnected] = useState(false); const [reviewing, setReviewing] = useState(false); const [complete, setComplete] = useState(false); const [claimed, setClaimed] = useState(false); const [purchasedAt] = useState(() => new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))
  const round = saleRounds.find(item => item.id === roundId) ?? saleRounds[2]; const numericAmount = Math.max(0, Number(amount) || 0); const tokens = payCurrency === 'USDT' ? numericAmount / round.price : numericAmount; const total = payCurrency === 'USDT' ? numericAmount : numericAmount * round.price
  const connect = () => { setConnected(true); onNotify('Wallet connected in preview') }
  if (complete) return <div className="purchase-panel claim-panel"><div className="success-hero"><div className="success-check">✓</div><span className="section-kicker">PURCHASE COMPLETE · PREVIEW RECEIPT</span><h2>Your $FARM is<br /><em>on the trail.</em></h2><p>Purchase recorded successfully. Your tokens are now tracked in the vesting vault and can be claimed as they unlock.</p><span className="receipt-id">Receipt BB-{round.id.toUpperCase()}-{purchasedAt.replace(/\\D/g, '').slice(-6)}</span></div><div className="claim-summary"><div className="claim-stat"><small>Purchased</small><strong>{purchasedAt}</strong></div><div className="claim-stat"><small>Rate</small><strong>${round.price} / FARM</strong></div><div className="claim-stat"><small>Allocation</small><strong>{tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} FARM</strong></div><div className="vesting-timeline"><div className="vesting-title"><span>Vesting schedule</span><b>{claimed ? 'Claimed' : round.unlock + ' unlocked at TGE'}</b></div><div className="vesting-bar"><i style={{ width: claimed ? '25%' : round.id === 'angel' ? '0%' : round.id === 'private' ? '5%' : '25%' }} /></div><div className="vesting-points"><span><b>{round.unlock}</b><small>TGE unlock</small></span><span><b>{round.cliff === '0 months' ? 'Starts TGE' : round.cliff}</b><small>{round.cliff === '0 months' ? 'Linear vesting' : 'Cliff period'}</small></span><span><b>{round.vesting}</b><small>Fully vested</small></span></div></div><div className="claim-actions"><button className="primary-button" disabled={claimed} onClick={() => { setClaimed(true); onNotify('Claim request submitted in preview') }}>{claimed ? 'Claim submitted' : `Claim ${round.unlock === '0% TGE' ? 'unlocked' : 'available'} $FARM`} <ArrowRight size={15} /></button><button className="text-button" onClick={() => setComplete(false)}>Buy more $FARM</button></div><small className="claim-note">Claiming will require a wallet signature. No funds move in this preview.</small></div></div>
  return <div className="purchase-panel"><div className="purchase-stepper"><span className="active">01 Choose round</span><span>02 Connect wallet</span><span>03 Review & buy</span></div><div className="purchase-grid"><div className="purchase-main"><span className="section-kicker">Buy $FARM token</span><h2>Choose your entry<br /><em>into the frontier.</em></h2><p className="purchase-intro">Select a sale round, enter your amount, and review your allocation before signing. You stay in control at every step.</p><div className="round-select-grid">{saleRounds.map(item => <button key={item.id} className={round.id === item.id ? 'round-select active' : 'round-select'} onClick={() => setRoundId(item.id)}><span>{item.name}</span><strong>${item.price} <small>/ FARM</small></strong><small>{item.supply} · {item.start}</small></button>)}</div><div className="purchase-form"><div className="form-heading"><span>Amount</span><span>1 FARM = ${round.price} USDT</span></div><div className="amount-box"><input aria-label="Amount to purchase" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /><select aria-label="Payment currency" value={payCurrency} onChange={event => setPayCurrency(event.target.value as 'FARM' | 'USDT')}><option value="USDT">USDT</option><option value="FARM">FARM</option></select></div><div className="conversion"><span>You receive</span><strong>{tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} $FARM</strong></div><button className="primary-button purchase-cta" onClick={() => { if (!connected) connect(); else setReviewing(true) }}>{connected ? 'Review purchase' : 'Connect wallet to continue'} <Wallet size={15} /></button><small className="purchase-note">MetaMask / Trust Wallet · Network and gas details appear before signing</small></div></div><aside className="purchase-summary"><div className="summary-mascot"><img src="/bandit-buddy-mascot.png" alt="Bandit Buddy mascot" /></div><span className="live-round-label">{round.name.toUpperCase()}</span><h3>Allocation summary</h3><div className="summary-line"><span>Pay with</span><strong>{total.toLocaleString(undefined, { maximumFractionDigits: 4 })} {payCurrency}</strong></div><div className="summary-line"><span>Receive</span><strong>{tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} FARM</strong></div><div className="vesting-box"><Shield size={15} /><div><strong>Vesting locked</strong><p>{round.unlock} at TGE · then {round.vesting} linear vesting{round.cliff !== '0 months' ? ` · ${round.cliff} cliff` : ''}</p></div></div><div className="trust-list"><span><Shield size={13} /> Terms shown before signature</span><span><BookOpen size={13} /> Public sale brief available</span><span><Users size={13} /> Community allocation</span></div>{reviewing && <div className="review-box"><strong>Ready to review</strong><p>Wallet signature is simulated in this preview. No funds will move.</p><button onClick={() => { setReviewing(false); setComplete(true); onNotify('Purchase completed in preview') }}>Confirm preview</button></div>}</aside></div></div>
}

function Web3Docs({ section, onNotify }: { section: string; onNotify: (message: string) => void }) {
  const isWhite = section === 'White paper'
  const isRoadmap = section === 'Roadmap'
  const isSale = section === 'Token sale'
  return <section className="docs-page"><div className="docs-hero"><div><span className="eyebrow"><span className="eyebrow-dot" /> BANDIT BUDDY · WEB3 BRIEF</span><h1>{isWhite ? <>The frontier,<br /><span>by design.</span></> : isRoadmap ? <>A trail worth<br /><span>following.</span></> : <>Own your<br /><span>piece of play.</span></>}</h1><p>{isWhite ? 'A plain-language overview of the game economy, ownership model, and systems that make Bandit Buddy a player-shaped frontier.' : isRoadmap ? 'From the first campfire to a living on-chain world. Here is where we are headed, and what we are building next.' : 'A transparent look at the $FARM ecosystem, community allocation, and the path to a healthier player-owned economy.'}</p></div><div className="docs-stamp"><img src="/bandit-buddy-mascot.png" alt="Bandit Buddy raccoon mascot" /><strong>{isSale ? '$FARM' : isRoadmap ? 'SEASON 01' : 'v0.1'}</strong><small>{isSale ? 'COMMUNITY SALE' : isRoadmap ? 'THE DUSTY TRAIL' : 'OPEN BRIEFING'}</small></div></div>{isRoadmap && <div className="roadmap-list"><div className="roadmap-row"><span className="roadmap-status active">NOW</span><div><strong>Phase 1 · Genesis Gacha</strong><p>Launch the simple ERC-1155 Gacha loop and establish Genesis Dogs.</p></div><b>01</b></div><div className="roadmap-row featured"><span className="roadmap-status next">NEXT</span><div><strong>Phase 2 · Breeding evolution</strong><p>Bridge Genesis Dogs into ERC-721 Genetic NFTs through the Evolution Portal.</p></div><b>02</b></div><div className="roadmap-row"><span className="roadmap-status later">LATER</span><div><strong>Phase 3 · Genetic marketplace</strong><p>Trade rare bloodlines, Excellent options, and player-built dog strategies.</p></div><b>03</b></div></div>}{isRoadmap && <><div className="roadmap-callout breeding-feature"><div className="breeding-icon"><Sparkles size={25} /></div><div><span className="section-kicker">PHASE 2 EXPANSION · BANDIT DOG GENETICS</span><h2>Breed the rarest<br /><em>frontier bloodlines.</em></h2><p>After the Genesis Gacha phase, Bandit Buddy evolves into a player-owned genetics economy. Breed ERC-721 Genetic dogs, discover Excellent traits, and build the perfect protector for your farm.</p><div className="breeding-signals"><span><Shield size={14} /> Excellent traits</span><span><Clock size={14} /> Cooldown protected</span><span><Coins size={14} /> $FARM sink</span></div></div><div className="breeding-badge"><strong>PHASE 2</strong><small>IN THE TRAIL MAP</small></div></div><div className="breeding-grid"><article><span className="doc-number">01</span><h3>Genetic DNA</h3><p>Each dog carries a unique 256-bit DNA profile with dominant and recessive genes that shape rarity, appearance, and abilities.</p></article><article><span className="doc-number">02</span><h3>Excellent options</h3><p>Hunt for Ferocity, Agility, Perception, Luck, and Aura traits. One line is Rare; three lines become Legendary; four to five can become Divine.</p></article><article><span className="doc-number">03</span><h3>Breed with purpose</h3><p>Generation-based cooldowns and a $FARM breeding fee control supply while fusion burning keeps weak offspring out of the economy.</p></article></div></>}{isSale && <TokenPurchasePanel onNotify={onNotify} />}{isWhite && <><div className="docs-callout"><BookOpen size={18} /><div><strong>What matters most</strong><p>Guilds create a free path into the game; premium staking adds optional rewards. Fusion uses three Guard Dog NFTs plus a fee and burns the inputs, while commit–reveal and oracle checks make random outcomes auditable.</p></div><span>Based on<br />the brief</span></div><div className="docs-grid"><article><span className="doc-number">01</span><h2>Play loop</h2><p>Grow land, complete bounties, collect buddies, and reinvest resources into a ranch that becomes more capable over time.</p></article><article><span className="doc-number">02</span><h2>Guild access</h2><p>Free guild slots lower the barrier to entry. Premium guilds can stake $FARM for enhanced benefits without making ownership mandatory.</p></article><article><span className="doc-number">03</span><h2>Fusion economy</h2><p>Combine three Guard Dog NFTs and a fee to mint an upgraded dog. The three source NFTs are burned, creating a clear supply sink.</p></article><article><span className="doc-number">04</span><h2>Fair randomness</h2><p>Commit–reveal flow and an oracle-backed randomness source help players verify that rare drops and upgrades were not manipulated.</p></article></div></>}{isRoadmap && <div className="roadmap-list">{[['NOW','Foundation','Ranch core, wallet-ready collectibles, first bounties','live'],['NEXT','Social-Fi guilds','Free and premium guilds, staking dashboard, crew rewards','next'],['THEN','Fusion economy','Guard Dog upgrades, burn mechanics, pity protection and crafting sinks','later'],['HORIZON','On-chain launch','Audited contracts, oracle randomness, marketplace and regional expansion','later']].map(([phase,title,copy,status]) => <article className="roadmap-row" key={phase}><span className={`roadmap-marker ${status}`}>{status === 'live' ? '✓' : '→'}</span><div><small>{phase}</small><h2>{title}</h2><p>{copy}</p></div><b>{status === 'live' ? 'SHIPPED' : status === 'next' ? 'IN BUILD' : 'PLANNED'}</b></article>)}</div>}{isSale && <><div className="trust-strip"><span><Shield size={15} /> Clear allocation</span><span><Clock size={15} /> 30-day windows</span><span><Wallet size={15} /> Wallet-ready</span><span><BookOpen size={15} /> Public brief</span></div><div className="sale-stats"><div><strong>1B</strong><span>total supply</span></div><div><strong>40%</strong><span>ecosystem & P2E</span></div><div><strong>$5M</strong><span>target Public FDV</span></div></div><div className="sale-live-hero"><div className="live-copy"><span className="live-kicker"><span /> NEXT SALE WINDOW</span><h2>The public round is your<br /><em>frontier moment.</em></h2><p>Join the community allocation at the clearest valuation step-up in the journey. Connect your wallet, confirm eligibility, and be ready before the window closes.</p><div className="live-proof"><span><Shield size={14} /> Transparent terms</span><span><Users size={14} /> Community-led</span><span><Sparkles size={14} /> 5x step-up</span></div></div><div className="live-action"><span className="live-round-label">PUBLIC SALE / IDO</span><strong>$0.005 <small>/ $FARM</small></strong><SaleCountdown start="2026-12-01T00:00:00+07:00" end="2026-12-30T23:59:59+07:00" /><button className="primary-button" onClick={() => onNotify('Connect wallet to join the public sale waitlist')}>Join the waitlist <ArrowRight size={15} /></button><small className="cta-note">No transaction is executed in this preview.</small></div></div><div className="sale-rounds"><article className="sale-card sale-round angel"><div className="round-head"><span className="round-badge">01</span><div><span className="section-kicker">Angel round · 5% supply</span><h2>$0.001 <small>/ $FARM</small></h2></div><strong>$50K</strong></div><p>Early access for core partners and strategic backers to fund the kick-off, UI/UX, and backend build. The earliest entry supports the product foundation at the lowest planned valuation.</p><SaleCountdown start="2026-10-01T00:00:00+07:00" end="2026-10-30T23:59:59+07:00" /><div className="round-meta"><span>FDV <b>$1M</b></span><span>Cliff <b>3 months</b></span><span>Vesting <b>18 months</b></span></div></article><article className="sale-card sale-round private"><div className="round-head"><span className="round-badge">02</span><div><span className="section-kicker">Private sale · 7% supply</span><h2>$0.0025 <small>/ $FARM</small></h2></div><strong>$175K</strong></div><p>For external VCs and Web3 guilds after the Telegram demo proves product traction and lowers execution risk. This round gives strategic operators room to help grow the guild and partner network.</p><SaleCountdown start="2026-11-01T00:00:00+07:00" end="2026-11-30T23:59:59+07:00" /><div className="round-meta"><span>FDV <b>$2.5M</b></span><span>Unlock <b>5% TGE</b></span><span>Vesting <b>18 months</b></span></div></article><article className="sale-card sale-round public"><div className="round-head"><span className="round-badge">03</span><div><span className="section-kicker">Public sale / IDO · 5% supply</span><h2>$0.005 <small>/ $FARM</small></h2></div><strong>$250K</strong></div><p>Community allocation at a 5x step-up from Seed, creating a clear valuation story for early supporters. The public round opens the wider frontier to eligible community participants.</p><SaleCountdown start="2026-12-01T00:00:00+07:00" end="2026-12-30T23:59:59+07:00" /><div className="round-meta"><span>FDV <b>$5M</b></span><span>Target <b>50M tokens</b></span><span>Retail <b>Community</b></span></div></article></div><div className="sale-grid"><article className="sale-card"><span className="section-kicker">Allocation</span><h2>Built for the frontier</h2>{[['Ecosystem & P2E','40%'],['Treasury & marketing','18%'],['Team & advisors','15%'],['Seed sale','12%'],['Liquidity & MM','10%'],['Public sale / IDO','5%']].map(([name,value]) => <div className="allocation" key={name}><span>{name}</span><strong>{value}</strong><i style={{width:value}} /></div>)}</article><article className="sale-card sale-highlight"><span className="section-kicker">Community sale</span><h2>Join the first crew</h2><p>Seed buyers enter at $0.001 and see a 5x target step-up at the $0.005 Public Sale valuation. Final terms remain subject to eligibility, audits, vesting, and local law.</p><div className="sale-price"><strong>1 $FARM</strong><span>= $0.005 IDO target</span></div><button className="primary-button" onClick={() => onNotify('Connect wallet to view sale eligibility')}>Connect wallet <Wallet size={15} /></button><small>No transaction is executed in this preview.</small></article></div></>}{(isWhite || isSale) && <div className="docs-disclaimer"><Shield size={15} /><span>This is an illustrative product brief, not financial advice. Token mechanics, eligibility, audits, vesting, and regulatory treatment must be confirmed before launch.</span></div>}</section>
}

function RanchScene() {
  return (
    <div className="ranch-scene" aria-label="Bandit Buddy ranch illustration">
      <div className="scene-sky">
        <div className="sun" />
        <span className="cloud cloud-one" />
        <span className="cloud cloud-two" />
        <span className="mountain mountain-back" />
        <span className="mountain mountain-front" />
      </div>
      <div className="scene-ground">
        <div className="path path-main" />
        <div className="path path-side" />
        <div className="ranch-house">
          <div className="house-roof" />
          <div className="house-body"><span className="window" /><span className="door" /></div>
          <div className="chimney" />
        </div>
        <div className="barn"><div className="barn-roof" /><div className="barn-door" /></div>
        <div className="cactus cactus-left"><i /><i /></div>
        <div className="cactus cactus-right"><i /><i /></div>
        <div className="fence fence-left" /><div className="fence fence-right" />
        <div className="field field-one"><span /><span /><span /><span /><span /><span /></div>
        <div className="field field-two"><span /><span /><span /><span /><span /><span /></div>
        <div className="buddy">
          <div className="buddy-hat" /><div className="buddy-head"><span className="eye eye-left" /><span className="eye eye-right" /><span className="bandana" /></div>
          <div className="buddy-body" /><div className="buddy-leg leg-left" /><div className="buddy-leg leg-right" /><div className="buddy-arm" />
        </div>
        <div className="dog"><span className="dog-ear" /><span className="dog-tail" /></div>
        <div className="signpost"><span>BANDIT<br />VALLEY</span></div>
        <div className="coin coin-one"><Coins size={12} /></div><div className="coin coin-two"><Coins size={12} /></div>
      </div>
      <div className="scene-label"><Sparkles size={14} /> Your frontier awaits</div>
    </div>
  )
}

export default function Page() {
  const [activeNav, setActiveNav] = useState('My Ranch')
  const [walletConnected, setWalletConnected] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [activeScreen, setActiveScreen] = useState<'home' | 'play' | 'collection'>('home')

  const notify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2800)
  }

  return (
    <main className="bandit-app">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Bandit Buddy home">
          <span className="brand-mascot"><img src="/bandit-buddy-mascot.png" alt="Bandit Buddy mascot" /></span>
          <span className="brand-name"><strong>Bandi</strong><em>Buddy</em><small>ON-CHAIN FRONTIER</small></span>
        </a>
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button>
        <nav className={menuOpen ? 'main-nav open' : 'main-nav'} aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={activeNav === label ? 'nav-link active' : 'nav-link'} onClick={() => { setActiveNav(label); setMenuOpen(false); notify(`${label} selected`) }}>
              <Icon size={17} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notifications" onClick={() => notify('No new bounty alerts')}><Bell size={18} /><span className="notification-dot" /></button>
          <button className={walletConnected ? 'wallet-button connected' : 'wallet-button'} onClick={() => { setWalletConnected(!walletConnected); notify(walletConnected ? 'Wallet disconnected' : 'Wallet connected') }}><Wallet size={16} />{walletConnected ? '0x7A...B42' : 'Connect wallet'}</button>
        </div>
      </header>
      {activeScreen === 'play' ? <PlayScreen onNotify={notify} /> : activeScreen === 'collection' ? <CollectionScreen onNotify={notify} /> : ['White paper','Roadmap','Token sale'].includes(activeNav) ? <Web3Docs section={activeNav} onNotify={notify} /> : activeNav === 'Bounty Board' ? <BountyBoard onNotify={notify} /> : activeNav === 'Outpost' ? <Outpost onNotify={notify} /> : activeNav === 'Community' ? <Community onNotify={notify} /> : <>
      <section className="hero-shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> SEASON 01 · THE DUSTY TRAIL</div>
          <h1>Build your <span>legend.</span><br />Own the frontier.</h1>
          <p>Bandit Buddy is a living, breathing ranch game on-chain. Grow your land, collect rare buddies, and ride into a world where every choice is yours to keep.</p>
          <div className="hero-buttons">
            <button className="primary-button" onClick={() => { window.open('https://dapp.banditbuddy.xyz','_blank'); notify('Your adventure is loading...') }}><Play size={17} fill="currentColor" /> Play now <ArrowRight size={17} /></button>
            <button className="secondary-button" onClick={() => { setActiveScreen('collection'); notify('Collection gallery opened') }}><Gem size={17} /> Explore collection</button><button className="sale-hero-link" onClick={() => { setActiveScreen('home'); setActiveNav('Token sale'); notify('Token sale opened') }}><Coins size={16} /> Join $FARM sale <ArrowRight size={14} /></button>
          </div>
          <div className="hero-trust"><div className="avatar-stack"><span>BB</span><span>JR</span><span>MK</span><span>+4k</span></div><span>4,200+ frontier folks already riding</span></div>
        </div>
        <div className="hero-art-wrap"><div className="hero-stamp"><Star size={13} fill="currentColor" /> PLAY · GROW · OWN</div><RanchScene /></div>
      </section>

      <section className="home-breeding-banner" aria-label="Breeding feature highlight"><div className="home-breeding-icon"><Sparkles size={21} /></div><div><span className="section-kicker">COMING IN PHASE 2 · BREEDING</span><h2>Find the dog with the <em>perfect bloodline.</em></h2><p>Genesis Dogs become the starting point for rare Excellent traits, cooldown strategy, and a new $FARM-powered economy.</p></div><button className="text-button" onClick={() => { setActiveNav('Roadmap'); notify('Breeding roadmap opened') }}>See the breeding roadmap <ArrowRight size={15} /></button></section>

      <section className="player-strip" aria-label="Player profile and quick stats">
        <div className="player-profile"><div className="profile-avatar">BB</div><div><span className="profile-kicker">Rancher profile</span><strong>Bandit Buddy <span className="verified">✓</span></strong><small>Level 09 · Dustbowl County</small></div></div>
        <div className="level-meter"><div className="meter-label"><span>Frontier XP</span><b>2,480 / 3,000</b></div><div className="meter-track"><i /></div></div>
        <div className="quick-stat"><Coins size={21} /><div><small>Dust coins</small><strong>18,420</strong></div></div>
        <div className="quick-stat"><Gem size={21} /><div><small>Rare gems</small><strong>246</strong></div></div>
        <button className="profile-more" aria-label="Open profile" onClick={() => notify('Profile panel coming soon')}><ArrowRight size={19} /></button>
      </section>

      <section className="content-grid">
        <div className="content-main">
          <div className="section-heading"><div><span className="section-kicker">A little help from your friends</span><h2>Today on the ranch</h2></div><button className="text-button" onClick={() => notify('All quests are up to date')}>View all quests <ArrowRight size={15} /></button></div>
          <div className="quest-grid">
            <article className="quest-card quest-featured"><div className="quest-icon orange"><Target size={21} /></div><div className="quest-info"><span className="quest-status">Daily bounty · 2h left</span><h3>Harvest the sunflowers</h3><p>Trade your harvest at the outpost before sunset.</p><div className="quest-progress"><span><i /></span><b>7 / 10</b></div></div><button className="round-arrow" onClick={() => notify('Quest opened')}><ArrowRight size={17} /></button></article>
            <article className="quest-card"><div className="quest-icon purple"><Shield size={21} /></div><div className="quest-info"><span className="quest-status">Weekly challenge</span><h3>Defend the homestead</h3><p>Keep your streak alive for bonus XP.</p><div className="quest-reward"><Trophy size={14} /> +320 XP <span>·</span> <Gem size={14} /> 12</div></div><button className="round-arrow" onClick={() => notify('Challenge accepted')}><ArrowRight size={17} /></button></article>
          </div>

          <div className="section-heading collection-heading" id="collection"><div><span className="section-kicker">Assets you can actually own</span><h2>Your collection</h2></div><button className="text-button" onClick={() => notify('Collection gallery opened')}>View collection <ArrowRight size={15} /></button></div>
          <div className="collection-grid">{crops.map((crop) => <button className={`collectible ${crop.color}`} key={crop.label} onClick={() => notify(`${crop.label} selected`)}><div className={`crop-art ${crop.type}`}><span /><span /><span /></div><div><strong>{crop.label}</strong><small><span className="rarity-dot" /> {crop.rarity}</small></div><ArrowRight size={15} /></button>)}</div>
        </div>
        <aside className="side-panel"><div className="panel-title"><span><Map size={16} /> Frontier map</span><button onClick={() => notify('Map expanded')}><ArrowRight size={16} /></button></div><div className="mini-map"><span className="map-route route-one" /><span className="map-route route-two" /><span className="map-marker marker-home"><House size={13} /></span><span className="map-marker marker-gem"><Gem size={13} /></span><span className="map-marker marker-bounty"><Target size={13} /></span><span className="map-mountain" /><span className="map-tree tree-one" /><span className="map-tree tree-two" /></div><div className="map-footer"><span><i className="online-dot" /> 1,283 online</span><strong>3 regions discovered</strong></div><div className="community-card"><div className="community-icon"><MessageCircle size={20} /></div><div><strong>Pull up a chair</strong><p>Join the campfire and meet fellow ranchers.</p></div><button onClick={() => notify('Community chat opened')}><ArrowRight size={16} /></button></div></aside>
      </section>
      </>}

      <footer className="footer"><div className="footer-brand"><span className="footer-mascot"><img src="/bandit-buddy-mascot.png" alt="Bandit Buddy mascot" /></span><span className="footer-brand-name"><strong>Bandi</strong><em>Buddy</em></span></div><span>Built for the curious, owned by the players.</span><div className="footer-community"><strong>Join our community</strong><a href="https://t.me/banditbuddy_official" target="_blank" rel="noreferrer" aria-label="Bandit Buddy on Telegram"><Send size={15} /></a><a href="https://x.com/banditbuddyxyz" target="_blank" rel="noreferrer" aria-label="Bandit Buddy on X"><X size={15} /></a><a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Bandit Buddy on Facebook"><Users size={15} /></a><a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="Bandit Buddy on YouTube"><Play size={15} /></a></div><div className="footer-links"><a href="#top">About</a><a href="#collection">Roadmap</a><a href="#collection">White paper</a></div></footer>
      {notice && <div className="toast" role="status"><Sparkles size={16} /> {notice}</div>}
    </main>
  )
}
