import { ArrowDownRight, ArrowUpRight, CreditCard, Search, Ticket, Users, Wallet } from 'lucide-react';
import { motion, MotionConfig } from 'framer-motion';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLanguage } from '../i18n/LanguageContext';
import type { DbProfile, DbSubscription, DbTicket } from '../lib/db';
import { formatDateTime, num } from '../lib/format';
import { planLabel, zoneLabel } from '../lib/ticketing';
import '../styles/admin-dash.css';
import { getStationName } from './StationPicker';

type Data = { users: DbProfile[]; tickets: DbTicket[]; subscriptions: DbSubscription[] };

const DAY = 86_400_000;
const DAYS = 14;

/* ---------- small helpers ---------- */

/** Sum values into one bucket per day, oldest first, ending today. */
function bucket(rows: [string | undefined, number][], now: number): number[] {
  const out = new Array<number>(DAYS).fill(0);
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  for (const [at, v] of rows) {
    if (!at) continue;
    const diff = startOfToday - new Date(at).getTime();
    const idx = diff <= 0 ? DAYS - 1 : DAYS - 1 - Math.ceil(diff / DAY);
    if (idx >= 0 && idx < DAYS) out[idx] += v;
  }
  return out;
}

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

/** Change between the last 7 days and the 7 days before. */
function delta(series: number[]): { pct: number | null; up: boolean } | null {
  const cur = sum(series.slice(DAYS / 2));
  const prev = sum(series.slice(0, DAYS / 2));
  if (cur === 0 && prev === 0) return null;
  if (prev === 0) return { pct: null, up: true };
  return { pct: ((cur - prev) / prev) * 100, up: cur >= prev };
}

const smooth = (xs: number[], ys: number[]) =>
  xs
    .map((x, i) =>
      i === 0
        ? `M${x},${ys[i]}`
        : `C${(xs[i - 1] + x) / 2},${ys[i - 1]} ${(xs[i - 1] + x) / 2},${ys[i]} ${x},${ys[i]}`,
    )
    .join(' ');

const Icons = {
  revenue: <Wallet size={20} strokeWidth={1.8} />,
  ticket: <Ticket size={20} strokeWidth={1.8} />,
  card: <CreditCard size={20} strokeWidth={1.8} />,
  users: <Users size={20} strokeWidth={1.8} />,
};

/* ---------- KPI card ---------- */

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const xs = values.map((_, i) => (i * 100) / (values.length - 1));
  const ys = values.map((v) => 30 - (v / max) * 26);
  return (
    <svg className="adm-spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
      <path d={smooth(xs, ys)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({
  label,
  value,
  unit,
  icon,
  series,
  change,
  sub,
  featured,
  locale,
  isAr,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: ReactNode;
  series?: number[];
  change?: ReturnType<typeof delta>;
  sub?: string;
  featured?: boolean;
  locale: string;
  isAr: boolean;
}) {
  return (
    <motion.div className={`adm-kpi${featured ? ' adm-kpi--featured' : ''}`} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 320, damping: 22 }}>
      <div className="adm-kpi__top">
        <span className="adm-kpi__icon">{icon}</span>
        {change && (
          <span className={`adm-delta ${change.up ? 'up' : 'down'}`} title={isAr ? 'آخر ٧ أيام مقارنة بالـ٧ قبلها' : 'Last 7 days vs the 7 before'}>
            {change.up ? <ArrowUpRight size={13} strokeWidth={2.4} /> : <ArrowDownRight size={13} strokeWidth={2.4} />}
            {change.pct === null ? (isAr ? 'جديد' : 'New') : `${num(Math.round(Math.abs(change.pct)), locale)}%`}
          </span>
        )}
      </div>
      <div>
        <div className="adm-kpi__label">{label}</div>
        <div className="adm-kpi__value">
          {value}
          {unit && <small>{unit}</small>}
        </div>
      </div>
      <div className="adm-kpi__foot">
        {sub ? <span className="adm-kpi__sub">{sub}</span> : <span />}
        {series && <Sparkline values={series} />}
      </div>
    </motion.div>
  );
}

/* ---------- Charts (recharts) ---------- */

function ChartTip({
  active,
  payload,
  fmt,
}: {
  active?: boolean;
  payload?: { value?: number; payload?: { label: string } }[];
  fmt: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="adm-tip">
      <strong>{fmt(payload[0].value ?? 0)}</strong>
      <span>{payload[0].payload?.label}</span>
    </div>
  );
}

function TrendChart({ values, labels, fmt }: { values: number[]; labels: string[]; fmt: (n: number) => string }) {
  const gid = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const data = labels.map((label, i) => ({ label, value: values[i] }));
  return (
    <div className="adm-chart" dir="ltr">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--brand)', stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: 'var(--brand)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} minTickGap={28} />
          <YAxis width={44} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(v: number) => fmt(v).replace(/\s.*$/, '')} />
          <Tooltip content={<ChartTip fmt={fmt} />} cursor={{ stroke: 'var(--brand)', strokeOpacity: 0.35, strokeDasharray: '3 4' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--brand)"
            strokeWidth={2.5}
            fill={`url(#${gid})`}
            activeDot={{ r: 5, strokeWidth: 2.5, stroke: 'var(--brand)', fill: 'var(--surface)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlanDonut({ parts, center, caption }: { parts: { label: string; value: number; color: string }[]; center: string; caption: string }) {
  return (
    <div className="adm-donut" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={parts} dataKey="value" nameKey="label" innerRadius={56} outerRadius={78} paddingAngle={3} cornerRadius={4} stroke="none" startAngle={90} endAngle={-270}>
            {parts.map((p) => (
              <Cell key={p.label} fill={p.color} style={{ fill: p.color }} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="adm-donut__center">
        <strong>{center}</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}

/* ---------- Main ---------- */

export default function AdminOverview({ data }: { data: Data }) {
  const { t, locale, lang } = useLanguage();
  const isAr = lang === 'ar';
  const tx = (ar: string, en: string) => (isAr ? ar : en);
  const [now] = useState(() => Date.now());
  const [metric, setMetric] = useState<'tickets' | 'revenue'>('tickets');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'ended'>('all');

  const subCreated = (s: DbSubscription) => (s as DbSubscription & { created_at?: string }).created_at;

  const ticketRevenue = data.tickets.reduce((s, tk) => s + tk.fare, 0);
  const subscriptionRevenue = data.subscriptions.reduce((s, x) => s + x.fare, 0);
  const revenue = ticketRevenue + subscriptionRevenue;

  const subStatus = (s: DbSubscription): 'active' | 'noTrips' | 'expired' =>
    new Date(s.expires_at).getTime() <= now ? 'expired' : s.trips_total - s.trips_used <= 0 ? 'noTrips' : 'active';
  const activeSubs = data.subscriptions.filter((s) => subStatus(s) === 'active').length;

  const series = useMemo(() => {
    const ticketsPerDay = bucket(data.tickets.map((tk) => [tk.created_at, 1]), now);
    const revenuePerDay = bucket(
      [
        ...data.tickets.map((tk): [string | undefined, number] => [tk.created_at, tk.fare]),
        ...data.subscriptions.map((s): [string | undefined, number] => [subCreated(s), s.fare]),
      ],
      now,
    );
    const usersPerDay = bucket(data.users.map((u) => [u.created_at, 1]), now);
    return { ticketsPerDay, revenuePerDay, usersPerDay };
  }, [data, now]);

  const dayLabels = useMemo(() => {
    const start = new Date(now).setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS }, (_, i) =>
      new Date(start - (DAYS - 1 - i) * DAY).toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
    );
  }, [now, locale]);

  const planName = (p: string) => (isAr ? planLabel(p as never) : p === 'weekly' ? 'Weekly' : p === 'monthly' ? 'Monthly' : 'Quarterly');
  const zoneName = (z: number) =>
    isAr ? zoneLabel(z as never) : ['One zone', 'Two zones', 'Three zones', 'Four zones'][z] ?? `${z + 1} zones`;

  const planParts = (['weekly', 'monthly', 'quarterly'] as const).map((p, i) => ({
    label: planName(p),
    value: data.subscriptions.filter((s) => s.plan === p).length,
    color: ['var(--brand)', 'var(--accent)', 'color-mix(in srgb, var(--brand) 40%, white)'][i],
  }));

  const topStations = useMemo(() => {
    const counts = new Map<string, number>();
    data.tickets.forEach((tk) => counts.set(tk.to_station, (counts.get(tk.to_station) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data.tickets]);
  const topMax = topStations[0]?.[1] ?? 1;

  const rows = data.subscriptions
    .filter((s) => {
      const st = subStatus(s);
      if (filter === 'active' && st !== 'active') return false;
      if (filter === 'ended' && st === 'active') return false;
      return s.holder_name.toLowerCase().includes(query.trim().toLowerCase());
    })
    .slice(0, 15);

  const chartValues = metric === 'tickets' ? series.ticketsPerDay : series.revenuePerDay;
  const fmtMetric = (n: number) => (metric === 'revenue' ? `${num(n, locale)} ${t('common.egp')}` : num(n, locale));

  return (
    <MotionConfig reducedMotion="user">
    <div className="adm">
      {/* KPIs */}
      <div className="adm-kpis">
        <Kpi featured locale={locale} isAr={isAr} icon={Icons.revenue} label={t('admin.statRevenue')} value={num(revenue, locale)} unit={t('common.egp')} series={series.revenuePerDay} change={delta(series.revenuePerDay)} />
        <Kpi locale={locale} isAr={isAr} icon={Icons.ticket} label={t('admin.statTickets')} value={num(data.tickets.length, locale)} series={series.ticketsPerDay} change={delta(series.ticketsPerDay)} />
        <Kpi locale={locale} isAr={isAr} icon={Icons.card} label={t('admin.statActiveSubs')} value={num(activeSubs, locale)} sub={tx(`من ${num(data.subscriptions.length, locale)} اشتراك`, `of ${num(data.subscriptions.length, locale)} total`)} />
        <Kpi locale={locale} isAr={isAr} icon={Icons.users} label={t('admin.statUsers')} value={num(data.users.length, locale)} series={series.usersPerDay} change={delta(series.usersPerDay)} />
      </div>

      {/* Chart + donut */}
      <div className="adm-row">
        <section className="adm-card">
          <div className="adm-card-head">
            <div>
              <h3>{metric === 'tickets' ? tx('التذاكر المباعة', 'Tickets sold') : tx('الإيرادات', 'Revenue')}</h3>
              <div className="adm-sub">{tx('آخر ١٤ يوم', 'Last 14 days')}</div>
            </div>
            <div className="adm-seg" role="group">
              <button className={metric === 'tickets' ? 'on' : ''} onClick={() => setMetric('tickets')}>
                {tx('التذاكر', 'Tickets')}
              </button>
              <button className={metric === 'revenue' ? 'on' : ''} onClick={() => setMetric('revenue')}>
                {tx('الإيراد', 'Revenue')}
              </button>
            </div>
          </div>
          <TrendChart values={chartValues} labels={dayLabels} fmt={fmtMetric} />
        </section>

        <section className="adm-card">
          <div className="adm-card-head">
            <div>
              <h3>{tx('أنواع الاشتراكات', 'Subscription plans')}</h3>
              <div className="adm-sub">{tx('توزيع كل الاشتراكات', 'All subscriptions')}</div>
            </div>
          </div>
          {data.subscriptions.length === 0 ? (
            <p className="adm-empty">{t('admin.noSubs')}</p>
          ) : (
            <>
              <PlanDonut parts={planParts} center={num(data.subscriptions.length, locale)} caption={tx('اشتراك', 'total')} />
              <ul className="adm-legend">
                {planParts.map((p) => (
                  <li key={p.label}>
                    <i style={{ background: p.color }} />
                    <span>{p.label}</span>
                    <strong>{num(p.value, locale)}</strong>
                    <small>{num(Math.round((p.value / data.subscriptions.length) * 100), locale)}%</small>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* Top stations + users */}
      <div className="adm-row adm-row--even">
        <section className="adm-card">
          <div className="adm-card-head">
            <div>
              <h3>{tx('أكتر المحطات طلبًا', 'Most requested stations')}</h3>
              <div className="adm-sub">{tx('حسب محطة الوصول', 'By destination')}</div>
            </div>
          </div>
          {topStations.length === 0 ? (
            <p className="adm-empty">—</p>
          ) : (
            <ol className="adm-bars">
              {topStations.map(([station, count]) => (
                <li key={station}>
                  <div>
                    <span>{getStationName(station, lang)}</span>
                    <strong>{num(count, locale)}</strong>
                  </div>
                  <div className="adm-bar">
                    <motion.i initial={{ width: 0 }} animate={{ width: `${(count / topMax) * 100}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="adm-card">
          <div className="adm-card-head">
            <h3>{t('admin.statUsers')}</h3>
          </div>
          <ul className="adm-users">
            {data.users.slice(0, 6).map((u) => (
              <li key={u.id}>
                <span className="adm-avatar">{(u.full_name || '?').trim().charAt(0).toUpperCase()}</span>
                <div>
                  <strong>{u.full_name || t('admin.noName')}</strong>
                  <small>{formatDateTime(u.created_at, locale)}</small>
                </div>
                <span className={`adm-chip ${u.role === 'admin' ? 'admin' : 'muted'}`}>{u.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser')}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Subscriptions table */}
      <section className="adm-card">
        <div className="adm-card-head">
          <h3>{t('admin.latestSubs', { n: num(data.subscriptions.length, locale) })}</h3>
          <div className="adm-tools">
            <label className="adm-searchbox">
              <Search size={15} aria-hidden="true" />
              <input className="adm-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx('ابحث باسم صاحب الاشتراك', 'Search by holder name')} aria-label={tx('بحث', 'Search')} />
            </label>
            <div className="adm-seg" role="group">
              {(['all', 'active', 'ended'] as const).map((f) => (
                <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                  {f === 'all' ? tx('الكل', 'All') : f === 'active' ? tx('نشط', 'Active') : tx('منتهي', 'Ended')}
                </button>
              ))}
            </div>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="adm-empty">{data.subscriptions.length === 0 ? t('admin.noSubs') : tx('مفيش نتايج بالفلتر ده.', 'No results for this filter.')}</p>
        ) : (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{t('admin.colHolder')}</th>
                  <th>{t('admin.colPlan')}</th>
                  <th>{t('admin.colZone')}</th>
                  <th>{t('admin.colTrips')}</th>
                  <th>{t('admin.colPrice')}</th>
                  <th>{t('admin.colExpires')}</th>
                  <th>{t('admin.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const left = Math.max(s.trips_total - s.trips_used, 0);
                  const st = subStatus(s);
                  return (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.holder_name}</strong>
                      </td>
                      <td>{planName(s.plan)}</td>
                      <td>{zoneName(s.zone)}</td>
                      <td>{t('admin.tripsLeft', { left: num(left, locale), total: num(s.trips_total, locale) })}</td>
                      <td>{num(s.fare, locale)}</td>
                      <td>{formatDateTime(s.expires_at, locale)}</td>
                      <td>
                        <span className={`adm-chip ${st}`}>{st === 'expired' ? t('admin.statusExpired') : st === 'noTrips' ? t('admin.statusNoTrips') : t('admin.statusActive')}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tickets table */}
      <section className="adm-card">
        <div className="adm-card-head">
          <h3>{t('admin.latestTickets')}</h3>
        </div>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>{t('admin.colRider')}</th>
                <th>{t('admin.colTrip')}</th>
                <th>{t('admin.colPrice')}</th>
                <th>{t('admin.colTime')}</th>
              </tr>
            </thead>
            <tbody>
              {data.tickets.slice(0, 15).map((tk) => (
                <tr key={tk.id}>
                  <td>
                    <strong>{tk.rider_name}</strong>
                  </td>
                  <td>
                    {getStationName(tk.from_station, lang)} {isAr ? '←' : '→'} {getStationName(tk.to_station, lang)}
                  </td>
                  <td>{num(tk.fare, locale)}</td>
                  <td>{formatDateTime(tk.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </MotionConfig>
  );
}
