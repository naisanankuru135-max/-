import { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  ExternalLink,
  Pencil,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { AppCategory, PoikatsuApp } from '../types/poikatsu';
import {
  APP_CATEGORY_LABELS,
  daysUntil,
  formatPoints,
  formatRate,
  formatYen,
  pointsToYen,
} from '../data/presets';
import { AppIcon } from './AppIcon';

interface AppsViewProps {
  apps: PoikatsuApp[];
  onAddApp: () => void;
  onEditApp: (app: PoikatsuApp) => void;
  onQuickLog: (appId: string, defaultType?: 'earned' | 'pending' | 'exchanged') => void;
  onViewHistory: (appId: string) => void;
}

type SortKey = 'yen_desc' | 'name_asc' | 'expiry_asc';

export function AppsView({
  apps,
  onAddApp,
  onEditApp,
  onQuickLog,
  onViewHistory,
}: AppsViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AppCategory>('all');
  const [sortKey, setSortKey] = useState<SortKey>('yen_desc');

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps
      .filter((app) => {
        if (categoryFilter !== 'all' && app.category !== categoryFilter) return false;
        if (q && !app.name.toLowerCase().includes(q) && !(app.memo || '').toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortKey === 'yen_desc') {
          return (
            pointsToYen(b.confirmedPoints, b.pointsPerYen) -
            pointsToYen(a.confirmedPoints, a.pointsPerYen)
          );
        }
        if (sortKey === 'name_asc') {
          return a.name.localeCompare(b.name, 'ja');
        }
        const dA = daysUntil(a.expiryDate) ?? 99999;
        const dB = daysUntil(b.expiryDate) ?? 99999;
        return dA - dB;
      });
  }, [apps, search, categoryFilter, sortKey]);

  const categories: { id: 'all' | AppCategory; label: string }[] = [
    { id: 'all', label: 'すべて' },
    { id: 'point_site', label: 'ポイントサイト' },
    { id: 'walk_move', label: '移動・歩数' },
    { id: 'common_point', label: '共通ポイント' },
    { id: 'receipt_survey', label: 'レシート・アンケート' },
  ];

  return (
    <div className="space-y-6">
      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="アプリ名・メモを検索"
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="並び替え"
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer"
          >
            <option value="yen_desc">円換算額が高い順</option>
            <option value="expiry_asc">有効期限が近い順</option>
            <option value="name_asc">アプリ名順</option>
          </select>
        </div>
      </div>

      {/* App Cards Grid */}
      {filteredApps.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-sm font-medium text-slate-900">条件に一致するアプリがありません</p>
          <p className="text-xs text-slate-500 mt-1">
            検索条件を変更するか、新しいポイ活アプリを登録してください。
          </p>
          <button
            type="button"
            onClick={onAddApp}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            アプリを追加
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredApps.map((app) => {
            const confirmedYen = pointsToYen(app.confirmedPoints, app.pointsPerYen);
            const pendingYen = pointsToYen(app.pendingPoints, app.pointsPerYen);
            const exchangePct = Math.min(
              100,
              Math.round((app.confirmedPoints / Math.max(1, app.minExchangePoints)) * 100)
            );
            const remainingToExchange = Math.max(0, app.minExchangePoints - app.confirmedPoints);
            const isReady = remainingToExchange === 0;
            const expDays = daysUntil(app.expiryDate);

            return (
              <article
                key={app.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Header with prominent app icon */}
                  <div className="flex items-start gap-4">
                    <AppIcon
                      src={app.iconUrl}
                      name={app.name}
                      brandColor={app.brandColor}
                      size="xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold text-slate-900 truncate">
                          {app.name}
                        </h3>
                        <div className="flex items-center gap-1 shrink-0">
                          {app.siteUrl && (
                            <a
                              href={app.siteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md transition-colors"
                              title="公式サイトを開く"
                              aria-label={`${app.name}の公式サイトを開く`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditApp(app)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                            title="設定・アイコン画像を編集"
                            aria-label={`${app.name}を編集`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5">
                        {APP_CATEGORY_LABELS[app.category]} · {formatRate(app.unit, app.pointsPerYen)}
                      </p>

                      {app.expiryDate && (
                        <p
                          className={`text-xs mt-1.5 flex items-center gap-1 tabular-nums ${
                            expDays !== null && expDays <= 30
                              ? 'text-red-600 font-medium'
                              : 'text-slate-500'
                          }`}
                        >
                          {expDays !== null && expDays <= 30 && (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>
                            有効期限 {app.expiryDate}
                            {expDays !== null && expDays <= 30 ? `（あと${Math.max(0, expDays)}日）` : ''}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Point Balances */}
                  <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] text-slate-500">確定残高（円換算）</p>
                      <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900">
                        {formatYen(confirmedYen)}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-slate-500">
                        {formatPoints(app.confirmedPoints, app.unit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">判定中・予定</p>
                      <p
                        className={`mt-1 text-xl font-bold font-mono tabular-nums ${
                          pendingYen > 0 ? 'text-amber-700' : 'text-slate-300'
                        }`}
                      >
                        {pendingYen > 0 ? `+${formatYen(pendingYen)}` : '¥0'}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-slate-400">
                        {formatPoints(app.pendingPoints, app.unit)}
                      </p>
                    </div>
                  </div>

                  {/* Minimum Exchange Progress */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          isReady ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        {isReady && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {isReady
                          ? '最低交換ライン達成済み'
                          : `交換まであと ${formatPoints(remainingToExchange, app.unit)}`}
                      </span>
                      <span className="font-mono tabular-nums text-slate-400 text-[11px]">
                        最低 {formatPoints(app.minExchangePoints, app.unit)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${exchangePct}%`,
                          backgroundColor: isReady ? '#16A34A' : app.brandColor,
                        }}
                      />
                    </div>
                  </div>

                  {app.memo && (
                    <p className="mt-3 text-xs text-slate-500 leading-relaxed line-clamp-2">
                      {app.memo}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQuickLog(app.id, 'earned')}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      + ポイント記録
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickLog(app.id, 'exchanged')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      交換
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onViewHistory(app.id)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap cursor-pointer"
                  >
                    履歴
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
