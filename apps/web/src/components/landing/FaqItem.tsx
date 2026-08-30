import { useState } from 'react';
import './landing.css';

interface FaqItemProps {
  question: string;
  answer: string;
}

/** FAQ 折叠项 */
export function FaqItem({ question, answer }: FaqItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`faq-item${open ? ' open' : ''}`}>
      <button className="faq-q" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {question}
        <span className="arrow" aria-hidden="true">＋</span>
      </button>
      <div className="faq-a">{answer}</div>
    </div>
  );
}
