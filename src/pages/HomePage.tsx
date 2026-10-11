import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, TouchEvent } from 'react';
import { brand } from '../config/brand';
import Icon from '../components/Icon';
import RouteResult from '../components/RouteResult';
import StationPicker from '../components/StationPicker';
import { lineMeta } from '../data/network';
import type { Planner } from '../hooks/usePlanner';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDate, formatTime, num } from '../lib/format';
import type { Page } from '../navigation';

type Props = { planner: Planner; now: Date; onGo: (page: Page) => void; onBook: () => void };

/* ---------- Hero video slider (the 6s flag video is first) ---------- */
type HeroSlide = {
  src: string;
  poster: string;
  position: string; // object-position when a portrait video gets cropped
  maxDuration?: number; // move on after N seconds even if the video is longer
};

const base = import.meta.env.BASE_URL;

const HERO_SLIDES: HeroSlide[] = [
  { src: `${base}videos/hero-1.mp4`, poster: `${base}videos/hero-1.jpg`, position: '50% 50%' },
  { src: `${base}videos/hero-2.mp4`, poster: `${base}videos/hero-2.jpg`, position: '50% 50%', maxDuration: 12 },
  { src: `${base}videos/hero-3.mp4`, poster: `${base}videos/hero-3.jpg`, position: '50% 62%' },
  { src: `${base}videos/hero-4.mp4`, poster: `${base}videos/hero-4.jpg`, position: '50% 60%' },
];

const SWIPE_THRESHOLD = 50;
const isRtl = () => document.documentElement.dir === 'rtl';

export default function HomePage({ planner, now, onGo, onBook }: Props) {
  const { t } = useLanguage();
  const { from, to, route, error } = planner;
  const line = lineMeta['east-nile'];
  const count = num(line.stationCount);

  /* ---------- slider logic ---------- */
  const [slide, setSlide] = useState(0);
  const [hovered, setHovered] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const touchStartX = useRef<number | null>(null);

  const slideCount = HERO_SLIDES.length;
  const nextSlide = useCallback(() => setSlide((i) => (i + 1) % slideCount), [slideCount]);
  const prevSlide = useCallback(() => setSlide((i) => (i - 1 + slideCount) % slideCount), [slideCount]);

  // play only the active video, restart it from 0 when it becomes active
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === slide) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
    fillRefs.current.forEach((f) => {
      if (f) f.style.transform = 'scaleX(0)';
    });
  }, [slide]);

  // pause / resume on hover
  useEffect(() => {
    const v = videoRefs.current[slide];
    if (!v) return;
    if (hovered) v.pause();
    else v.play().catch(() => {});
  }, [hovered, slide]);

  // progress bar follows the real video time, and moves on at maxDuration
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRefs.current[slide];
      const fill = fillRefs.current[slide];
      if (v && fill && v.duration) {
        const limit = Math.min(v.duration, HERO_SLIDES[slide].maxDuration ?? Infinity);
        const p = Math.min(v.currentTime / limit, 1);
        fill.style.transform = `scaleX(${p})`;
        if (p >= 1) {
          nextSlide();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [slide, nextSlide]);

  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    const forward = isRtl() ? dx > 0 : dx < 0;
    if (forward) nextSlide();
    else prevSlide();
  };
  const onSliderKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') (isRtl() ? prevSlide : nextSlide)();
    if (e.key === 'ArrowLeft') (isRtl() ? nextSlide : prevSlide)();
  };

  return (
    <div className="dashboard">
      <div className="welcome">
        <div>
          <span className="eyebrow green">{t('home.eyebrow')}</span>
          <h1>
            {t('home.welcome')} <span>{brand.name}.</span>
          </h1>
          <p>{t('home.welcomeSub')}</p>
        </div>
        <div className="date-chip">
          <Icon name="clock" size={18} />
          {formatDate(now)}
        </div>
      </div>

      <section
        className="hs"
        aria-roledescription="carousel"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onKeyDown={onSliderKey}
      >
        <div className="hs__slides">
          {HERO_SLIDES.map((s, i) => (
            <video
              key={s.src}
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              className={`hs__video${i === slide ? ' is-active' : ''}`}
              style={{ objectPosition: s.position }}
              src={s.src}
              poster={s.poster}
              muted
              playsInline
              preload={i === 0 ? 'auto' : 'metadata'}
              autoPlay={i === 0}
              aria-hidden={i !== slide}
              onEnded={i === slide ? nextSlide : undefined}
              onError={i === slide ? nextSlide : undefined}
            />
          ))}
        </div>
        <div className="hs__shade" />

        <button className="hs__arrow hs__arrow--prev" onClick={prevSlide} aria-label="Previous slide">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <button className="hs__arrow hs__arrow--next" onClick={nextSlide} aria-label="Next slide">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="hs__dots" role="tablist">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === slide}
              aria-label={`Slide ${i + 1}`}
              className={`hs__dot${i === slide ? ' is-active' : ''}`}
              onClick={() => setSlide(i)}
            >
              <span
                className="hs__fill"
                ref={(el) => {
                  fillRefs.current[i] = el;
                }}
              />
            </button>
          ))}
        </div>
      </section>

      <div className="section-title-row">
        <div>
          <span className="eyebrow green">{t('home.goEyebrow')}</span>
          <h2>
            {t('home.goTitle')}{' '}
            <span className="heading-spark">
              <Icon name="spark" size={18} />
            </span>
          </h2>
        </div>
        <span className="section-helper">{t('home.goHelper')}</span>
      </div>

      <div className="planner-grid">
        <section className="planner-card" id="planner">
          <div className="card-top">
            <div className="card-icon">
              <Icon name="route" size={22} />
            </div>
            <div>
              <h3>{t('home.plannerTitle')}</h3>
              <p>{t('home.plannerSub')}</p>
            </div>
            <span className="card-step">{t('home.plannerStep')}</span>
          </div>

          <div className="picker-stack">
            <StationPicker label={t('home.fromLabel')} value={from} onChange={planner.setFrom} accent="#6aa5d8" />
            <button className="swap-button" onClick={planner.swap} aria-label={t('home.swapAria')}>
              <Icon name="swap" size={18} />
            </button>
            <StationPicker label={t('home.toLabel')} value={to} onChange={planner.setTo} accent="#dd8b67" />
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="dark-button plan-button" onClick={planner.submit}>
            {t('home.planButton')} <Icon name="arrow" size={19} />
          </button>
          <div className="planner-foot">
            <Icon name="spark" size={16} /> {t('home.plannerFoot', { n: count })}
          </div>
        </section>

        {route ? (
          <RouteResult route={route} onTicket={onBook} />
        ) : (
          <div className="result-card empty-result">
            <div className="empty-illustration">
              <Icon name="route" size={48} />
            </div>
            <span className="eyebrow green">{t('home.emptyEyebrow')}</span>
            <h3>{t('home.emptyTitle')}</h3>
            <p>{t('home.emptyText')}</p>
          </div>
        )}
      </div>

      <div className="quick-section">
        <div className="section-title-row">
          <div>
            <span className="eyebrow green">{t('home.quickEyebrow')}</span>
            <h2>{t('home.quickTitle')}</h2>
          </div>
        </div>
        <div className="quick-grid">
          <button className="quick-card" onClick={() => onGo('stations')}>
            <span className="quick-icon peach">
              <Icon name="route" size={24} />
            </span>
            <span>
              <strong>{t('home.quickStationsTitle')}</strong>
              <small>{t('home.quickStationsText')}</small>
            </span>
            <Icon name="arrow" size={18} />
          </button>
          <button className="quick-card" onClick={() => onGo('fares')}>
            <span className="quick-icon mint">
              <Icon name="ticket" size={24} />
            </span>
            <span>
              <strong>{t('home.quickFaresTitle')}</strong>
              <small>{t('home.quickFaresText')}</small>
            </span>
            <Icon name="arrow" size={18} />
          </button>
          <div className="quick-card static">
            <span className="quick-icon lavender">
              <Icon name="clock" size={24} />
            </span>
            <span>
              <strong>{t('home.quickHoursTitle')}</strong>
              <small>{t('fares.operatingHours')}</small>
            </span>
            <span className="quick-clock">{formatTime(now)}</span>
          </div>
        </div>
      </div>

      <footer className="main-footer">
        <span>{brand.name} — {t('home.footer1')}</span>
        <span>{t('home.footer2')}</span>
      </footer>
    </div>
  );
}
