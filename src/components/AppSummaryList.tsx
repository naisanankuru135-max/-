import { ChevronRight, LayoutGrid, LayoutList, Pencil, Plus } from 'lucide-react';
import { PoikatsuApp } from '../types/poikatsu';
import { formatPoints, formatYen, pointsToYen } from '../data/presets';
import { AppIcon } from './AppIcon';

export type AppViewMode = 'list' | 'card';

const VIEW_MODE_STORAGE_KEY = 'poicho_app_view_mode_v1';

export function getSavedAppViewMode(): AppViewMode {
  try {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return saved === 'card' ? 'card' : 'list';
  } catch {
    return 'list';
  }
}

export function saveAppViewMode(mode: AppViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

interface AppViewModeToggleProps {
  mode: AppViewMode;
  onChange: (mode: AppViewMode) => void;
}

export function AppViewModeToggle({ mode, onChange }: AppViewModeToggleProps) {
  return (
    <div
      className="inline-flex items-center p-0.5 bg-slate-200/75 rounded-lg shrink-0"
      role="group"
      aria-label="表示形式"
    >
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={mode === 'list'}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
          mode === 'list'
            ? 'bg-white text-slate-900 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <LayoutList className="w-3.5 h-3.5" />
        リスト
      </button>
      <button
        type="button"
        onClick={() => onChange('card')}
        aria-pressed={mode === 'card'}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
          mode === 'card'
            ? 'bg-white text-slate-900 shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        カード
      </button>
    </div>
  );
}

interface AppSummaryListProps {
  apps: PoikatsuApp[];
  totalConfirmedYen: number;
  onSelectApp: (appId: string) => void;
  onQuickLog?: (appId: string) => void;
  onEditApp?: (app: PoikatsuApp) => void;
}

/**
 * Compact per-app balance summary list displaying real icons, confirmed yen,
 * share percentage of total assets, and quick navigation.
 */
export function AppSummaryList({
  apps,
  totalConfirmedYen,
  onSelectApp,
  onQuickLog,
  onEditApp,
}: AppSummaryListProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-500">
        <span>アプリ別残高（{apps.length}件）</span>
        <span className="font-mono tabular-nums">合計 {formatYen(totalConfirmedYen)}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {apps.map((app) => {
          const confirmedYen = pointsToYen(app.confirmedPoints, app.pointsPerYen);
          const pendingYen = pointsToYen(app.pendingPoints, app.pointsPerYen);
          const sharePct =
            totalConfirmedYen > 0 ? Math.max(0, (confirmedYen / totalConfirmedYen) * 100) : 0;
          const barWidth = sharePct > 0 ? Math.max(4, Math.min(100, sharePct)) : 0;

          return (
            <div
              key={app.id}
              className="group flex items-center gap-2.5 px-3.5 py-3 hover:bg-slate-50/80 transition-colors"
            >
              <button
                type="button"
                onClick={() => onSelectApp(app.id)}
                className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <AppIcon
                    src={app.iconUrl}
                    name={app.name}
                    brandColor={app.brandColor}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {app.name}
                      </span>
                      {pendingYen > 0 && (
                        <span className="text-[10px] font-mono tabular-nums text-amber-700 bg-amber-50 border border-amber-200/70 px-1.5 py-0.2 rounded shrink-0">
                          +{formatYen(pendingYen)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="w-16 max-w-[35%] h-1 bg-slate-100 rounded-full overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: app.brandColor || '#0F172A',
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400 truncate">
                        {formatPoints(app.confirmedPoints, app.unit)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                    {formatYen(confirmedYen)}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500 w-12 text-right">
                    {sharePct.toFixed(1)}%
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                </div>
              </button>

              {(onQuickLog || onEditApp) && (
                <div className="flex items-center gap-0.5 pl-1 border-l border-slate-100 shrink-0">
                  {onQuickLog && (
                    <button
                      type="button"
                      onClick={() => onQuickLog(app.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                      title={`${app.name}のポイントを記録`}
                      aria-label={`${app.name}のポイントを記録`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onEditApp && (
                    <button
                      type="button"
                      onClick={() => onEditApp(app)}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                      title={`${app.name}を編集`}
                      aria-label={`${app.name}を編集`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
