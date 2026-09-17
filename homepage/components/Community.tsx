'use client'

import { ArrowRight, MessageCircle, Target, Users } from 'lucide-react'
import { useState } from 'react'
import { useToast } from './ToastProvider'

type Post = { id: number; initials: string; name: string; time: string; text: string; replies: string[]; tips: number; tone: string; category: string }

const initialPosts: Post[] = [
  { id: 1, initials: 'JR', name: 'Jesse R.',     time: '12m ago', text: 'Finally unlocked the Moon crystal plot. The glow at sunset is unreal.', replies: ['That glow is incredible!'], tips: 12, tone: '',       category: 'Latest' },
  { id: 2, initials: 'MK', name: 'Mika K.',      time: '38m ago', text: 'Anyone up for the Watchtower bounty? Need two more ranchers.',            replies: [],                     tips: 8,  tone: 'green',  category: 'Following' },
  { id: 3, initials: 'BB', name: 'Bandit Buddy', time: '1h ago',  text: 'New trail discovered beyond Dustbowl County. Bring your best buddy.',     replies: ['Meet you at the north gate.'], tips: 24, tone: 'purple', category: 'Announcements' },
]

export default function Community() {
  const { notify } = useToast()
  const [activeTab, setActiveTab] = useState('Latest')
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [tipped, setTipped] = useState<number[]>([])
  const [replyId, setReplyId] = useState<number | null>(null)
  const [replyDraft, setReplyDraft] = useState('')

  const visiblePosts = activeTab === 'Latest' ? posts : posts.filter((p) => p.category === activeTab)

  const publish = () => {
    const text = draft.trim()
    if (!text) return notify('Write something before posting')
    setPosts([{ id: Date.now(), initials: 'BB', name: 'Bandit Buddy', time: 'just now', text, replies: [], tips: 0, tone: 'purple', category: 'Latest' }, ...posts])
    setDraft('')
    setComposerOpen(false)
    notify('Your story is now around the campfire')
  }

  const share = async (post: Post) => {
    try { await navigator.clipboard?.writeText(post.text); notify('Post link copied to clipboard') }
    catch { notify('Share link ready') }
  }

  const postReply = (postId: number) => {
    const text = replyDraft.trim()
    if (!text) return
    setPosts(posts.map((p) => p.id === postId ? { ...p, replies: [...p.replies, text] } : p))
    setReplyDraft('')
    notify('Reply posted')
  }

  return (
    <section className="community-page">
      <div className="community-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> COMMUNITY · THE CAMPFIRE</span>
          <h1>Pull up a chair.<br /><span>Tell your story.</span></h1>
          <p>The campfire is where ranchers swap tips, find a crew, and celebrate the little wins that make the frontier feel alive.</p>
        </div>
        <div className="campfire-card">
          <div className="fire">✦</div>
          <strong>4,200+</strong>
          <span>ranchers around<br />the campfire</span>
        </div>
      </div>

      <div className="community-layout">
        <main className="feed">
          <div className="feed-tabs">
            {['Latest', 'Following', 'Announcements'].map((tab) => (
              <button key={tab} className={activeTab === tab ? 'selected' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>
            ))}
            <button className="new-post" onClick={() => setComposerOpen(true)}>+ New post</button>
          </div>

          {visiblePosts.length ? visiblePosts.map((post) => (
            <article className="post-card" key={post.id}>
              <span className={`post-avatar ${post.tone}`}>{post.initials}</span>
              <div className="post-body">
                <div className="post-meta"><strong>{post.name}</strong><span>· {post.time}</span></div>
                <p>{post.text}</p>
                <div className="post-actions">
                  <button
                    className={tipped.includes(post.id) ? 'action-active' : ''}
                    onClick={() => {
                      if (tipped.includes(post.id)) return
                      setTipped([...tipped, post.id])
                      setPosts(posts.map((p) => p.id === post.id ? { ...p, tips: p.tips + 1 } : p))
                      notify('You tipped this rancher')
                    }}
                  ><span>♡</span> Tip {post.tips}</button>
                  <button onClick={() => setReplyId(replyId === post.id ? null : post.id)}>
                    <MessageCircle size={14} /> {post.replies.length} replies
                  </button>
                  <button onClick={() => share(post)}>Share</button>
                </div>
                {replyId === post.id && (
                  <div className="reply-panel">
                    {post.replies.map((reply, i) => <p key={i}><strong>BB</strong>{reply}</p>)}
                    <div className="reply-input">
                      <input
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Reply to this rancher..."
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) postReply(post.id) }}
                      />
                      <button onClick={() => postReply(post.id)}>Post</button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          )) : <div className="empty-feed">No posts in this trail yet.</div>}

          {composerOpen && (
            <div className="composer">
              <div className="composer-head">
                <strong>New campfire post</strong>
                <button onClick={() => setComposerOpen(false)} aria-label="Close composer">×</button>
              </div>
              <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What is happening on your ranch?" maxLength={280} />
              <div>
                <small>{draft.length}/280</small>
                <button className="primary-button" onClick={publish}>Publish post <ArrowRight size={14} /></button>
              </div>
            </div>
          )}
        </main>

        <aside className="community-sidebar">
          <div className="side-title">
            <span><Users size={16} /> Active around here</span>
            <span className="live-pill">LIVE</span>
          </div>
          <div className="active-ranchers"><span>JR</span><span>MK</span><span>AL</span><span>+18</span></div>
          <p className="side-note">Ranchers are online across 6 regions right now.</p>
          <div className="campfire-tip">
            <Target size={16} />
            <strong>Find your crew</strong>
            <p>Join a group bounty and earn a 1.2x reward multiplier together.</p>
            <button onClick={() => notify('Crew finder opened')}>Browse crews <ArrowRight size={14} /></button>
          </div>
        </aside>
      </div>
    </section>
  )
}
