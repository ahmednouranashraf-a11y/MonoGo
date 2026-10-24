import { useId } from 'react';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { num } from '../lib/format';

export type ChartPoint = { label: string; full: string; value: number; prev?: number };
export type BarItem = { label: string; value: number; title: string; highlight?: boolean };

const tick = { fill: 'var(--muted)', fontSize: 11, fontWeight: 600 };

/* ---------- Line / area chart: current period, dashed previous period, peak marker, hover tooltip ---------- */

type TrendRow = ChartPoint & { i: number };

function TrendTip({
  active,
  payload,
  format,
  locale,
  isAr,
}: {
  active?: boolean;
  payload?: { payload?: TrendRow }[];
  format: (n: number) => string;
  locale: string;
  isAr: boolean;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const change = p.prev !== undefined && p.prev > 0 ? ((p.value - p.prev) / p.prev) * 100 : null;
  return (
    <div className="an-rtip">
      <b>{p.full}</b>
      <span>{format(p.value)}</span>
      {p.prev !== undefined && (
        <small>
          {isAr ? 'الفترة السابقة' : 'Previous'}: {format(p.prev)}
          {change !== null && ` (${change >= 0 ? '▲' : '▼'} ${num(Number(Math.abs(change).toFixed(1)), locale)}%)`}
        </small>
      )}
    </div>
  );
}

export function TrendChart({
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
  const gid = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const n = points.length;
  if (n === 0) return <p className="an-empty">{isAr ? 'مفيش بيانات في الفترة دي.' : 'No data in this period.'}</p>;

  const data: TrendRow[] = points.map((p, i) => ({ ...p, i }));
  const hasPrev = points.some((p) => p.prev !== undefined);

  let peak = 0;
  points.forEach((p, i) => {
    if (p.value > points[peak].value) peak = i;
  });

  const step = Math.max(1, Math.ceil(n / 8));
  const ticks = Array.from({ length: Math.ceil(n / step) }, (_, k) => k * step);

  return (
    <div className="an-chart" dir="ltr">
      <ResponsiveContainer width="100%" height={290}>
        <ComposedChart data={data} margin={{ top: 24, right: 14, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--brand)', stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: 'var(--brand)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
          <XAxis
            dataKey="i"
            type="number"
            domain={[0, Math.max(n - 1, 1)]}
            ticks={ticks}
            tickFormatter={(i: number) => points[i]?.label ?? ''}
            tickLine={false}
            axisLine={false}
            tick={tick}
            padding={{ left: 6, right: 6 }}
          />
          <YAxis width={50} tickCount={5} allowDecimals={false} tickLine={false} axisLine={false} tick={tick} tickFormatter={(v: number) => num(v, locale)} />
          <Tooltip
            cursor={{ stroke: 'var(--brand)', strokeOpacity: 0.35, strokeDasharray: '3 4' }}
            content={(props) => <TrendTip {...(props as unknown as { active?: boolean; payload?: { payload?: TrendRow }[] })} format={format} locale={locale} isAr={isAr} />}
          />
          {hasPrev && (
            <Line type="monotone" dataKey="prev" stroke="var(--muted)" strokeOpacity={0.7} strokeWidth={1.8} strokeDasharray="6 5" dot={false} activeDot={false} isAnimationActive={false} />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--brand)"
            strokeWidth={2.5}
            fill={`url(#${gid})`}
            dot={n <= 60 ? { r: 2.6, fill: 'var(--surface)', stroke: 'var(--brand)', strokeWidth: 1.8 } : false}
            activeDot={{ r: 5.5, fill: 'var(--brand)', stroke: 'var(--surface)', strokeWidth: 2.5 }}
          />
          {points[peak].value > 0 && (
            <ReferenceDot
              x={peak}
              y={points[peak].value}
              r={5}
              fill="var(--accent)"
              stroke="var(--brand)"
              strokeWidth={2.5}
              ifOverflow="visible"
              label={{ value: format(points[peak].value), position: 'top', fill: 'var(--ink)', fontSize: 11, fontWeight: 800 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- Bar chart with the peak bar highlighted ---------- */

export function BarsChart({ items, locale, labelEvery = 1 }: { items: BarItem[]; locale: string; labelEvery?: number }) {
  const data = items.map((it, i) => ({ ...it, i }));
  return (
    <div className="an-chart" dir="ltr">
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }} barCategoryGap="16%">
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
          <XAxis dataKey="label" interval={Math.max(labelEvery - 1, 0)} tickLine={false} axisLine={false} tick={tick} />
          <YAxis width={44} tickCount={5} allowDecimals={false} tickLine={false} axisLine={false} tick={tick} tickFormatter={(v: number) => num(v, locale)} />
          <Tooltip
            cursor={{ fill: 'var(--brand-soft)', fillOpacity: 0.6 }}
            content={(props) => {
              const p = props as unknown as { active?: boolean; payload?: { payload?: BarItem }[] };
              const item = p.payload?.[0]?.payload;
              if (!p.active || !item) return null;
              return (
                <div className="an-rtip">
                  <span>{item.title}</span>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((d) => (
              <Cell
                key={d.i}
                fill={d.highlight ? 'var(--accent)' : 'var(--brand)'}
                stroke={d.highlight ? 'var(--brand)' : 'none'}
                strokeWidth={d.highlight ? 1.5 : 0}
                style={{ fill: d.highlight ? 'var(--accent)' : 'var(--brand)' }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
