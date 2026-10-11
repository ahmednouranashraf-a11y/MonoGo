import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, TouchEvent, KeyboardEvent } from "react";
import "../styles/hero-slider.css";

export interface HeroSlide {
  src: string;
  poster: string;
  /** object-position used when the video gets cropped (portrait videos) */
  position?: string;
  /** move on after this many seconds even if the video is longer */
  maxDuration?: number;
}

const base = import.meta.env.BASE_URL;

// The 6s flag video is first on purpose.
const SLIDES: HeroSlide[] = [
  { src: `${base}videos/hero-1.mp4`, poster: `${base}videos/hero-1.jpg`, position: "50% 50%" },
  { src: `${base}videos/hero-2.mp4`, poster: `${base}videos/hero-2.jpg`, position: "50% 50%", maxDuration: 12 },
  { src: `${base}videos/hero-3.mp4`, poster: `${base}videos/hero-3.jpg`, position: "50% 62%" },
  { src: `${base}videos/hero-4.mp4`, poster: `${base}videos/hero-4.jpg`, position: "50% 60%" },
];

const SWIPE_THRESHOLD = 50;
const isRtl = () => document.documentElement.dir === "rtl";

interface Props {
  slides?: HeroSlide[];
  children?: ReactNode;
}

export default function HeroSlider({ slides = SLIDES, children }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const touchStartX = useRef<number | null>(null);

  const count = slides.length;
  const goTo = useCallback((i: number) => setIndex((i + count) % count), [count]);
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);

  // Play only the active video, restart it from 0 whenever it becomes active
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
    fillRefs.current.forEach((f) => {
      if (f) f.style.transform = "scaleX(0)";
    });
  }, [index]);

  // Pause / resume the active video on hover
  useEffect(() => {
    const v = videoRefs.current[index];
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, index]);

  // Progress bar follows the real video time; also moves on at maxDuration
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRefs.current[index];
      const fill = fillRefs.current[index];
      if (v && fill && v.duration) {
        const limit = Math.min(v.duration, slides[index].maxDuration ?? Infinity);
        const p = Math.min(v.currentTime / limit, 1);
        fill.style.transform = `scaleX(${p})`;
        if (p >= 1) {
          next();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, next, slides]);

  // Touch swipe (direction-aware for RTL)
  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    const forward = isRtl() ? dx > 0 : dx < 0;
    if (forward) next();
    else prev();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight") (isRtl() ? prev : next)();
    if (e.key === "ArrowLeft") (isRtl() ? next : prev)();
  };

  return (
    <section
      className="hs"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
    >
      <div className="hs__slides">
        {slides.map((s, i) => (
          <video
            key={s.src}
            ref={(el) => {
              videoRefs.current[i] = el;
            }}
            className={`hs__video${i === index ? " is-active" : ""}`}
            style={{ objectPosition: s.position }}
            src={s.src}
            poster={s.poster}
            muted
            playsInline
            preload={i === 0 ? "auto" : "metadata"}
            autoPlay={i === 0}
            aria-hidden={i !== index}
            onEnded={i === index ? next : undefined}
            onError={i === index ? next : undefined}
          />
        ))}
      </div>

      <div className="hs__shade" />

      {children && <div className="hs__content">{children}</div>}

      <button className="hs__arrow hs__arrow--prev" onClick={prev} aria-label="Previous slide">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <button className="hs__arrow hs__arrow--next" onClick={next} aria-label="Next slide">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="hs__dots" role="tablist">
        {slides.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === index}
            aria-label={`Slide ${i + 1}`}
            className={`hs__dot${i === index ? " is-active" : ""}`}
            onClick={() => goTo(i)}
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
  );
}
