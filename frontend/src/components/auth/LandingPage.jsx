import { useState } from 'react'

function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="var(--terra)"/>
      <rect x="4"    y="20" width="7" height="8"  fill="white"/>
      <rect x="12.5" y="12" width="7" height="16" fill="white"/>
      <rect x="21"   y="4"  width="7" height="24" fill="white"/>
    </svg>
  )
}

export default function LandingPage({ onSignup, onLogin }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div className="landing-page">
      {/* Nav */}
      <nav className="landing-nav">
        <span className="logo landing-logo">
          <LogoMark />
          <span className="logo-text">LessonGrove</span>
        </span>
        <div className="landing-nav-right">
          <button className="landing-login-link" onClick={onLogin}>Log in</button>
          <button className="btn-primary landing-nav-cta" onClick={() => onSignup('quick')}>Get started</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="landing-hero">
        <h1 className="landing-headline">
          Plan today's class,<br />or the whole term.
        </h1>
        <p className="landing-sub">
          Generate lesson plans, assignments, and full curricula from your own source material — grounded in your textbook, not the internet.
        </p>

        {/* CTA cards */}
        <div className="landing-cards">
          <button
            className={`landing-cta-card${hovered === 'quick' ? ' landing-cta-card--hover' : ''}`}
            onClick={() => onSignup('quick')}
            onMouseEnter={() => setHovered('quick')}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="landing-card-icon" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
                <rect x="4" y="4" width="24" height="28" rx="3" stroke="var(--terra)" strokeWidth="1.5" fill="none"/>
                <rect x="8" y="10" width="16" height="2" rx="1" fill="var(--terra)" opacity=".6"/>
                <rect x="8" y="14" width="12" height="2" rx="1" fill="var(--terra)" opacity=".4"/>
                <rect x="8" y="18" width="14" height="2" rx="1" fill="var(--terra)" opacity=".4"/>
                <circle cx="24" cy="24" r="6" fill="var(--terra)"/>
                <path d="M21 24l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="landing-card-title">Quick lesson</h2>
            <p className="landing-card-desc">Generate a single lesson or assignment in under a minute</p>
            <span className="landing-card-cta">Get started →</span>
          </button>

          <button
            className={`landing-cta-card${hovered === 'full' ? ' landing-cta-card--hover' : ''}`}
            onClick={() => onSignup('full')}
            onMouseEnter={() => setHovered('full')}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="landing-card-icon" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
                <rect x="2" y="6" width="20" height="24" rx="3" stroke="var(--terra)" strokeWidth="1.5" fill="none"/>
                <rect x="6" y="3" width="20" height="24" rx="3" stroke="var(--terra)" strokeWidth="1.5" fill="var(--card)" opacity=".8"/>
                <rect x="10" y="9"  width="12" height="2" rx="1" fill="var(--terra)" opacity=".6"/>
                <rect x="10" y="13" width="10" height="2" rx="1" fill="var(--terra)" opacity=".4"/>
                <rect x="10" y="17" width="11" height="2" rx="1" fill="var(--terra)" opacity=".4"/>
                <rect x="10" y="21" width="9"  height="2" rx="1" fill="var(--terra)" opacity=".3"/>
              </svg>
            </div>
            <h2 className="landing-card-title">Full curriculum</h2>
            <p className="landing-card-desc">Upload your textbook and build a complete term plan</p>
            <span className="landing-card-cta">Get started →</span>
          </button>
        </div>

        <p className="landing-existing">
          Already have an account?{' '}
          <button className="landing-text-link" onClick={onLogin}>Log in →</button>
        </p>
      </div>
    </div>
  )
}
