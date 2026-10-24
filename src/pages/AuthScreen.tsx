import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { brand } from '../config/brand';
import { useLanguage } from '../i18n/LanguageContext';
import { configured } from '../lib/supabase';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';
type Kind = 'login' | 'register' | 'other';

const emailOk = (v: string) => /^\S+@\S+\.\S+$/.test(v);

/** Hidden panels can't be focused or read by screen readers (works on React 18 and 19). */
const setInert = (el: HTMLElement | null, off: boolean) => {
  if (el) (el as HTMLElement & { inert: boolean }).inert = off;
};

const svgProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
const IconUser = (
  <svg {...svgProps}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
  </svg>
);
const IconMail = (
  <svg {...svgProps}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
const IconEye = (
  <svg {...svgProps}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);
const IconEyeOff = (
  <svg {...svgProps}>
    <path d="M4 4l16 16" />
    <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.3 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-.9" />
    <path d="M10 10a2.8 2.8 0 0 0 4 4" />
  </svg>
);

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  ltr,
  trailing,
  hint,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  ltr?: boolean;
  trailing?: ReactNode;
  hint?: string;
  maxLength?: number;
}) {
  return (
    <div className="authx__field">
      <label htmlFor={id}>{label}</label>
      <div className="authx__control">
        <input
          id={id}
          type={type}
          dir={ltr ? 'ltr' : undefined}
          value={value}
          maxLength={maxLength}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
        {trailing}
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export default function AuthScreen({
  mode,
  setMode,
  notice,
}: {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  notice?: string;
}) {
  const auth = useAuth();
  const { lang, dir } = useLanguage();
  const isAr = lang === 'ar';
  /** Pick the Arabic or English text for the current language. */
  const tx = (ar: string, en: string) => (isAr ? ar : en);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const active: Kind = mode === 'login' ? 'login' : mode === 'register' ? 'register' : 'other';

  const goTo = (m: AuthMode) => {
    setError('');
    setInfo('');
    setPassword('');
    setShowPw(false);
    setMode(m);
  };

  const titles: Record<AuthMode, [string, string]> = {
    login: [
      tx('أهلًا بعودتك', 'Welcome back'),
      tx('سجّل دخولك عشان تحجز وتتابع تذاكرك.', 'Sign in to book and track your tickets.'),
    ],
    register: [
      tx('أنشئ حسابك', 'Create your account'),
      tx('حساب واحد لكل تذاكرك ورحلاتك.', 'One account for all your tickets and trips.'),
    ],
    forgot: [
      tx('نسيت كلمة السر؟', 'Forgot your password?'),
      tx('اكتب إيميلك وهنبعتلك رابط لإعادة التعيين.', "Enter your email and we'll send you a reset link."),
    ],
    reset: [
      tx('كلمة سر جديدة', 'New password'),
      tx('اختار كلمة سر جديدة لحسابك.', 'Choose a new password for your account.'),
    ],
    verify: [
      tx('تحقق من إيميلك', 'Check your email'),
      tx(
        `بعتنا رابط تفعيل على ${email}. افتحه عشان تفعّل حسابك.`,
        `We sent an activation link to ${email}. Open it to activate your account.`,
      ),
    ],
  };

  /** Text shown on the dark band, one set per band position. */
  const band: Record<Kind, [string, string, string]> = {
    login: [
      tx('أهلًا', 'Welcome'),
      tx('بعودتك.', 'back.'),
      tx('تذاكرك ورحلاتك زي ما سيبتها.', 'Your tickets and trips are right where you left them.'),
    ],
    register: [
      tx('ابدأ', 'Start your'),
      tx('رحلتك الأولى.', 'first ride.'),
      tx('حساب واحد لكل تذاكرك على المونوريل.', 'One account for every ticket on the monorail.'),
    ],
    other: [
      tx('مفيش مشكلة،', 'No worries,'),
      tx('هنرجّعلك حسابك.', "we'll get you back in."),
      tx('خطوتين بس وترجع تحجز.', 'Two quick steps and you are booking again.'),
    ],
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (mode !== 'reset' && !emailOk(email)) return setError(tx('اكتب إيميل صحيح', 'Enter a valid email'));
    if ((mode === 'register' || mode === 'reset') && password.length < 8)
      return setError(tx('كلمة السر لازم تكون ٨ حروف على الأقل', 'Password must be at least 8 characters'));
    if (mode === 'register' && name.trim().length < 2) return setError(tx('اكتب اسمك', 'Enter your name'));
    setBusy(true);
    try {
      if (mode === 'login') {
        const err = await auth.signIn(email, password);
        if (err) {
          setError(err);
          if (/فعّل/.test(err))
            setInfo(
              tx(
                'لو الرسالة ماوصلتش، دوس «إعادة إرسال رسالة التفعيل».',
                'If the message did not arrive, tap "Resend activation email".',
              ),
            );
        }
      } else if (mode === 'register') {
        const r = await auth.signUp(email, password, name.trim());
        if (r.error) setError(r.error);
        else if (r.needsVerify) goTo('verify');
      } else if (mode === 'forgot') {
        const err = await auth.forgot(email);
        if (err) setError(err);
        else
          setInfo(
            tx(
              'لو الإيميل مسجّل عندنا، هتوصلك رسالة فيها رابط إعادة التعيين.',
              'If the email is registered with us, you will receive a message with a reset link.',
            ),
          );
      } else if (mode === 'reset') {
        const err = await auth.resetPassword(password);
        if (err) setError(err);
        else setInfo(tx('تم تغيير كلمة السر ✓', 'Password changed ✓'));
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    const err = await auth.resend(email);
    setBusy(false);
    err ? setError(err) : setInfo(tx('بعتنا رسالة التفعيل تاني.', 'We sent the activation email again.'));
  };

  const submitLabel: Record<AuthMode, string> = {
    login: tx('تسجيل الدخول', 'Sign in'),
    register: tx('إنشاء الحساب', 'Create account'),
    forgot: tx('ابعت الرابط', 'Send link'),
    reset: tx('حفظ كلمة السر', 'Save password'),
    verify: '',
  };

  const pwToggle = (
    <button
      type="button"
      className="authx__icon authx__icon--btn"
      onClick={() => setShowPw((s) => !s)}
      aria-label={showPw ? tx('إخفاء كلمة السر', 'Hide password') : tx('إظهار كلمة السر', 'Show password')}
    >
      {showPw ? IconEyeOff : IconEye}
    </button>
  );
  const pwType = showPw ? 'text' : 'password';

  const messages = (
    <>
      {error && (
        <p className="authx__error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="authx__note" role="status">
          {info}
        </p>
      )}
    </>
  );

  const header = (m: AuthMode) => (
    <header className="authx__head">
      <h1>{titles[m][0]}</h1>
      <p>{titles[m][1]}</p>
      {notice && m !== 'verify' && <p className="authx__note">{notice}</p>}
      {!configured && (
        <p className="authx__error" role="alert">
          {tx(
            'إعدادات Supabase ناقصة. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY (اقرأ ملف .env.example).',
            'Supabase settings are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see the .env.example file).',
          )}
        </p>
      )}
    </header>
  );

  const panelProps = (kind: Kind) => ({
    className: `authx__panel authx__panel--${kind}${active === kind ? ' is-on' : ''}`,
    ref: (el: HTMLElement | null) => setInert(el, active !== kind),
  });
  const msgClass = (kind: Kind) => `authx__msg authx__msg--${kind}${active === kind ? ' is-on' : ''}`;

  return (
    <div className="authx-wrap">
      <div className={`authx${isAr ? ' authx--rtl' : ''}`} dir={dir} data-cover={active === 'login' ? 'end' : 'start'}>
        <div className="authx__band" aria-hidden="true" />

        {/* Band messages: the one for the current band position fades in after the band lands */}
        {(['login', 'register', 'other'] as Kind[]).map((kind) => (
          <div key={kind} className={msgClass(kind)} aria-hidden="true">
            <span className="authx__brand">{brand.name}</span>
            <h2>
              {band[kind][0]} <span className="authx__accent">{band[kind][1]}</span>
            </h2>
            <p>{band[kind][2]}</p>
          </div>
        ))}

        {/* Sign in */}
        <section {...panelProps('login')}>
          {header('login')}
          <form onSubmit={submit} noValidate>
            <Field
              id="login-email"
              label={tx('الإيميل', 'Email')}
              type="email"
              ltr
              value={email}
              onChange={setEmail}
              autoComplete="email"
              trailing={<span className="authx__icon">{IconMail}</span>}
            />
            <Field
              id="login-pass"
              label={tx('كلمة السر', 'Password')}
              type={pwType}
              ltr
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              trailing={pwToggle}
            />
            <button type="button" className="authx__link authx__link--end" onClick={() => goTo('forgot')}>
              {tx('نسيت كلمة السر؟', 'Forgot your password?')}
            </button>
            {active === 'login' && messages}
            <button className="authx__btn" disabled={busy || !configured} type="submit">
              {busy ? tx('استنى…', 'Please wait…') : submitLabel.login}
            </button>
            {active === 'login' && error && /فعّل/.test(error) && (
              <button type="button" className="authx__btn authx__btn--ghost" onClick={resend}>
                {tx('إعادة إرسال رسالة التفعيل', 'Resend activation email')}
              </button>
            )}
            <p className="authx__switch">
              {tx('مفيش عندك حساب؟', 'New to MonoGo?')}{' '}
              <button type="button" className="authx__link" onClick={() => goTo('register')}>
                {tx('أنشئ حساب', 'Create an account')}
              </button>
            </p>
          </form>
        </section>

        {/* Create account */}
        <section {...panelProps('register')}>
          {header('register')}
          <form onSubmit={submit} noValidate>
            <Field
              id="reg-name"
              label={tx('الاسم', 'Full name')}
              value={name}
              onChange={setName}
              maxLength={50}
              autoComplete="name"
              trailing={<span className="authx__icon">{IconUser}</span>}
            />
            <Field
              id="reg-email"
              label={tx('الإيميل', 'Email')}
              type="email"
              ltr
              value={email}
              onChange={setEmail}
              autoComplete="email"
              trailing={<span className="authx__icon">{IconMail}</span>}
            />
            <Field
              id="reg-pass"
              label={tx('كلمة السر', 'Password')}
              type={pwType}
              ltr
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              hint={tx('٨ حروف على الأقل', 'Use 8 characters or more')}
              trailing={pwToggle}
            />
            {active === 'register' && messages}
            <button className="authx__btn" disabled={busy || !configured} type="submit">
              {busy ? tx('استنى…', 'Please wait…') : submitLabel.register}
            </button>
            <p className="authx__switch">
              {tx('عندك حساب بالفعل؟', 'Already have an account?')}{' '}
              <button type="button" className="authx__link" onClick={() => goTo('login')}>
                {tx('سجّل دخول', 'Sign in')}
              </button>
            </p>
          </form>
        </section>

        {/* Forgot / reset / verify share one panel */}
        <section {...panelProps('other')}>
          {header(active === 'other' ? mode : 'forgot')}
          {mode === 'verify' ? (
            <div className="authx__form">
              {active === 'other' && messages}
              <button className="authx__btn" disabled={busy} onClick={resend}>
                {tx('إعادة إرسال رسالة التفعيل', 'Resend activation email')}
              </button>
              <button className="authx__btn authx__btn--ghost" onClick={() => goTo('login')}>
                {tx('رجوع لتسجيل الدخول', 'Back to sign in')}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              {mode !== 'reset' && (
                <Field
                  id="oth-email"
                  label={tx('الإيميل', 'Email')}
                  type="email"
                  ltr
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  trailing={<span className="authx__icon">{IconMail}</span>}
                />
              )}
              {mode === 'reset' && (
                <Field
                  id="oth-pass"
                  label={tx('كلمة السر الجديدة', 'New password')}
                  type={pwType}
                  ltr
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  hint={tx('٨ حروف على الأقل', 'Use 8 characters or more')}
                  trailing={pwToggle}
                />
              )}
              {active === 'other' && messages}
              <button className="authx__btn" disabled={busy || !configured} type="submit">
                {busy ? tx('استنى…', 'Please wait…') : submitLabel[mode === 'forgot' || mode === 'reset' ? mode : 'forgot']}
              </button>
              {mode === 'forgot' && (
                <p className="authx__switch">
                  <button type="button" className="authx__link" onClick={() => goTo('login')}>
                    {tx('رجوع', 'Back')}
                  </button>
                </p>
              )}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
