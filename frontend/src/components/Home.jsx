export default function Home({ onQuick, onFull }) {
  return (
    <div className="home">
      <div className="home-hero">
        <h1 className="home-motto">
          Plan today's class,<br />
          <em>or the whole term.</em>
        </h1>
        <p className="home-sub">
          Upload your textbook — LessonGrove builds lesson plans grounded in your actual text, one session at a time or all at once.
        </p>
      </div>

      <div className="home-modes">
        <button className="mode-card mode-card--quick" onClick={onQuick} aria-label="Quick lesson — generate a single lesson plan">
          <div className="mode-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 3L11 12M11 12L7.5 8.5M11 12L14.5 8.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 16H17" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M7 19H15" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
            </svg>
          </div>
          <span className="mode-kicker">Quick lesson</span>
          <span className="mode-headline">Just need tomorrow covered?</span>
          <span className="mode-desc">Pick a chapter or page range from your textbook. Get a complete, class-ready lesson plan in under a minute.</span>
          <span className="mode-cta" aria-hidden="true">Generate a lesson →</span>
        </button>

        <button className="mode-card mode-card--full" onClick={onFull} aria-label="Full curriculum — build a complete term plan">
          <div className="mode-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="14" width="4" height="6" rx="1" fill="#b5562f" opacity="0.7"/>
              <rect x="9" y="9" width="4" height="11" rx="1" fill="#b5562f" opacity="0.85"/>
              <rect x="16" y="4" width="4" height="16" rx="1" fill="#b5562f"/>
            </svg>
          </div>
          <span className="mode-kicker">Full curriculum</span>
          <span className="mode-headline">Building a whole term?</span>
          <span className="mode-desc">Upload your textbook, set your term length and weekly sessions. LessonGrove writes every lesson plan for the whole schedule.</span>
          <span className="mode-cta" aria-hidden="true">Start planning →</span>
        </button>
      </div>
    </div>
  )
}
