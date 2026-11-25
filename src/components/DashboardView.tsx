import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ImagePlus,
} from 'lucide-react';
import { PoikatsuApp, PointTransaction, ActiveTab, DealReminder } from '../types/poikatsu';
import {
  APP_CATEGORY_LABELS,
  REMINDER_KIND_LABELS,
  daysUntil,
  formatPoints,
  formatRate,
  formatYen,
  pointsToYen,
} from '../data/presets';
import { AppIcon } from './AppIcon';
import { ThirtyDayTrendChart } from './ThirtyDayTrendChart';

interface DashboardViewProps {
  apps: PoikatsuApp[];
  transactions: PointTransaction[];
  reminders: DealReminder[];
  monthlyGoalYen: number;
  onNavigate: (tab: ActiveTab) => void;
  onQuickLog: (appId?: string) => void;
  onAddApp: () => void;
  onEditApp: (app: PoikatsuApp) => void;
  onApproveTransaction: (txId: string) => void;
  onToggleReminder: (reminderId: string) => void;
  onFilterLedgerByApp: (appId: string) => void;
}

interface MonthDatum {
  key: string;
  label: string;
  earnedYen: number;
  pendingYen: number;
}

export function DashboardView({
  apps,
  transactions,
  reminders,
  monthlyGoalYen,
  onNavigate,
  onQuickLog,
  onAddApp,
  onEditApp,
  onApproveTransaction,
  onToggleReminder,
  onFilterLedgerByApp,
}: DashboardViewProps) {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const appMap = useMemo(() => {
    const map = new Map<string, PoikatsuApp>();
    apps.forEach((a) => map.set(a.id, a));
    return map;
  }, [apps]);

  const metrics = useMemo(() => {
    let totalConfirmedYen = 0;
    let totalPendingYen = 0;
    let exchangeReadyCount = 0;

    apps.forEach((app) => {
      totalConfirmedYen += pointsToYen(app.confirmedPoints, app.pointsPerYen);
      totalPendingYen += pointsToYen(app.pendingPoints, app.pointsPerYen);
      if (app.confirmedPoints >= app.minExchangePoints) {
        exchangeReadyCount += 1;
      }
    });

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let thisMonthEarnedYen = 0;
    let thisMonthPendingYen = 0;
    let pendingDealCount = 0;

    transactions.forEach((tx) => {
      const app = appMap.get(tx.appId);
      const rate = app?.pointsPerYen ?? 1;
      const yen = pointsToYen(tx.points, rate);
      if (tx.type === 'pending') {
        pendingDealCount += 1;
      }
      if (tx.date.startsWith(currentMonthPrefix)) {
        if (tx.type === 'earned') thisMonthEarnedYen += yen;
        if (tx.type === 'pending') thisMonthPendingYen += yen;
      }
    });

    return {
      totalConfirmedYen,
      totalPendingYen,
      exchangeReadyCount,
      thisMonthEarnedYen,
      thisMonthPendingYen,
      thisMonthTotalYen: thisMonthEarnedYen + thisMonthPendingYen,
      pendingDealCount,
    };
  }, [apps, transactions, appMap]);

  // Last 6 months earnings data
  const monthlySeries = useMemo<MonthDatum[]>(() => {
    const list: MonthDatum[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.getMonth() + 1}月`;
      list.push({ key, label, earnedYen: 0, pendingYen: 0 });
    }
    const byKey = new Map(list.map((m) => [m.key, m]));
    transactions.forEach((tx) => {
      const monthKey = tx.date.slice(0, 7);
      const bucket = byKey.get(monthKey);
      if (!bucket) return;
      const app = appMap.get(tx.appId);
      const yen = pointsToYen(tx.points, app?.pointsPerYen ?? 1);
      if (tx.type === 'earned') bucket.earnedYen += yen;
      if (tx.type === 'pending') bucket.pendingYen += yen;
    });
    return list;
  }, [transactions, appMap]);

  const maxMonthYen = useMemo(() => {
    const peak = Math.max(
      ...monthlySeries.map((m) => m.earnedYen + m.pendingYen),
      monthlyGoalYen,
      1000
    );
    return Math.ceil(peak / 5000) * 5000;
  }, [monthlySeries, monthlyGoalYen]);

  // Sorted apps by confirmed yen value
  const sortedApps = useMemo(() => {
    return [...apps].sort((a, b) => {
      const aYen = pointsToYen(a.confirmedPoints, a.pointsPerYen);
      const bYen = pointsToYen(b.confirmedPoints, b.pointsPerYen);
      return bYen - aYen;
    });
  }, [apps]);

  // Pending deals list
  const pendingDeals = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === 'pending')
      .sort((a, b) => (a.expectedApprovalDate || '9999').localeCompare(b.expectedApprovalDate || '9999'));
  }, [transactions]);

  // Expiring soon apps (within 30 days)
  const expiringApps = useMemo(() => {
    return apps
      .map((app) => ({ app, days: daysUntil(app.expiryDate) }))
      .filter((item): item is { app: PoikatsuApp; days: number } => item.days !== null && item.days <= 30)
      .sort((a, b) => a.days - b.days);
  }, [apps]);

  // Upcoming active deal condition / cancellation reminders
  const upcomingReminders = useMemo(() => {
    return reminders
      .filter((r) => !r.completed)
      .map((r) => ({ reminder: r, days: daysUntil(r.dueDate) }))
      .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
      .slice(0, 3);
  }, [reminders]);

  const goalPct =
    monthlyGoalYen > 0
      ? Math.min(100, Math.round((metrics.thisMonthTotalYen / monthlyGoalYen) * 100))
      : 0;

  return (
    <div className="space-y-8">
      {/* 4-column flat KPI strip */}
      <section
        aria-label="保有ポイント概要"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 overflow-hidden"
      >
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">総保有ポイント（確定・円換算）</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight text-slate-900">
            {formatYen(metrics.totalConfirmedYen)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            登録アプリ {apps.length} 件の合計
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">判定中・獲得予定</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight text-amber-700">
            +{formatYen(metrics.totalPendingYen)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            承認待ち案件 {metrics.pendingDealCount} 件 · 合計見込{' '}
            {formatYen(metrics.totalConfirmedYen + metrics.totalPendingYen)}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">今月の獲得額（確定＋予定）</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight text-slate-900">
            {formatYen(metrics.thisMonthTotalYen)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            確定 {formatYen(metrics.thisMonthEarnedYen)} · 目標達成率 {goalPct}%
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">交換ライン達成アプリ</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums tracking-tight text-emerald-700">
            {metrics.exchangeReadyCount}
            <span className="text-base font-normal text-slate-400"> / {apps.length}</span>
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {expiringApps.length > 0
              ? `期限30日以内 ${expiringApps.length} 件に注意`
              : '直近30日以内の失効予定なし'}
          </p>
        </div>
      </section>

      {/* Poikatsu Apps Visual Gallery with crisp app icons */}
      <section aria-labelledby="section-apps-gallery" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="section-apps-gallery" className="text-base font-semibold text-slate-900">
              登録ポイ活アプリ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              各アプリの保有残高と円換算額 · クリックで履歴絞り込み、アイコン変更は編集から行えます
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={onAddApp}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              アプリ追加
            </button>
            <button
              type="button"
              onClick={() => onNavigate('apps')}
              className="text-xs font-medium text-slate-900 hover:underline flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              すべて管理
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {sortedApps.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <p className="text-sm font-medium text-slate-900">登録されているポイ活アプリがありません</p>
            <p className="text-xs text-slate-500 mt-1">
              モッピーやハピタスなどのプリセット、またはお好きなアイコン画像でアプリを追加できます。
            </p>
            <button
              type="button"
              onClick={onAddApp}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              最初のアプリを追加
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortedApps.map((app) => {
              const confirmedYen = pointsToYen(app.confirmedPoints, app.pointsPerYen);
              const pendingYen = pointsToYen(app.pendingPoints, app.pointsPerYen);
              const exchangePct = Math.min(
                100,
                Math.round((app.confirmedPoints / Math.max(1, app.minExchangePoints)) * 100)
              );
              const isReady = app.confirmedPoints >= app.minExchangePoints;
              const expDays = daysUntil(app.expiryDate);
              const isUrgentExpiry = expDays !== null && expDays <= 30;

              return (
                <div
                  key={app.id}
                  className="group bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start gap-3.5">
                      <button
                        type="button"
                        onClick={() => onFilterLedgerByApp(app.id)}
                        className="shrink-0 cursor-pointer"
                        title={`${app.name}の履歴を表示`}
                      >
                        <AppIcon
                          src={app.iconUrl}
                          name={app.name}
                          brandColor={app.brandColor}
                          size="lg"
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onFilterLedgerByApp(app.id)}
                            className="text-sm font-semibold text-slate-900 hover:underline truncate text-left cursor-pointer"
                          >
                            {app.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditApp(app)}
                            className="p-1 -mr-1 text-slate-400 hover:text-slate-700 rounded transition-colors shrink-0 cursor-pointer"
                            title="アプリ設定・画像変更"
                            aria-label={`${app.name}を編集`}
                          >
                            <ImagePlus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {APP_CATEGORY_LABELS[app.category]} · {formatRate(app.unit, app.pointsPerYen)}
                        </p>
                        <div className="mt-2.5 flex items-baseline justify-between gap-2">
                          <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                            {formatYen(confirmedYen)}
                          </span>
                          <span className="text-xs font-mono tabular-nums text-slate-500 truncate">
                            {formatPoints(app.confirmedPoints, app.unit)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={isReady ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                          {isReady ? '交換ライン達成' : `交換まで ${exchangePct}%`}
                        </span>
                        {pendingYen > 0 ? (
                          <span className="font-mono tabular-nums text-amber-700 font-medium">
                            判定中 +{formatYen(pendingYen)}
                          </span>
                        ) : isUrgentExpiry ? (
                          <span className="font-mono tabular-nums text-red-600 font-medium">
                            期限 あと{expDays}日
                          </span>
                        ) : (
                          <span className="font-mono tabular-nums text-slate-400">
                            最低 {formatPoints(app.minExchangePoints, app.unit)}
                          </span>
                        )}
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${exchangePct}%`,
                            backgroundColor: isReady ? '#16A34A' : app.brandColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onQuickLog(app.id)}
                      className="text-slate-700 hover:text-slate-900 font-medium py-1 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      + ポイント記録
                    </button>
                    <button
                      type="button"
                      onClick={() => onFilterLedgerByApp(app.id)}
                      className="text-slate-400 hover:text-slate-700 py-1 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      履歴を見る
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Past 30 Days Line Chart (Recharts) */}
      <ThirtyDayTrendChart apps={apps} transactions={transactions} />

      {/* Two-column Analytics & Action Panel */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Monthly Earned Trend Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">月別の獲得推移（円換算）</h2>
              <p className="text-xs text-slate-500 mt-0.5">直近6ヶ月の確定獲得と判定中ポイント</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-slate-900 inline-block" />
                確定
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-400 inline-block" />
                判定中
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-t border-dashed border-slate-400 inline-block" />
                目標 {formatYen(monthlyGoalYen)}
              </span>
            </div>
          </div>

          <div className="relative h-56 flex items-end gap-3 sm:gap-5 pt-6 pb-2">
            {/* Goal line */}
            {monthlyGoalYen > 0 && monthlyGoalYen <= maxMonthYen && (
              <div
                className="absolute left-0 right-0 border-t border-dashed border-slate-300 pointer-events-none"
                style={{
                  bottom: `calc(${(monthlyGoalYen / maxMonthYen) * 100}% * 0.82 + 28px)`,
                }}
              />
            )}

            {monthlySeries.map((item) => {
              const total = item.earnedYen + item.pendingYen;
              const earnedPct = (item.earnedYen / maxMonthYen) * 100;
              const pendingPct = (item.pendingYen / maxMonthYen) * 100;
              const isHovered = hoveredMonth === item.key;

              return (
                <div
                  key={item.key}
                  onMouseEnter={() => setHoveredMonth(item.key)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  className="flex-1 h-full flex flex-col items-center justify-end group"
                >
                  <div
                    className={`text-[11px] font-mono tabular-nums mb-1.5 transition-opacity ${
                      isHovered ? 'text-slate-900 font-semibold opacity-100' : 'text-slate-500 opacity-90'
                    }`}
                  >
                    {total > 0 ? formatYen(total) : '¥0'}
                  </div>

                  <div className="w-full max-w-[44px] h-[78%] bg-slate-100/80 rounded-t-md flex flex-col justify-end overflow-hidden">
                    {item.pendingYen > 0 && (
                      <div
                        className="w-full bg-amber-400 transition-all duration-300"
                        style={{ height: `${Math.max(pendingPct, 2)}%` }}
                      />
                    )}
                    {item.earnedYen > 0 && (
                      <div
                        className="w-full bg-slate-900 group-hover:bg-slate-700 transition-all duration-300"
                        style={{ height: `${Math.max(earnedPct, 2)}%` }}
                      />
                    )}
                  </div>

                  <span className="mt-2 text-xs text-slate-600 font-medium tabular-nums">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* App Share Mini Bar */}
          {metrics.totalConfirmedYen > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-medium text-slate-700">アプリ別保有シェア</span>
                <span className="font-mono tabular-nums text-slate-500">
                  合計 {formatYen(metrics.totalConfirmedYen)}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100">
                {sortedApps.map((app) => {
                  const yen = pointsToYen(app.confirmedPoints, app.pointsPerYen);
                  const pct = (yen / metrics.totalConfirmedYen) * 100;
                  if (pct < 0.5) return null;
                  return (
                    <div
                      key={app.id}
                      style={{ width: `${pct}%`, backgroundColor: app.brandColor }}
                      title={`${app.name}: ${formatYen(yen)} (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {sortedApps.slice(0, 5).map((app) => {
                  const yen = pointsToYen(app.confirmedPoints, app.pointsPerYen);
                  const pct = Math.round((yen / metrics.totalConfirmedYen) * 100);
                  return (
                    <div key={app.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <AppIcon
                        src={app.iconUrl}
                        name={app.name}
                        brandColor={app.brandColor}
                        size="xs"
                      />
                      <span className="truncate max-w-[96px]">{app.shortName}</span>
                      <span className="font-mono tabular-nums text-slate-400">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Pending Approvals & Expiry Alerts */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-6">
          {/* Pending Deals */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900">承認待ち・判定中案件</h2>
              <button
                type="button"
                onClick={() => onNavigate('ledger')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                一覧へ
              </button>
            </div>

            {pendingDeals.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-lg">
                現在、判定中の案件はありません。
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingDeals.slice(0, 4).map((tx) => {
                  const app = appMap.get(tx.appId);
                  const yen = pointsToYen(tx.points, app?.pointsPerYen ?? 1);
                  return (
                    <div key={tx.id} className="py-3 first:pt-1 flex items-center gap-3">
                      <AppIcon
                        src={app?.iconUrl}
                        name={app?.name ?? '不明'}
                        brandColor={app?.brandColor}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-900 truncate">{tx.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 tabular-nums">
                          <span>{app?.shortName ?? '不明'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <Clock className="w-3 h-3" />
                            予定 {tx.expectedApprovalDate || '未設定'}
                          </span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold font-mono tabular-nums text-slate-900">
                          +{formatYen(yen)}
                        </p>
                        <button
                          type="button"
                          onClick={() => onApproveTransaction(tx.id)}
                          className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          確定にする
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Condition & Cancellation Reminders */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">条件・解約期限リマインダー</h3>
              <button
                type="button"
                onClick={() => onNavigate('reminders')}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                すべて管理
              </button>
            </div>
            {upcomingReminders.length === 0 ? (
              <p className="text-xs text-slate-500">
                未完了の条件・解約リマインダーはありません。
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingReminders.map(({ reminder, days }) => {
                  const app = appMap.get(reminder.appId);
                  const isUrgent = days !== null && days <= 5;
                  return (
                    <div
                      key={reminder.id}
                      className={`flex items-center justify-between gap-3 py-2 px-3 rounded-lg border ${
                        isUrgent
                          ? 'bg-red-50/70 border-red-200/70'
                          : 'bg-slate-50/70 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AppIcon
                          src={app?.iconUrl}
                          name={app?.name ?? '不明'}
                          brandColor={app?.brandColor}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {reminder.title}
                          </p>
                          <p
                            className={`text-[11px] flex items-center gap-1 tabular-nums ${
                              isUrgent ? 'text-red-700 font-medium' : 'text-slate-500'
                            }`}
                          >
                            <span>{REMINDER_KIND_LABELS[reminder.kind]}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {days !== null
                                ? days < 0
                                  ? `${Math.abs(days)}日超過`
                                  : days === 0
                                    ? '本日締切'
                                    : `あと${days}日`
                                : reminder.dueDate}
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleReminder(reminder.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        完了
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expiry Warnings */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">ポイント有効期限アラート</h3>
            {expiringApps.length === 0 ? (
              <p className="text-xs text-slate-500">
                30日以内に失効予定のポイントはありません。
              </p>
            ) : (
              <div className="space-y-2.5">
                {expiringApps.map(({ app, days }) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-red-50/70 border border-red-200/70"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AppIcon
                        src={app.iconUrl}
                        name={app.name}
                        brandColor={app.brandColor}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{app.name}</p>
                        <p className="text-[11px] text-red-700 flex items-center gap-1 font-medium tabular-nums">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {days <= 0 ? '期限切れ' : `あと${days}日（${app.expiryDate}）`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickLog(app.id)}
                      className="text-xs font-medium text-slate-900 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      交換・更新
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
