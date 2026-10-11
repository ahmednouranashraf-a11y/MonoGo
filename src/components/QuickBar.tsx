import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../i18n/LanguageContext';

export default function QuickBar() {
  const { theme, toggle } = useTheme();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const dark = theme === 'dark';

  const label = dark ? (isAr ? 'الوضع الفاتح' : 'Light mode') : isAr ? 'الوضع الداكن' : 'Dark mode';

  return (
    <nav className="quickbar" aria-label={isAr ? 'وصول سريع' : 'Quick access'}>
      <button type="button" className="quickbar-item" onClick={toggle} aria-label={label}>
        {dark ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
        <span className="quickbar-label" dir={isAr ? 'rtl' : 'ltr'}>
          {label}
        </span>
      </button>
    </nav>
  );
}
