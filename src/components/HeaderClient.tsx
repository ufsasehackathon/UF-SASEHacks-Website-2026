"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import SignOutButton from "./auth/SignOutButton"
import { User } from "@supabase/supabase-js"

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

interface HeaderClientProps {
  user: User | null
  showDashboard: boolean
}

export default function HeaderClient({ user, showDashboard }: HeaderClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const navLinks = [
    { name: "About", href: "/#about" },
    { name: "Tracks", href: "/#tracks" },
    { name: "Schedule", href: "/#schedule" },
    { name: "Sponsors", href: "/#sponsors" },
    { name: "Partners", href: "/#partners" },
    { name: "Our Team", href: "/#teams" },
  ]

  const socialLinks = [
    {
      name: "Instagram",
      href: "https://www.instagram.com/ufsase/",
      icon: <InstagramIcon />
    },
  ]

  return (
    <header className="absolute top-0 left-0 right-0 z-50 px-4 pt-4">
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

          {showDashboard && (
            <Link href="/portal" className="hidden sm:inline-flex px-5 py-1.5 rounded-full text-xs font-black bg-[#560700] text-[#FFE4B3] hover:opacity-90 transition-opacity uppercase">
              Dashboard
            </Link>
          )}

          {mounted && (
            <>
              {user ? (
                <div>
                  <SignOutButton />
                </div>
              ) : (
                <Link href="/login" className="px-5 py-1.5 rounded-full text-xs font-black border border-[#560700] text-[#560700] hover:bg-[#560700] hover:text-[#FFE4B3] transition-all uppercase">
                  Login
                </Link>
              )}
            </>
          )}

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
            {showDashboard && (
              <Link href="/portal" className="text-[#560700] border-b border-[#560700]/5 pb-2" onClick={() => setMobileMenuOpen(false)}>
                DASHBOARD
              </Link>
            )}
            {mounted && !user && (
              <Link href="/login" className="text-[#560700] border-b border-[#560700]/5 pb-2" onClick={() => setMobileMenuOpen(false)}>
                LOGIN
              </Link>
            )}
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