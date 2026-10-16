import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

type Section = { id: string; title: string; paragraphs?: string[]; items?: string[] };

type Copy = {
  heading: string;
  toc: string;
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

export default function VisionPage() {
  const { lang } = useLanguage();
  const copy = COPY[lang === 'ar' ? 'ar' : 'en'];
  const [active, setActive] = useState(copy.sections[0].id);

  // highlight the section currently near the top of the screen
  useEffect(() => {
    const onScroll = () => {
      let current = copy.sections[0].id;
      for (const s of copy.sections) {
        const el = document.getElementById(`vision-${s.id}`);
        if (el && el.getBoundingClientRect().top <= 160) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [copy]);

  const goTo = (id: string) => {
    document.getElementById(`vision-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  };

  return (
    <div className="vision-page">
      <h1 className="vision-title">{copy.heading}</h1>

      <div className="vision-layout">
        <div className="vision-content">
          {PARTNER && <p className="vision-partner">{copy.partner(PARTNER)}</p>}

          {copy.sections.map((s) => (
            <section key={s.id} id={`vision-${s.id}`} className="vision-section">
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

          <p className="vision-note">{copy.note}</p>
        </div>

        <nav className="vision-toc" aria-label={copy.toc}>
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
