import { useMemo, useState, FormEvent } from 'react';
import { Check, Plus, Trash2, ExternalLink } from 'lucide-react';
import { DailyRoutine, PoikatsuApp } from '../types/poikatsu';
import { formatPoints, formatYen, getTodayStr, pointsToYen } from '../data/presets';
import { AppIcon } from './AppIcon';

interface RoutineViewProps {
  apps: PoikatsuApp[];
  routines: DailyRoutine[];
  onToggleRoutine: (routineId: string, creditPoints: boolean) => void;
  onAddRoutine: (routine: Omit<DailyRoutine, 'id' | 'completedDates'>) => void;
  onDeleteRoutine: (routineId: string) => void;
}

export function RoutineView({
  apps,
  routines,
  onToggleRoutine,
  onAddRoutine,
  onDeleteRoutine,
}: RoutineViewProps) {
  const today = getTodayStr();
  const [autoCredit, setAutoCredit] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState(apps[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [rewardPoints, setRewardPoints] = useState('5');

  const appMap = useMemo(() => {
    const map = new Map<string, PoikatsuApp>();
    apps.forEach((a) => map.set(a.id, a));
    return map;
  }, [apps]);

  const completedTodayCount = useMemo(
    () => routines.filter((r) => r.completedDates.includes(today)).length,
    [routines, today]
  );

  const completionPct =
    routines.length > 0 ? Math.round((completedTodayCount / routines.length) * 100) : 0;

  const estimatedDailyYen = useMemo(() => {
    return routines.reduce((sum, r) => {
      const app = appMap.get(r.appId);
      return sum + (app ? r.rewardPoints / Math.max(1, app.pointsPerYen) : r.rewardPoints);
    }, 0);
  }, [routines, appMap]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const targetAppId = selectedAppId || apps[0]?.id;
    if (!targetAppId || !title.trim()) return;
    onAddRoutine({
      appId: targetAppId,
      title: title.trim(),
      rewardPoints: Math.max(0, Number(rewardPoints) || 0),
    });
    setTitle('');
    setRewardPoints('5');
  };

  const selectedApp = appMap.get(selectedAppId || apps[0]?.id || '');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Checklist */}
      <div className="lg:col-span-8 space-y-5">
        {/* Progress Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 font-mono tabular-nums">{today}</p>
              <h2 className="text-base font-semibold text-slate-900 mt-0.5">
                本日の毎日ポイ活チェック
              </h2>
            </div>

            <div className="text-right">
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900">
                {completedTodayCount}
                <span className="text-sm font-normal text-slate-400"> / {routines.length}</span>
              </p>
              <p className="text-xs text-slate-500 tabular-nums">
                達成率 {completionPct}% · 目安 {formatYen(Math.round(estimatedDailyYen * 30))}/月
              </p>
            </div>
          </div>

          <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>

          <label className="mt-4 inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCredit}
              onChange={(e) => setAutoCredit(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-slate-900 cursor-pointer"
            />
            <span>チェック完了時に、目安ポイントを自動でアプリ残高へ加算する</span>
          </label>
        </div>

        {/* Checklist Items */}
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {routines.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-900">毎日ルーティンが登録されていません</p>
              <p className="text-xs text-slate-500 mt-1">
                ガチャやログインボーナス、歩数回収などの日課を右のフォームから追加できます。
              </p>
            </div>
          ) : (
            routines.map((routine) => {
              const app = appMap.get(routine.appId);
              const doneToday = routine.completedDates.includes(today);
              const yenApprox = app
                ? pointsToYen(routine.rewardPoints, app.pointsPerYen)
                : routine.rewardPoints;

              return (
                <div
                  key={routine.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    doneToday ? 'bg-slate-50/70' : 'hover:bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onToggleRoutine(routine.id, autoCredit)}
                      aria-pressed={doneToday}
                      aria-label={`${routine.title}を${doneToday ? '未完了に戻す' : '完了にする'}`}
                      className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        doneToday
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {doneToday && <Check className="w-4 h-4" />}
                    </button>

                    <AppIcon
                      src={app?.iconUrl}
                      name={app?.name ?? '不明'}
                      brandColor={app?.brandColor}
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium truncate ${
                          doneToday ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {routine.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 tabular-nums">
                        <span>{app?.name ?? '不明'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">
                          +{formatPoints(routine.rewardPoints, app?.unit ?? 'P')}
                          {yenApprox > 0 ? `（約${yenApprox}円）` : ''}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>累計 {routine.completedDates.length} 回</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {app?.siteUrl && (
                      <a
                        href={app.siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-slate-900 rounded-lg transition-colors"
                        title={`${app.name}を開く`}
                        aria-label={`${app.name}を開く`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteRoutine(routine.id)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                      title="ルーティンを削除"
                      aria-label={`${routine.title}を削除`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Routine Form */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-900">新しいルーティンを追加</h3>
        <p className="text-xs text-slate-500 mt-1">
          毎日チェックするガチャ・ログイン・動画回収などを登録しておけます。
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">対象アプリ</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {apps.map((app) => {
                const active = (selectedAppId || apps[0]?.id) === app.id;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelectedAppId(app.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <AppIcon
                      src={app.iconUrl}
                      name={app.name}
                      brandColor={app.brandColor}
                      size="xs"
                    />
                    <span className="text-xs font-medium truncate">{app.shortName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="routine-title" className="block text-xs font-medium text-slate-700 mb-1">
              ルーティン内容
            </label>
            <input
              id="routine-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 毎日ガチャ＆ニュース閲覧"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="routine-points" className="block text-xs font-medium text-slate-700 mb-1">
              1回あたりの目安ポイント（{selectedApp?.unit ?? 'P'}）
            </label>
            <input
              id="routine-points"
              type="number"
              min={0}
              value={rewardPoints}
              onChange={(e) => setRewardPoints(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={apps.length === 0}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            ルーティンに追加
          </button>
        </form>
      </div>
    </div>
  );
}
