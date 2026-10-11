import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

type Props = { onClose: () => void };

type Section = { id: string; title: string; paragraphs?: string[]; items?: string[] };

type Copy = {
  heading: string;
  toc: string;
  close: string;
  note: string;
  partner: (name: string) => string;
  sections: Section[];
};

/**
 * Put the real partner name here ONLY if there is an actual agreement,
 * for example 'محافظة القاهرة'. While it is null, nothing about a partnership is shown.
 */
const PARTNER = null as string | null;

const COPY: Record<'ar' | 'en', Copy> = {
  ar: {
    heading: 'عن MonoGo',
    toc: 'المحتويات',
    close: 'رجوع',
    note: 'MonoGo مشروع تعليمي مستقل وليس موقعاً رسمياً، والتذاكر التي يصدرها تجريبية.',
    partner: (name) => `بالتعاون مع ${name}`,
    sections: [
      {
        id: 'vision',
        title: 'رؤيتنا',
        paragraphs: [
          'أن تصبح رحلة الراكب على المونوريل أسهل وأوضح من أول لحظة تخطيط وحتى الوصول، من خلال منصة رقمية واحدة تجمع المحطات والأسعار والتذاكر والاشتراكات والدعم في مكان واحد وبلغتين.',
          'ونتطلع إلى أن يكون MonoGo نموذجاً عملياً لخدمة نقل رقمية بسيطة وموثوقة، يمكن ربطها مستقبلاً بأنظمة التشغيل والدفع الرسمية، بما يحقق راحة الركاب ويقلل الزحام والانتظار عند شبابيك التذاكر.',
        ],
      },
      {
        id: 'mission',
        title: 'رسالتنا',
        paragraphs: [
          'تقديم تجربة تخطيط وحجز سلسة بالعربية والإنجليزية، تتيح للراكب معرفة مساره وسعر رحلته ومواعيد التشغيل قبل خروجه من المنزل، وإصدار تذكرة QR والتحقق منها عند البوابة بخطوات قليلة.',
          'ونلتزم بالشفافية في عرض المعلومات، وباحترام خصوصية المستخدمين، وبتوفير قناة دعم وشكاوى واضحة يتابع من خلالها كل مستخدم طلبه برقم مرجعي حتى يصله الرد.',
        ],
      },
      {
        id: 'goals',
        title: 'أهدافنا',
        items: [
          'تخطيط الرحلة بين المحطات بضغطة واحدة مع عرض المدة والسعر.',
          'إصدار تذكرة QR رقمية والتحقق منها عند البوابة.',
          'توفير اشتراكات رقمية بديلة عن التذاكر الورقية.',
          'دعم وشكاوى بمتابعة برقم مرجعي حتى الرد.',
          'واجهة واضحة بالعربية والإنجليزية ووضعين فاتح وداكن لسهولة القراءة.',
          'تقليل الزحام والانتظار عند شبابيك التذاكر.',
        ],
      },
    ],
  },
  en: {
    heading: 'About MonoGo',
    toc: 'Contents',
    close: 'Back',
    note: 'MonoGo is an independent educational project, not an official website, and the tickets it issues are for demonstration.',
    partner: (name) => `In collaboration with ${name}`,
    sections: [
      {
        id: 'vision',
        title: 'Our vision',
        paragraphs: [
          'To make every monorail journey easier and clearer, from the first moment of planning to arrival, through one digital platform that brings stations, fares, tickets, subscriptions and support together in two languages.',
          'We hope MonoGo can serve as a practical model for a simple, reliable digital transport service that could later connect to the official operating and payment systems, giving riders more comfort and reducing crowding and waiting at ticket counters.',
        ],
      },
      {
        id: 'mission',
        title: 'Our mission',
        paragraphs: [
          'To offer a smooth planning and booking experience in Arabic and English, so riders know their route, fare and operating hours before leaving home, and can get a QR ticket and verify it at the gate in a few steps.',
          'We commit to transparency in the information we show, to respecting user privacy, and to a clear support and complaints channel where every user can follow their request with a reference number until they get a reply.',
        ],
      },
      {
        id: 'goals',
        title: 'Our goals',
        items: [
          'Plan a trip between stations in one tap, with duration and fare.',
          'Issue digital QR tickets and verify them at the gate.',
          'Offer digital subscriptions instead of paper tickets.',
          'Support and complaints with a reference number, followed until a reply.',
          'A clear interface in Arabic and English, with light and dark modes for easy reading.',
          'Reduce crowding and waiting at ticket counters.',
        ],
      },
    ],
  },
};

export default function VisionPanel({ onClose }: Props) {
  const { lang } = useLanguage();
  const copy = COPY[lang === 'ar' ? 'ar' : 'en'];
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [active, setActive] = useState(copy.sections[0].id);

  // lock page scroll behind the panel, close on Escape, focus the close button
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const findSection = (id: string) => rootRef.current?.querySelector<HTMLElement>(`#vp-${id}`) ?? null;

  const onScroll = () => {
    const root = rootRef.current;
    if (!root) return;
    const rootTop = root.getBoundingClientRect().top;
    let current = copy.sections[0].id;
    for (const s of copy.sections) {
      const el = findSection(s.id);
      if (el && el.getBoundingClientRect().top - rootTop <= 140) current = s.id;
    }
    setActive(current);
  };

  const goTo = (id: string) => {
    findSection(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  };

  return (
    <div
      className="vp"
      ref={rootRef}
      onScroll={onScroll}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vp-title"
    >
      <header className="vp-head">
        <h1 id="vp-title">{copy.heading}</h1>
        <button type="button" className="vp-close" onClick={onClose} ref={closeRef}>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          {copy.close}
        </button>
      </header>

      <div className="vp-body">
        <main className="vp-content">
          {PARTNER && <p className="vp-partner">{copy.partner(PARTNER)}</p>}

          {copy.sections.map((s) => (
            <section key={s.id} id={`vp-${s.id}`} className="vp-section">
              <h2>{s.title}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.items && (
                <ul>
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <p className="vp-note">{copy.note}</p>
        </main>

        <nav className="vp-toc" aria-label={copy.toc}>
          <strong>{copy.toc}</strong>
          {copy.sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === active ? 'active' : ''}
              aria-current={s.id === active ? 'true' : undefined}
              onClick={() => goTo(s.id)}
            >
              {s.title}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
