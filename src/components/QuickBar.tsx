import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import type { Page } from '../navigation';
import VisionPanel from './VisionPanel';

type Props = { page: Page; onGo: (page: Page) => void };

export default function QuickBar({ page, onGo }: Props) {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const [visionOpen, setVisionOpen] = useState(false);

  const supportLabel = isAr ? 'الدعم والشكاوى' : 'Support and complaints';
  const visionLabel = isAr ? 'رؤيتنا' : 'Our vision';

  return (
    <>
      <nav className="quickbar" aria-label={isAr ? 'وصول سريع' : 'Quick access'}>
        <button
          type="button"
          className={`quickbar-item${page === 'support' ? ' active' : ''}`}
          onClick={() => onGo('support')}
          aria-label={supportLabel}
          aria-current={page === 'support' ? 'page' : undefined}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
          <span className="quickbar-label" dir={dir}>
            {supportLabel}
          </span>
        </button>

        <button
          type="button"
          className={`quickbar-item${visionOpen ? ' active' : ''}`}
          onClick={() => setVisionOpen(true)}
          aria-label={visionLabel}
          aria-haspopup="dialog"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="quickbar-label" dir={dir}>
            {visionLabel}
          </span>
        </button>
      </nav>

      {visionOpen && <VisionPanel onClose={() => setVisionOpen(false)} />}
    </>
  );
}
