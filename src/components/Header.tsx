"use client"

import Link from "next/link"
import { useState } from "react"

const DiscordIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
)

const DevpostIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6.002 1.61L0 12.004l6.002 10.386h11.996l6.002-10.386L17.998 1.61zm1.858 4.08h2.969c4.35 0 7.144 2.22 7.144 6.314 0 4.134-2.391 6.314-7.144 6.314H7.86V5.69zm2.844 2.508v7.612h1.15c2.73 0 4.11-1.503 4.11-3.806 0-2.263-1.464-3.806-4.11-3.806z" />
  </svg>
)

const MenuIcon = ({ size = 24 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
  </svg>
)

const XIcon = ({ size = 24 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
)

const InstagramIcon = ({ size = 18 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
)

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { name: "About", href: "/#about" },
    { name: "Tracks", href: "/#tracks" },
    { name: "Schedule", href: "/#schedule" },
    { name: "Sponsors", href: "/#sponsors" },
    { name: "Partners", href: "/#partners" },
    { name: "Our Team", href: "/#teams" },
    { name: "FAQ", href: "/#faq" },
  ]

  const socialLinks = [
    {
      name: "Discord",
      href: "https://discord.gg/gJJVmEPzc6",
      icon: <DiscordIcon />
    },
    {
      name: "Instagram",
      href: "https://www.instagram.com/ufsase/",
      icon: <InstagramIcon />
    },
    {
      name: "Devpost",
      href: "https://sasehacks.devpost.com/",
      icon: <DevpostIcon />
    },
  ]

  return (
    <header className="absolute top-0 left-0 right-0 z-50 px-4 pt-4">
      <a
        id="mlh-trust-badge"
        style={{
          display: 'block',
          maxWidth: '100px',
          minWidth: '60px',
          position: 'fixed',
          left: '15px',
          top: '0',
          width: '10%',
          zIndex: 10000
        }}
        href="https://mlh.io/na?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2026-season&utm_content=gray"
        target="_blank"
        rel="noreferrer"
      >
        <img
          src="https://s3.amazonaws.com/logged-assets/trust-badge/2026/mlh-trust-badge-2026-gray.svg"
          alt="Major League Hacking 2026 Hackathon Season"
          style={{ width: '100%' }}
        />
      </a>

      <div className="mx-auto max-w-[95%] lg:max-w-[1400px] bg-[#ebb8ce] rounded-full px-8 py-1.5 flex items-center justify-between shadow-md border border-[#560700]/10">

        <Link href="/" className="ml-16 font-[family-name:var(--font-heading)] text-[#560700] text-xl md:text-2xl hover:opacity-80 transition-opacity">
          SASEHacks
        </Link>

        <nav className="hidden lg:flex items-center gap-8 text-xs font-bold">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href} className="text-[#560700] hover:opacity-60 transition-opacity uppercase tracking-widest">
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center gap-4 mr-2 border-r border-[#560700]/20 pr-4">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                className="text-[#560700] hover:scale-110 transition-transform"
                title={social.name}
              >
                {social.icon}
              </a>
            ))}
          </div>


          <button className="lg:hidden text-[#560700] p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-3 mx-auto max-w-screen-xl bg-[#ebb8ce] rounded-3xl px-8 py-6 shadow-xl border border-[#560700]/10">
          <nav className="flex flex-col gap-4 text-lg font-bold">
            {navLinks.map((link) => (
              <Link key={link.name} href={link.href} className="text-[#560700] border-b border-[#560700]/5 pb-2" onClick={() => setMobileMenuOpen(false)}>
                {link.name}
              </Link>
            ))}
            <div className="flex items-center gap-6 pt-2">
              {socialLinks.map((social) => (
                <a key={social.name} href={social.href} target="_blank" rel="noreferrer" className="text-[#560700]">
                  {social.icon}
                </a>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}