import { useState, useEffect } from 'react'

const MESSAGE_SETS = {
  lesson: [
    'Reading your source material…',
    'Identifying key concepts…',
    'Writing learning objectives…',
    'Crafting classroom activities…',
    'Building assessment questions…',
    'Grounding every item in your content…',
    'Adding source citations…',
    'Almost done…',
  ],
  assignment: [
    'Reading your source material…',
    'Analyzing content for tasks…',
    'Writing student-facing prompts…',
    'Calibrating difficulty level…',
    'Adding source citations…',
    'Reviewing for accuracy…',
    'Almost done…',
  ],
  lecture_outline: [
    'Reading your source material…',
    'Mapping lecture structure…',
    'Writing section headings…',
    'Drafting talking points…',
    'Estimating time per section…',
    'Citing source pages…',
    'Almost done…',
  ],
  discussion_prompts: [
    'Reading your source material…',
    'Finding key ideas to discuss…',
    'Writing seminar prompts…',
    'Adding follow-up questions…',
    'Grounding in your text…',
    'Almost done…',
  ],
  essay_prompt: [
    'Reading your source material…',
    'Crafting the essay question…',
    'Writing context paragraph…',
    'Building the grading rubric…',
    'Setting criteria and weights…',
    'Almost done…',
  ],
  question_bank: [
    'Reading your source material…',
    'Writing multiple choice questions…',
    'Crafting short answer questions…',
    'Writing essay questions…',
    'Generating answer keys…',
    'Citing source pages…',
    'Almost done…',
  ],
  curriculum: [
    'Analyzing your textbook structure…',
    'Mapping chapters to sessions…',
    'Building the term schedule…',
    'Almost done…',
  ],
  structure: [
    'Reading your textbook…',
    'Detecting chapter boundaries…',
    'Extracting section titles…',
    'Building structure map…',
  ],
}

function DocumentAnimation() {
  return (
    <div className="gen-doc-wrap" aria-hidden="true">
      <svg className="gen-doc" viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Page */}
        <rect x="8" y="4" width="64" height="92" rx="6" fill="var(--card)" stroke="var(--rule)" strokeWidth="1.5"/>
        {/* Corner fold */}
        <path d="M52 4 L72 24 L52 24 Z" fill="var(--fog)" stroke="var(--rule)" strokeWidth="1"/>
        {/* Title line */}
        <rect className="gen-line gen-line-1" x="16" y="34" width="40" height="5" rx="2.5" fill="var(--terra)" opacity="0"/>
        {/* Body lines */}
        <rect className="gen-line gen-line-2" x="16" y="46" width="48" height="3.5" rx="1.75" fill="var(--rule-md)" opacity="0"/>
        <rect className="gen-line gen-line-3" x="16" y="54" width="44" height="3.5" rx="1.75" fill="var(--rule-md)" opacity="0"/>
        <rect className="gen-line gen-line-4" x="16" y="62" width="48" height="3.5" rx="1.75" fill="var(--rule-md)" opacity="0"/>
        <rect className="gen-line gen-line-5" x="16" y="70" width="36" height="3.5" rx="1.75" fill="var(--rule-md)" opacity="0"/>
        <rect className="gen-line gen-line-6" x="16" y="82" width="42" height="3.5" rx="1.75" fill="var(--rule-md)" opacity="0"/>
        {/* Pen cursor */}
        <g className="gen-pen">
          <rect x="58" y="78" width="4" height="12" rx="2" fill="var(--ember)" transform="rotate(-35 60 84)"/>
          <rect x="58.5" y="88" width="3" height="3" rx="1" fill="var(--terra)" transform="rotate(-35 60 84)"/>
        </g>
      </svg>
      <div className="gen-dots" aria-hidden="true">
        <span className="gen-dot"/><span className="gen-dot"/><span className="gen-dot"/>
      </div>
    </div>
  )
}

export default function GeneratingLoader({ outputType = 'lesson', title }) {
  const messages = MESSAGE_SETS[outputType] || MESSAGE_SETS.lesson
  const [msgIdx, setMsgIdx] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % messages.length)
        setFade(true)
      }, 300)
    }, 2200)
    return () => clearInterval(interval)
  }, [messages.length])

  return (
    <div className="gen-loader" role="status" aria-live="polite" aria-label="Generating content">
      <DocumentAnimation />
      <div className="gen-text">
        <h2 className="gen-title">{title || 'Writing your content…'}</h2>
        <p className={`gen-message${fade ? ' gen-message--visible' : ''}`}>
          {messages[msgIdx]}
        </p>
        <p className="gen-note">LessonGrove grounds every item in your source material.</p>
      </div>
    </div>
  )
}
