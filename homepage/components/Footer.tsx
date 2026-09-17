import Link from 'next/link'
import { Play, Send, Users, X } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <span className="footer-mascot">
          <img src="/bandit-buddy-mascot.png" alt="Bandit Buddy mascot" />
        </span>
        <span className="footer-brand-name"><strong>Bandi</strong><em>Buddy</em></span>
      </div>
      <span>Built for the curious, owned by the players.</span>
      <div className="footer-community">
        <strong>Join our community</strong>
        <a href="https://t.me/banditbuddy_official" target="_blank" rel="noreferrer" aria-label="Bandit Buddy on Telegram"><Send size={15} /></a>
        <a href="https://x.com/banditbuddyxyz" target="_blank" rel="noreferrer" aria-label="Bandit Buddy on X"><X size={15} /></a>
        <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Bandit Buddy on Facebook"><Users size={15} /></a>
        <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="Bandit Buddy on YouTube"><Play size={15} /></a>
      </div>
      <div className="footer-links">
        <Link href="/">About</Link>
        <Link href="/roadmap">Roadmap</Link>
        <Link href="/whitepaper">White paper</Link>
      </div>
    </footer>
  )
}
