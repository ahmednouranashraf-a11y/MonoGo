import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { num } from '../lib/format';
import { supabase } from '../lib/supabase';
import '../styles/analytics.css';
import '../styles/analytics-v2.css';
import { getStationName } from './StationPicker';

// ---------- Types (what the SQL functions return) ----------

type Period = {
  revenue: number;
  ticket_revenue: number;
  subscription_revenue: number;
  tickets: number;
  passengers: number;
  avg_fare: number;
  avg_party: number;
  revenue_per_passenger: number;
  half_tickets: number;
  advance_tickets: number;
  avg_lead_days: number;
  subscriptions: number;
  avg_sub_price: number;
  orders_created: number;
  orders_paid: number;
  orders_failed: number;
  buyers: number;
  repeat_buyers: number;
  scans: number;
  scans_ok: number;
  new_users: number;
};

type Overview = { days: number; generated_at: string; current: Period; previous: Period };

type SeriesPoint = {
  t: string; // 'YYYY-MM-DDTHH:MM' in Cairo time
  ticket_revenue: number;
  subscription_revenue: number;
  revenue: number;
  tickets: number;
  passengers: number;
  subscriptions: number;
  prev_revenue: number;
  prev_tickets: number;
};

type Series = { bucket: Bucket; days: number; points: SeriesPoint[] };

type Top = {
  by_hour: { hour: number; tickets: number; passengers: number; revenue: number }[];
  by_weekday: { dow: number; tickets: number; passengers: number; revenue: number }[];
  top_origins: { station: string; passengers: number }[];
  top_destinations: { station: string; passengers: number }[];
  top_routes: { from: string; to: string; tickets: number; passengers: number }[];
  zones: { zone: number; tickets: number; passengers: number; revenue: number }[];
  kinds: { kind: string; tickets: number; revenue: number }[];
  plans: { plan: string; count: number; revenue: number }[];
  scans: { result: string; count: number }[];
};

type Source = 'all' | 'real' | 'demo';
type Bucket = 'hour' | 'day' | 'week';
type Metric = 'revenue' | 'tickets' | 'passengers' | 'subscriptions';

type Filters = {
  source: Source;
  product: 'all' | 'tickets' | 'subscriptions';
  kind: 'all' | 'full' | 'half';
  plan: 'all' | 'weekly' | 'monthly' | 'quarterly';
  zone: number; // -1 = all
  station: string; // '' = all
  advance: 'all' | 'only' | 'none';
};

const DEFAULT_FILTERS: Filters = {
  source: 'all',
  product: 'all',
  kind: 'all',
  plan: 'all',
  zone: -1,
  station: '',
  advance: 'all',
};

const REFRESH_MS = 30_000;
const PERIODS = [7, 14, 30, 90];

/** Station values exactly as the database stores them (the screen shows translated names). */
const STATIONS = [
  'الاستاد', 'هشام بركات', 'جامعة الأزهر', 'الحي السابع', 'المشير أحمد إسماعيل',
  'جيهان السادات', 'المشير طنطاوي', 'وان ناينتي', 'المستشفى الجوي', 'النرجس',
  'المستثمرين', 'اللوتس', 'جولدن سكوير', 'بيت الوطن', 'مسجد الفتاح العليم',
  'الحي R1', 'الحي R2', 'حي المال والأعمال', 'مدينة الفنون والثقافة',
  'الحي الحكومي', 'مسجد مصر', 'مدينة العدالة',
];

const PLAN_NAMES: Record<string, { ar: string; en: string }> = {
  weekly: { ar: 'أسبوعي', en: 'Weekly' },
  monthly: { ar: 'شهري', en: 'Monthly' },
  quarterly: { ar: 'ربع سنوي', en: 'Quarterly' },
};

const ZONE_NAMES: { ar: string; en: string }[] = [
  { ar: 'منطقة واحدة', en: 'One zone' },
  { ar: 'منطقتان', en: 'Two zones' },
  { ar: 'ثلاث مناطق', en: 'Three zones' },
  { ar: 'أربع مناطق', en: 'Four zones' },
];

const KIND_NAMES: Record<string, { ar: string; en: string }> = {
  full: { ar: 'تذكرة كاملة', en: 'Full ticket' },
  half: { ar: 'نصف تذكرة', en: 'Half ticket' },
};

const SCAN_NAMES: Record<string, { ar: string; en: string }> = {
  ok: { ar: 'مقبول', en: 'Accepted' },
  used: { ar: 'مستخدمة / رصيد خلص', en: 'Already used' },
  expired: { ar: 'منتهية', en: 'Expired' },
  invalid: { ar: 'رمز غير صحيح', en: 'Invalid code' },
  not_yet: { ar: 'لسه ما بدأتش', en: 'Not valid yet' },
};

const METRICS: { id: Metric; ar: string; en: string; money: boolean }[] = [
  { id: 'revenue', ar: 'الإيرادات', en: 'Revenue', money: true },
  { id: 'tickets', ar: 'التذاكر', en: 'Tickets', money: false },
  { id: 'passengers', ar: 'الركاب', en: 'Passengers', money: false },
  { id: 'subscriptions', ar: 'الاشتراكات', en: 'Subscriptions', money: false },
];

// Egypt's week starts on Saturday. Postgres dow: 0 = Sunday.
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
const WEEKDAYS: { ar: string; en: string }[] = [
  { ar: 'الأحد', en: 'Sun' },
  { ar: 'الاثنين', en: 'Mon' },
  { ar: 'الثلاثاء', en: 'Tue' },
  { ar: 'الأربعاء', en: 'Wed' },
  { ar: 'الخميس', en: 'Thu' },
  { ar: 'الجمعة', en: 'Fri' },
  { ar: 'السبت', en: 'Sat' },
];

// ---------- Small helpers ----------

const niceCeil = (max: number) => {
  const pow = 10 ** Math.floor(Math.log10(Math.max(max, 1)));
  const n = max / pow;
  // finer steps than 1 / 2 / 5 / 10, so a peak of 2,440 gets a 2,500 axis instead of 5,000
  const nice = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((step) => n <= step) ?? 10;
  return nice * pow;
};

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** The arguments every analytics function takes, built from the filter state. */
const filterArgs = (f: Filters) => ({
  p_source: f.source,
  p_product: f.product,
  p_kind: f.kind,
  p_plan: f.plan,
  p_zone: f.zone,
  p_station: f.station,
  p_advance: f.advance,
});

const parseT = (t: string) => new Date(`${t}:00Z`); // the value is already Cairo wall-clock time

type DeltaProps = { cur: number; prev: number; mode: 'rel' | 'pp'; isAr: boolean; locale: string };

/** Up / down arrow against the previous period. */
function Delta({ cur, prev, mode, isAr, locale }: DeltaProps) {
  let direction: 'up' | 'down' | 'flat' = 'flat';
  let text = '—';

  if (mode === 'rel') {
    if (prev === 0 && cur > 0) {
      direction = 'up';
      text = isAr ? 'جديد' : 'New';
    } else if (prev > 0) {
      const change = ((cur - prev) / prev) * 100;
      if (Math.abs(change) >= 0.05) {
        direction = change > 0 ? 'up' : 'down';
        text = `${num(Number(Math.abs(change).toFixed(1)), locale)}%`;
      }
    }
  } else {
    const diff = cur - prev;
    if (Math.abs(diff) >= 0.05) {
      direction = diff > 0 ? 'up' : 'down';
      text = `${num(Number(Math.abs(diff).toFixed(1)), locale)} ${isAr ? 'نقطة' : 'pt'}`;
    }
  }

  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–';
  return (
    <span className={`an-delta ${direction}`}>
      {arrow} {text}
    </span>
  );
}

/** A tiny trend line under a KPI number. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 100;
  const H = 28;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 2 - (v / max) * (H - 4)).toFixed(1)}`);
  return (
    <svg className="an-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" className="an-spark-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

type ChartPoint = { label: string; full: string; value: number; prev?: number };

/** The main zigzag line chart: current period, dashed previous period, peak marker, hover tooltip. */
function LineChart({
  points,
  format,
  locale,
  isAr,
}: {
  points: ChartPoint[];
  format: (n: number) => string;
  locale: string;
  isAr: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const W = 720;
  const H = 270;
  const padL = 52;
  const padR = 14;
  const padT = 18;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = points.length;

  if (n === 0) return <p className="an-empty">{isAr ? 'مفيش بيانات في الفترة دي.' : 'No data in this period.'}</p>;

  const hasPrev = points.some((p) => p.prev !== undefined);
  const max = niceCeil(Math.max(1, ...points.map((p) => Math.max(p.value, p.prev ?? 0))));
  const x = (i: number) => (n <= 1 ? padL + innerW / 2 : padL + (i * innerW) / (n - 1));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const base = padT + innerH;

  const path = (get: (p: ChartPoint) => number) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ');

  const line = path((p) => p.value);
  const prevLine = hasPrev ? path((p) => p.prev ?? 0) : '';
  const area = `${line} L${x(n - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;

  let peak = 0;
  points.forEach((p, i) => {
    if (p.value > points[peak].value) peak = i;
  });

  const step = Math.max(1, Math.ceil(n / 8));
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = n <= 1 ? 0 : Math.round(((px - padL) / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };

  const hp = hover !== null ? points[hover] : null;
  const xPct = hover !== null ? (x(hover) / W) * 100 : 0;
  const shift = xPct < 18 ? '0%' : xPct > 82 ? '-100%' : '-50%';
  const change = hp && hp.prev !== undefined && hp.prev > 0 ? ((hp.value - hp.prev) / hp.prev) * 100 : null;

  return (
    <div
      className="an-line-wrap"
      ref={box}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
      onPointerDown={onMove}
    >
      <svg className="an-line-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={isAr ? 'رسم خطي' : 'Line chart'}>
        <defs>
          <linearGradient id="an-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="an-area-top" />
            <stop offset="100%" className="an-area-bottom" />
          </linearGradient>
        </defs>

        {ticks.map((tk) => {
          const yy = padT + innerH - tk * innerH;
          return (
            <g key={tk}>
              <line x1={padL} x2={W - padR} y1={yy} y2={yy} className="an-grid" />
              <text x={padL - 8} y={yy + 4} textAnchor="end" className="an-axis">
                {num(Math.round(max * tk), locale)}
              </text>
            </g>
          );
        })}

        {points.map((p, i) =>
          i % step === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="an-axis">
              {p.label}
            </text>
          ) : null,
        )}

        <path d={area} fill="url(#an-area-grad)" />
        {hasPrev && <path d={prevLine} className="an-line-prev" fill="none" />}
        <path d={line} className="an-line-main" fill="none" />

        {n <= 60 &&
          points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.value)} r={i === peak ? 5 : 2.6} className={i === peak ? 'an-pt-peak' : 'an-pt'} />
          ))}

        {points[peak].value > 0 && (
          <text x={x(peak)} y={Math.max(12, y(points[peak].value) - 10)} textAnchor="middle" className="an-peak-label">
            {format(points[peak].value)}
          </text>
        )}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={base} className="an-guide" />
            <circle cx={x(hover)} cy={y(points[hover].value)} r={5.5} className="an-pt-hover" />
          </g>
        )}
      </svg>

      {hp && (
        <div className="an-tip" style={{ left: `${xPct}%`, transform: `translateX(${shift})` }}>
          <b>{hp.full}</b>
          <span>{format(hp.value)}</span>
          {hp.prev !== undefined && (
            <small>
              {isAr ? 'الفترة السابقة' : 'Previous'}: {format(hp.prev)}
              {change !== null && ` (${change >= 0 ? '▲' : '▼'} ${num(Number(Math.abs(change).toFixed(1)), locale)}%)`}
            </small>
          )}
        </div>
      )}
    </div>
  );
}

type BarItem = { label: string; value: number; title: string; highlight?: boolean };

/** Simple vertical bar chart drawn with SVG. */
function Bars({ items, locale, labelEvery = 1 }: { items: BarItem[]; locale: string; labelEvery?: number }) {
  const W = 640;
  const H = 220;
  const padL = 40;
  const padR = 8;
  const padT = 10;
  const padB = 28;
  const max = niceCeil(Math.max(1, ...items.map((i) => i.value)));
  const bw = (W - padL - padR) / items.length;
  const innerH = H - padT - padB;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg className="an-svg" viewBox={`0 0 ${W} ${H}`} role="img">
      {ticks.map((t) => {
        const yy = padT + innerH - t * innerH;
        return (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={yy} y2={yy} className="an-grid" />
            <text x={padL - 6} y={yy + 4} textAnchor="end" className="an-axis">
              {num(Math.round(max * t), locale)}
            </text>
          </g>
        );
      })}
      {items.map((item, i) => {
        const h = (item.value / max) * innerH;
        const xx = padL + i * bw + bw * 0.14;
        return (
          <g key={i}>
            <rect
              x={xx}
              y={padT + innerH - h}
              width={bw * 0.72}
              height={Math.max(h, item.value > 0 ? 1 : 0)}
              rx={3}
              className={item.highlight ? 'an-bar peak' : 'an-bar'}
            >
              <title>{item.title}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={xx + bw * 0.36} y={H - 8} textAnchor="middle" className="an-axis">
                {item.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

type RankItem = { label: string; value: number; sub?: string };

function RankList({ items, locale, empty }: { items: RankItem[]; locale: string; empty: string }) {
  if (items.length === 0 || items.every((i) => i.value === 0)) return <p className="an-empty">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="an-rank">
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`}>
          <div className="an-rank-top">
            <span className="an-rank-label">{item.label}</span>
            <strong>{num(item.value, locale)}</strong>
          </div>
          <div className="an-rank-track">
            <span style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          {item.sub && <small>{item.sub}</small>}
        </li>
      ))}
    </ul>
  );
}

// ---------- The panel ----------

export default function AnalyticsPanel() {
  const { lang, locale } = useLanguage();
  const isAr = lang === 'ar';
  const tx = (ar: string, en: string) => (isAr ? ar : en);

  const [days, setDays] = useState(7);
  const [bucketPref, setBucketPref] = useState<Bucket>('day');
  const [metric, setMetric] = useState<Metric>('revenue');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [top, setTop] = useState<Top | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // Hourly points only make sense for up to 7 days; the database falls back to days beyond that.
  const bucket: Bucket = days > 7 && bucketPref === 'hour' ? 'day' : bucketPref;

  const load = useCallback(async () => {
    if (!supabase) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setRefreshing(true);
    const args = filterArgs(filters);
    const [a, b, c] = await Promise.all([
      supabase.rpc('analytics_overview', { p_days: days, ...args }),
      supabase.rpc('analytics_series', { p_days: days, p_bucket: bucket, ...args }),
      supabase.rpc('analytics_top', { p_days: days, ...args }),
    ]);
    setRefreshing(false);
    if (a.error || b.error || c.error) {
      console.error('analytics failed', a.error?.message, b.error?.message, c.error?.message);
      setFailed(true);
      setLoading(false);
      return;
    }
    setOverview(a.data as Overview);
    setSeries(b.data as Series);
    setTop(c.data as Top);
    setFailed(false);
    setUpdatedAt(new Date());
    setLoading(false);
  }, [days, bucket, filters]);

  // Load, then refresh by itself so the numbers follow new bookings.
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const egp = tx('جنيه', 'EGP');
  const money = (n: number) => `${num(n, locale)} ${egp}`;
  const station = (name: string) => getStationName(name, lang);
  const percent = (n: number) => `${num(Number(n.toFixed(1)), locale)}%`;

  const activeCount =
    (filters.product !== 'all' ? 1 : 0) +
    (filters.kind !== 'all' ? 1 : 0) +
    (filters.plan !== 'all' ? 1 : 0) +
    (filters.zone >= 0 ? 1 : 0) +
    (filters.station !== '' ? 1 : 0) +
    (filters.advance !== 'all' ? 1 : 0);

  const dayLabel = (t: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parseT(t));

  const header = (
    <div className="an-head">
      <div>
        <span className="eyebrow green">{tx('التحليلات', 'Analytics')}</span>
        <h2>{tx('أداء الموقع لحظة بلحظة', 'Live site performance')}</h2>
      </div>
      <div className="an-controls">
        <div className="an-seg" role="group" aria-label={tx('الفترة', 'Period')}>
          {PERIODS.map((d) => (
            <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
              {isAr ? `${num(d, locale)} يوم` : `${d}d`}
            </button>
          ))}
        </div>
        <div className="an-seg" role="group" aria-label={tx('نوع البيانات', 'Data type')}>
          {(['all', 'real', 'demo'] as Source[]).map((s) => (
            <button key={s} className={filters.source === s ? 'active' : ''} onClick={() => setFilter('source', s)}>
              {s === 'all' ? tx('الكل', 'All') : s === 'real' ? tx('حقيقية', 'Real') : tx('تجريبية', 'Demo')}
            </button>
          ))}
        </div>
        <button
          className={`an-filter-btn ${filtersOpen ? 'open' : ''}`}
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
        >
          {tx('الفلاتر', 'Filters')}
          {activeCount > 0 && <span className="an-filter-count">{num(activeCount, locale)}</span>}
        </button>
        <button className="an-refresh" onClick={() => void load()} aria-label={tx('تحديث', 'Refresh')}>
          ⟳
        </button>
      </div>
    </div>
  );

  const filterPanel = filtersOpen && (
    <div className="an-filters">
      <label>
        <span>{tx('المنتج', 'Product')}</span>
        <select className="name-input" value={filters.product} onChange={(e) => setFilter('product', e.target.value as Filters['product'])}>
          <option value="all">{tx('الكل', 'All')}</option>
          <option value="tickets">{tx('تذاكر', 'Tickets')}</option>
          <option value="subscriptions">{tx('اشتراكات', 'Subscriptions')}</option>
        </select>
      </label>
      <label>
        <span>{tx('نوع التذكرة', 'Ticket type')}</span>
        <select className="name-input" value={filters.kind} onChange={(e) => setFilter('kind', e.target.value as Filters['kind'])}>
          <option value="all">{tx('الكل', 'All')}</option>
          <option value="full">{KIND_NAMES.full[lang]}</option>
          <option value="half">{KIND_NAMES.half[lang]}</option>
        </select>
      </label>
      <label>
        <span>{tx('الباقة', 'Plan')}</span>
        <select className="name-input" value={filters.plan} onChange={(e) => setFilter('plan', e.target.value as Filters['plan'])}>
          <option value="all">{tx('الكل', 'All')}</option>
          {Object.keys(PLAN_NAMES).map((p) => (
            <option key={p} value={p}>
              {PLAN_NAMES[p][lang]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{tx('المنطقة', 'Zone')}</span>
        <select className="name-input" value={filters.zone} onChange={(e) => setFilter('zone', Number(e.target.value))}>
          <option value={-1}>{tx('الكل', 'All')}</option>
          {ZONE_NAMES.map((z, i) => (
            <option key={i} value={i}>
              {z[lang]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{tx('المحطة (ركوب أو وصول)', 'Station (boarding or arrival)')}</span>
        <select className="name-input" value={filters.station} onChange={(e) => setFilter('station', e.target.value)}>
          <option value="">{tx('كل المحطات', 'All stations')}</option>
          {STATIONS.map((s) => (
            <option key={s} value={s}>
              {station(s)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{tx('الحجز المسبق', 'Advance booking')}</span>
        <select className="name-input" value={filters.advance} onChange={(e) => setFilter('advance', e.target.value as Filters['advance'])}>
          <option value="all">{tx('الكل', 'All')}</option>
          <option value="only">{tx('حجز مسبق فقط', 'Advance only')}</option>
          <option value="none">{tx('من غير حجز مسبق', 'No advance')}</option>
        </select>
      </label>
      <button
        className="outline-button an-reset"
        onClick={() => setFilters((f) => ({ ...DEFAULT_FILTERS, source: f.source }))}
        disabled={activeCount === 0}
      >
        {tx('مسح الفلاتر', 'Clear filters')}
      </button>
    </div>
  );

  if (loading && !overview) {
    return (
      <section className="an-wrap">
        {header}
        <p className="an-empty">{tx('بنحمّل التحليلات…', 'Loading analytics…')}</p>
      </section>
    );
  }

  if (failed || !overview || !series || !top) {
    return (
      <section className="an-wrap">
        {header}
        {filterPanel}
        <p className="an-empty" role="alert">
          {tx(
            'مقدرناش نجيب التحليلات. اتأكد إنك مسجّل بحساب أدمن، وإن ملف analytics_v2.sql اتشغّل على Supabase.',
            'Could not load analytics. Make sure you are signed in as an admin and analytics_v2.sql has been run on Supabase.',
          )}
        </p>
      </section>
    );
  }

  const cur = overview.current;
  const prev = overview.previous;
  const pts = series.points;

  const sparkOf = (get: (p: SeriesPoint) => number) => pts.map(get);

  type Kpi = {
    label: string;
    value: string;
    cur: number;
    prev: number;
    mode: 'rel' | 'pp';
    spark?: number[];
  };

  const kpis: Kpi[] = [
    { label: tx('إجمالي الإيرادات', 'Total revenue'), value: money(cur.revenue), cur: cur.revenue, prev: prev.revenue, mode: 'rel', spark: sparkOf((p) => p.revenue) },
    { label: tx('إيراد التذاكر', 'Ticket revenue'), value: money(cur.ticket_revenue), cur: cur.ticket_revenue, prev: prev.ticket_revenue, mode: 'rel', spark: sparkOf((p) => p.ticket_revenue) },
    { label: tx('إيراد الاشتراكات', 'Subscription revenue'), value: money(cur.subscription_revenue), cur: cur.subscription_revenue, prev: prev.subscription_revenue, mode: 'rel', spark: sparkOf((p) => p.subscription_revenue) },
    { label: tx('التذاكر المباعة', 'Tickets sold'), value: num(cur.tickets, locale), cur: cur.tickets, prev: prev.tickets, mode: 'rel', spark: sparkOf((p) => p.tickets) },
    { label: tx('الركاب', 'Passengers'), value: num(cur.passengers, locale), cur: cur.passengers, prev: prev.passengers, mode: 'rel', spark: sparkOf((p) => p.passengers) },
    { label: tx('اشتراكات جديدة', 'New subscriptions'), value: num(cur.subscriptions, locale), cur: cur.subscriptions, prev: prev.subscriptions, mode: 'rel', spark: sparkOf((p) => p.subscriptions) },
    { label: tx('متوسط سعر التذكرة', 'Average ticket'), value: money(cur.avg_fare), cur: cur.avg_fare, prev: prev.avg_fare, mode: 'rel' },
    { label: tx('متوسط الركاب للتذكرة', 'Passengers per ticket'), value: num(cur.avg_party, locale), cur: cur.avg_party, prev: prev.avg_party, mode: 'rel' },
    { label: tx('إيراد الراكب الواحد', 'Revenue per passenger'), value: money(cur.revenue_per_passenger), cur: cur.revenue_per_passenger, prev: prev.revenue_per_passenger, mode: 'rel' },
    { label: tx('متوسط سعر الاشتراك', 'Average subscription'), value: money(cur.avg_sub_price), cur: cur.avg_sub_price, prev: prev.avg_sub_price, mode: 'rel' },
    { label: tx('مشترون', 'Buyers'), value: num(cur.buyers, locale), cur: cur.buyers, prev: prev.buyers, mode: 'rel' },
    { label: tx('نسبة اللي رجعوا اشتروا', 'Repeat buyers'), value: percent(pct(cur.repeat_buyers, cur.buyers)), cur: pct(cur.repeat_buyers, cur.buyers), prev: pct(prev.repeat_buyers, prev.buyers), mode: 'pp' },
    { label: tx('نسبة إتمام الدفع', 'Payment completion'), value: percent(pct(cur.orders_paid, cur.orders_created)), cur: pct(cur.orders_paid, cur.orders_created), prev: pct(prev.orders_paid, prev.orders_created), mode: 'pp' },
    { label: tx('نسبة الحجز المسبق', 'Advance bookings'), value: percent(pct(cur.advance_tickets, cur.tickets)), cur: pct(cur.advance_tickets, cur.tickets), prev: pct(prev.advance_tickets, prev.tickets), mode: 'pp' },
    { label: tx('متوسط مدة الحجز المسبق (يوم)', 'Avg advance lead (days)'), value: num(cur.avg_lead_days, locale), cur: cur.avg_lead_days, prev: prev.avg_lead_days, mode: 'rel' },
    { label: tx('نسبة نصف التذكرة', 'Half-fare share'), value: percent(pct(cur.half_tickets, cur.tickets)), cur: pct(cur.half_tickets, cur.tickets), prev: pct(prev.half_tickets, prev.tickets), mode: 'pp' },
    { label: tx('نسبة قبول المسح', 'Gate acceptance'), value: percent(pct(cur.scans_ok, cur.scans)), cur: pct(cur.scans_ok, cur.scans), prev: pct(prev.scans_ok, prev.scans), mode: 'pp' },
    { label: tx('مستخدمون جدد', 'New users'), value: num(cur.new_users, locale), cur: cur.new_users, prev: prev.new_users, mode: 'rel' },
  ];

  // ----- main line chart -----
  const metricInfo = METRICS.find((m) => m.id === metric) ?? METRICS[0];
  const format = (n: number) => (metricInfo.money ? money(n) : num(n, locale));

  const pointLabel = (t: string) => {
    if (series.bucket === 'hour') {
      const hour = parseT(t).getUTCHours();
      return hour === 0 ? dayLabel(t) : num(hour, locale);
    }
    return dayLabel(t);
  };
  const pointFull = (t: string) => {
    const d = parseT(t);
    if (series.bucket === 'hour') {
      return `${dayLabel(t)} · ${num(d.getUTCHours(), locale)}:00`;
    }
    if (series.bucket === 'week') {
      return tx(`أسبوع يبدأ ${dayLabel(t)}`, `Week of ${dayLabel(t)}`);
    }
    return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
  };

  const chartPoints: ChartPoint[] = pts.map((p) => ({
    label: pointLabel(p.t),
    full: pointFull(p.t),
    value: p[metric],
    prev: metric === 'revenue' ? p.prev_revenue : metric === 'tickets' ? p.prev_tickets : undefined,
  }));
  const chartTotal = chartPoints.reduce((sum, p) => sum + p.value, 0);

  // ----- other charts -----
  const peakHour = top.by_hour.reduce((best, h) => (h.tickets > best.tickets ? h : best), top.by_hour[0]);
  const hourItems: BarItem[] = top.by_hour.map((h) => ({
    label: num(h.hour, locale),
    value: h.tickets,
    title: `${num(h.hour, locale)}:00 — ${num(h.tickets, locale)} ${tx('تذكرة', 'tickets')} · ${money(h.revenue)}`,
    highlight: peakHour.tickets > 0 && h.hour === peakHour.hour,
  }));

  const weekItems: BarItem[] = WEEK_ORDER.map((dow) => {
    const row = top.by_weekday.find((w) => w.dow === dow);
    const name = WEEKDAYS[dow][lang];
    return {
      label: name,
      value: row?.tickets ?? 0,
      title: `${name} — ${num(row?.tickets ?? 0, locale)} ${tx('تذكرة', 'tickets')} · ${money(row?.revenue ?? 0)}`,
    };
  });
  const maxWeek = Math.max(...weekItems.map((w) => w.value));
  weekItems.forEach((w) => (w.highlight = maxWeek > 0 && w.value === maxWeek));

  const pending = Math.max(0, cur.orders_created - cur.orders_paid - cur.orders_failed);
  const noData = tx('مفيش بيانات في الفترة دي.', 'No data in this period.');

  return (
    <section className="an-wrap">
      {header}
      {filterPanel}

      <div className="an-live">
        <span className={`an-dot-live ${refreshing ? 'busy' : ''}`} aria-hidden="true" />
        <span>
          {tx('بيتحدّث تلقائيًا كل ٣٠ ثانية', 'Refreshes automatically every 30 seconds')}
          {updatedAt && ` · ${tx('آخر تحديث', 'Last update')} ${updatedAt.toLocaleTimeString(locale, { timeZone: 'Africa/Cairo' })}`}
          {' · '}
          {tx('المقارنة مع نفس الطول من الفترة اللي قبلها', 'Compared with the same stretch of the previous period')}
        </span>
      </div>

      <div className="an-kpis">
        {kpis.map((k) => (
          <div className="an-kpi" key={k.label}>
            <small>{k.label}</small>
            <strong>{k.value}</strong>
            <Delta cur={k.cur} prev={k.prev} mode={k.mode} isAr={isAr} locale={locale} />
            {k.spark && <Sparkline values={k.spark} />}
          </div>
        ))}
      </div>

      <div className="an-card an-main-chart">
        <div className="an-chart-head">
          <div>
            <h3>
              {metricInfo[lang]} {tx('عبر الوقت', 'over time')}
            </h3>
            <p className="an-note">
              {tx('الإجمالي في الفترة:', 'Total in the period:')} <strong>{format(chartTotal)}</strong>
              {metric === 'revenue' || metric === 'tickets' ? ` · ${tx('الخط المنقّط = الفترة السابقة', 'dashed = previous period')}` : ''}
            </p>
          </div>
          <div className="an-chart-controls">
            <div className="an-seg" role="group" aria-label={tx('المقياس', 'Metric')}>
              {METRICS.map((m) => (
                <button key={m.id} className={metric === m.id ? 'active' : ''} onClick={() => setMetric(m.id)}>
                  {m[lang]}
                </button>
              ))}
            </div>
            <div className="an-seg" role="group" aria-label={tx('التجميع', 'Group by')}>
              {(['hour', 'day', 'week'] as Bucket[]).map((b) => (
                <button
                  key={b}
                  className={bucket === b ? 'active' : ''}
                  disabled={b === 'hour' && days > 7}
                  onClick={() => setBucketPref(b)}
                >
                  {b === 'hour' ? tx('ساعة', 'Hour') : b === 'day' ? tx('يوم', 'Day') : tx('أسبوع', 'Week')}
                </button>
              ))}
            </div>
          </div>
        </div>
        <LineChart points={chartPoints} format={format} locale={locale} isAr={isAr} />
      </div>

      <div className="an-grid-2">
        <div className="an-card">
          <h3>{tx('قمع الدفع', 'Payment funnel')}</h3>
          {cur.orders_created === 0 ? (
            <p className="an-empty">{noData}</p>
          ) : (
            <>
              <div className="an-funnel" aria-hidden="true">
                <span className="paid" style={{ flexGrow: cur.orders_paid }} />
                <span className="pending" style={{ flexGrow: pending }} />
                <span className="failed" style={{ flexGrow: cur.orders_failed }} />
              </div>
              <ul className="an-legend">
                <li><i className="paid" />{tx('مدفوع', 'Paid')}<strong>{num(cur.orders_paid, locale)}</strong></li>
                <li><i className="pending" />{tx('معلّق / متكمّلش', 'Pending / abandoned')}<strong>{num(pending, locale)}</strong></li>
                <li><i className="failed" />{tx('فاشل', 'Failed')}<strong>{num(cur.orders_failed, locale)}</strong></li>
                <li className="total">{tx('إجمالي الطلبات', 'Total orders')}<strong>{num(cur.orders_created, locale)}</strong></li>
              </ul>
            </>
          )}
        </div>

        <div className="an-card">
          <h3>{tx('حسب المنطقة', 'By zone')}</h3>
          <RankList
            empty={noData}
            locale={locale}
            items={top.zones.map((z) => ({
              label: ZONE_NAMES[z.zone]?.[lang] ?? String(z.zone),
              value: z.tickets,
              sub: `${money(z.revenue)} · ${num(z.passengers, locale)} ${tx('راكب', 'passengers')}`,
            }))}
          />
        </div>
      </div>

      <div className="an-grid-2">
        <div className="an-card">
          <h3>{tx('ساعات الذروة (توقيت القاهرة)', 'Peak hours (Cairo time)')}</h3>
          {peakHour.tickets > 0 && (
            <p className="an-note">
              {tx('أعلى ساعة:', 'Busiest hour:')} <strong>{num(peakHour.hour, locale)}:00</strong>
            </p>
          )}
          <div className="an-chart">
            <Bars items={hourItems} locale={locale} labelEvery={3} />
          </div>
        </div>

        <div className="an-card">
          <h3>{tx('حسب أيام الأسبوع', 'By day of week')}</h3>
          <div className="an-chart">
            <Bars items={weekItems} locale={locale} />
          </div>
        </div>
      </div>

      <div className="an-grid-3">
        <div className="an-card">
          <h3>{tx('أكتر محطات ركوب', 'Top boarding stations')}</h3>
          <RankList empty={noData} locale={locale} items={top.top_origins.map((s) => ({ label: station(s.station), value: s.passengers }))} />
        </div>
        <div className="an-card">
          <h3>{tx('أكتر محطات وصول', 'Top destination stations')}</h3>
          <RankList empty={noData} locale={locale} items={top.top_destinations.map((s) => ({ label: station(s.station), value: s.passengers }))} />
        </div>
        <div className="an-card">
          <h3>{tx('أكتر الخطوط طلبًا', 'Top routes')}</h3>
          <RankList
            empty={noData}
            locale={locale}
            items={top.top_routes.map((r) => ({
              label: `${station(r.from)} ${isAr ? '←' : '→'} ${station(r.to)}`,
              value: r.passengers,
              sub: `${num(r.tickets, locale)} ${tx('تذكرة', 'tickets')}`,
            }))}
          />
        </div>
      </div>

      <div className="an-grid-3">
        <div className="an-card">
          <h3>{tx('كاملة مقابل نصف', 'Full vs half')}</h3>
          <RankList
            empty={noData}
            locale={locale}
            items={top.kinds.map((k) => ({ label: KIND_NAMES[k.kind]?.[lang] ?? k.kind, value: k.tickets, sub: money(k.revenue) }))}
          />
        </div>
        <div className="an-card">
          <h3>{tx('الاشتراكات حسب الباقة', 'Subscriptions by plan')}</h3>
          <RankList
            empty={noData}
            locale={locale}
            items={top.plans.map((p) => ({ label: PLAN_NAMES[p.plan]?.[lang] ?? p.plan, value: p.count, sub: money(p.revenue) }))}
          />
        </div>
        <div className="an-card">
          <h3>{tx('نتيجة المسح عند البوابة', 'Gate scan results')}</h3>
          <RankList
            empty={noData}
            locale={locale}
            items={top.scans.map((s) => ({ label: SCAN_NAMES[s.result]?.[lang] ?? s.result, value: s.count }))}
          />
        </div>
      </div>
    </section>
  );
}
