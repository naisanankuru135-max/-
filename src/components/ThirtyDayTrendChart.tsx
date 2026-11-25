import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { PoikatsuApp, PointTransaction } from '../types/poikatsu';
import { formatYen, pointsToYen } from '../data/presets';

interface ThirtyDayTrendChartProps {
  apps: PoikatsuApp[];
  transactions: PointTransaction[];
}

interface DailyPoint {
  dateKey: string; // YYYY-MM-DD
  label: string; // M/D
  earnedYen: number;
  pendingYen: number;
  totalYen: number;
  cumEarnedYen: number;
  cumTotalYen: number;
  dealTitles: string[];
}

type ChartMode = 'daily' | 'cumulative';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DailyPoint }>;
  mode: ChartMode;
}

function CustomTooltip({ active, payload, mode }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-sm text-xs max-w-[240px]">
      <p className="font-mono tabular-nums font-semibold text-slate-900 mb-1.5">
        {d.dateKey.replace(/-/g, '/')}
      </p>

      {mode === 'daily' ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">確定獲得</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {formatYen(d.earnedYen)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">判定中（予定）</span>
            <span className="font-mono tabular-nums font-semibold text-amber-700">
              {formatYen(d.pendingYen)}
            </span>
          </div>
          <div className="pt-1 mt-1 border-t border-slate-100 flex items-center justify-between gap-4">
            <span className="text-slate-600 font-medium">当日合計</span>
            <span className="font-mono tabular-nums font-bold text-slate-900">
              {formatYen(d.totalYen)}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">確定累計</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {formatYen(d.cumEarnedYen)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500">判定中含む累計</span>
            <span className="font-mono tabular-nums font-semibold text-amber-700">
              {formatYen(d.cumTotalYen)}
            </span>
          </div>
        </div>
      )}

      {d.dealTitles.length > 0 && (
        <div className="mt-2 pt-1.5 border-t border-slate-100 space-y-0.5">
          {d.dealTitles.slice(0, 3).map((title, idx) => (
            <p key={idx} className="text-[11px] text-slate-500 truncate">
              · {title}
            </p>
          ))}
          {d.dealTitles.length > 3 && (
            <p className="text-[11px] text-slate-400">ほか {d.dealTitles.length - 3} 件</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatYAxisTick(value: number): string {
  if (value === 0) return '¥0';
  if (value >= 10000) {
    const man = value / 10000;
    return `¥${Number.isInteger(man) ? man : man.toFixed(1)}万`;
  }
  return `¥${value.toLocaleString('ja-JP')}`;
}

export function ThirtyDayTrendChart({ apps, transactions }: ThirtyDayTrendChartProps) {
  const [mode, setMode] = useState<ChartMode>('daily');

  const { series, sumEarned30d, sumPending30d, activeDaysCount } = useMemo(() => {
    const appRateMap = new Map<string, number>();
    apps.forEach((a) => appRateMap.set(a.id, a.pointsPerYen));

    const buckets: DailyPoint[] = [];
    const byDate = new Map<string, DailyPoint>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateKey = formatDateLocal(d);
      const point: DailyPoint = {
        dateKey,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        earnedYen: 0,
        pendingYen: 0,
        totalYen: 0,
        cumEarnedYen: 0,
        cumTotalYen: 0,
        dealTitles: [],
      };
      buckets.push(point);
      byDate.set(dateKey, point);
    }

    transactions.forEach((tx) => {
      if (tx.type === 'exchanged') return;
      const bucket = byDate.get(tx.date);
      if (!bucket) return;
      const yen = pointsToYen(tx.points, appRateMap.get(tx.appId) ?? 1);
      if (tx.type === 'earned') {
        bucket.earnedYen += yen;
      } else if (tx.type === 'pending') {
        bucket.pendingYen += yen;
      }
      bucket.totalYen = bucket.earnedYen + bucket.pendingYen;
      bucket.dealTitles.push(tx.title);
    });

    let runningEarned = 0;
    let runningTotal = 0;
    let activeDays = 0;

    buckets.forEach((b) => {
      runningEarned += b.earnedYen;
      runningTotal += b.totalYen;
      b.cumEarnedYen = runningEarned;
      b.cumTotalYen = runningTotal;
      if (b.totalYen > 0) activeDays += 1;
    });

    return {
      series: buckets,
      sumEarned30d: runningEarned,
      sumPending30d: runningTotal - runningEarned,
      activeDaysCount: activeDays,
    };
  }, [apps, transactions]);

  const dailyAverageYen = Math.round((sumEarned30d + sumPending30d) / 30);

  return (
    <section
      aria-labelledby="section-30d-trend"
      className="bg-white border border-slate-200 rounded-xl p-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h2 id="section-30d-trend" className="text-base font-semibold text-slate-900">
            過去30日間のポイント獲得推移（円換算）
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums">
            <span>
              30日確定 <strong className="font-mono text-slate-900">{formatYen(sumEarned30d)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              判定中 <strong className="font-mono text-amber-700">+{formatYen(sumPending30d)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              1日平均 <strong className="font-mono text-slate-900">{formatYen(dailyAverageYen)}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>獲得日数 {activeDaysCount}日</span>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-slate-900 inline-block rounded-full" />
              {mode === 'daily' ? '確定獲得' : '確定累計'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500 inline-block" />
              {mode === 'daily' ? '判定中含む合計' : '判定中含む累計'}
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('daily')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'daily'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              日別推移
            </button>
            <button
              type="button"
              onClick={() => setMode('cumulative')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'cumulative'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30日累計
            </button>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
              minTickGap={24}
              dy={6}
            />
            <YAxis
              tickFormatter={formatYAxisTick}
              tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              content={<CustomTooltip mode={mode} />}
              cursor={{ stroke: '#CBD5E1', strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey={mode === 'daily' ? 'totalYen' : 'cumTotalYen'}
              name={mode === 'daily' ? '判定中含む合計' : '判定中含む累計'}
              stroke="#D97706"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 4, fill: '#D97706', stroke: '#FFFFFF', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={mode === 'daily' ? 'earnedYen' : 'cumEarnedYen'}
              name={mode === 'daily' ? '確定獲得' : '確定累計'}
              stroke="#0F172A"
              strokeWidth={2.25}
              dot={mode === 'daily' ? { r: 2.5, fill: '#0F172A', strokeWidth: 0 } : false}
              activeDot={{ r: 5, fill: '#0F172A', stroke: '#FFFFFF', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
