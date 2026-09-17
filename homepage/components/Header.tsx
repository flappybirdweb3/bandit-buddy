'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Bell, BookOpen, Coins, Compass, House, Menu, Milestone, Target, Users, Wallet, X } from 'lucide-react'
import { useToast } from './ToastProvider'

const navItems = [
  { label: 'My Ranch',    href: '/',            icon: House },
  { label: 'Bounty Board', href: '/bounty-board', icon: Target },
  { label: 'Outpost',     href: '/outpost',      icon: Compass },
  { label: 'Community',   href: '/community',    icon: Users },
  { label: 'White paper', href: '/whitepaper',   icon: BookOpen },
  { label: 'Roadmap',     href: '/roadmap',      icon: Milestone },
  { label: 'Token sale',  href: '/token-sale',   icon: Coins },
]

export default function Header() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [walletConnected, setWalletConnected] = useState(false)
  const { notify } = useToast()

  const isActive = (href: string) => {
    const p = pathname.replace(/\/$/, '') || '/'
    return href === '/' ? p === '/' : p === href.replace(/\/$/, '')
  }

  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Bandit Buddy home">
        <span className="brand-mascot">
          <img src="/bandit-buddy-mascot.png" alt="Bandit Buddy mascot" />
        </span>
        <span className="brand-name">
          <strong>Bandi</strong><em>Buddy</em><small>ON-CHAIN FRONTIER</small>
        </span>
      </Link>

      <button
        className="mobile-menu"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle navigation"
      >
        {menuOpen ? <X /> : <Menu />}
      </button>

      <nav className={menuOpen ? 'main-nav open' : 'main-nav'} aria-label="Main navigation">
        {navItems.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className={isActive(href) ? 'nav-link active' : 'nav-link'}
            onClick={() => setMenuOpen(false)}
          >
            <Icon size={17} /><span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="top-actions">
        <button
          className="icon-button"
          aria-label="Notifications"
          onClick={() => notify('No new bounty alerts')}
        >
          <Bell size={18} /><span className="notification-dot" />
        </button>
        <button
          className={walletConnected ? 'wallet-button connected' : 'wallet-button'}
          onClick={() => {
            setWalletConnected(!walletConnected)
            notify(walletConnected ? 'Wallet disconnected' : 'Wallet connected')
          }}
        >
          <Wallet size={16} />{walletConnected ? '0x7A...B42' : 'Connect wallet'}
        </button>
      </div>
    </header>
  )
}
