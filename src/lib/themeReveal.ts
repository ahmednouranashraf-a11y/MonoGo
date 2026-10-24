import { flushSync } from 'react-dom';
import '../styles/theme-reveal.css';

type Transition = { ready: Promise<void>; finished: Promise<void> };
type DocWithTransitions = Document & { startViewTransition?: (update: () => void) => Transition };

type Origin = Element | { x: number; y: number } | null;

/**
 * Switches the theme with a circle that grows out of the toggle button until the whole screen has changed.
 *
 * `apply` is the code that really switches the theme (set state, or set the data-theme attribute).
 * Browsers without View Transitions, and people who asked for less motion, just get the instant switch.
 *
 *   <button onClick={(e) => revealTheme(e.currentTarget, toggleTheme)}>…</button>
 */
export function revealTheme(origin: Origin, apply: () => void, duration = 700) {
  const doc = document as DocWithTransitions;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce) {
    apply();
    return;
  }

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (origin instanceof Element) {
    const r = origin.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else if (origin) {
    x = origin.x;
    y = origin.y;
  }
  // Far enough to reach the corner that is furthest from the button.
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const root = document.documentElement;
  root.classList.add('theme-switching'); // stops the page's own color transitions from fighting the snapshot

  // flushSync applies the theme (state and effects) right now, so the "after" picture is taken straight away.
  // Do not wait for a frame in here: the page does not paint while this callback runs, so that wait shows up as a freeze.
  const transition = doc.startViewTransition(() => {
    flushSync(apply);
  });

  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration, easing: 'cubic-bezier(0.65, 0, 0.25, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {});

  const done = () => root.classList.remove('theme-switching');
  transition.finished.then(done, done);
}
