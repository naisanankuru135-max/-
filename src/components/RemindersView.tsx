import { useMemo, useState, FormEvent } from 'react';
import { Check, AlertTriangle, Clock, Plus, Trash2, CalendarPlus, Bell } from 'lucide-react';
import { DealReminder, PoikatsuApp, ReminderKind } from '../types/poikatsu';
import { REMINDER_KIND_LABELS, daysUntil } from '../data/presets';
import { buildRemindersIcs, triggerTextDownload } from '../lib/exportHelpers';
import { AppIcon } from './AppIcon';

interface RemindersViewProps {
  apps: PoikatsuApp[];
  reminders: DealReminder[];
  onToggleReminder: (reminderId: string) => void;
  onAddReminder: (payload: Omit<DealReminder, 'id' | 'completed'>) => void;
  onDeleteReminder: (reminderId: string) => void;
}

type FilterMode = 'active' | 'cancellation' | 'condition' | 'completed' | 'all';

const QUICK_TEMPLATES: Array<{
  label: string;
  kind: ReminderKind;
  title: string;
  actionDetail: string;
  riskOrRewardText: string;
  daysOffset: number;
}> = [
  {
    label: 'サブスク解約期限',
    kind: 'cancellation',
    title: '動画・音楽サブスク 無料トライアル解約確認',
    actionDetail: '継続しない場合は無料期間終了の前日までに解約手続き',
    riskOrRewardText: '忘れると翌月から月額課金が発生',
    daysOffset: 28,
  },
  {
    label: 'クレカ決済条件',
    kind: 'condition',
    title: '新規クレジットカード 利用金額条件クリア',
    actionDetail: 'カード発行月の翌月末までに指定金額以上のショッピング決済',
    riskOrRewardText: '未達の場合はポイント獲得対象外',
    daysOffset: 30,
  },
  {
    label: '証券・銀行入金条件',
    kind: 'condition',
    title: '証券・銀行口座 初回入金＆取引条件',
    actionDetail: '口座開設から30日以内に指定額を一括入金して取引完了',
    riskOrRewardText: '達成で高額ポイント承認対象',
    daysOffset: 20,
  },
];

function futureDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function RemindersView({
  apps,
  reminders,
  onToggleReminder,
  onAddReminder,
  onDeleteReminder,
}: RemindersViewProps) {
  const [filter, setFilter] = useState<FilterMode>('active');
  const [appId, setAppId] = useState(apps[0]?.id ?? '');
  const [kind, setKind] = useState<ReminderKind>('cancellation');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(() => futureDateStr(14));
  const [actionDetail, setActionDetail] = useState('');
  const [riskOrRewardText, setRiskOrRewardText] = useState('');
  const [notifyFeedback, setNotifyFeedback] = useState('');

  const appMap = useMemo(() => {
    const map = new Map<string, PoikatsuApp>();
    apps.forEach((a) => map.set(a.id, a));
    return map;
  }, [apps]);

  const counts = useMemo(() => {
    let urgent = 0;
    let withinWeek = 0;
    let active = 0;
    let completed = 0;

    reminders.forEach((r) => {
      if (r.completed) {
        completed += 1;
        return;
      }
      active += 1;
      const d = daysUntil(r.dueDate);
      if (d !== null && d <= 3) urgent += 1;
      if (d !== null && d <= 7) withinWeek += 1;
    });

    return { urgent, withinWeek, active, completed };
  }, [reminders]);

  const filtered = useMemo(() => {
    return [...reminders]
      .filter((r) => {
        if (filter === 'active') return !r.completed;
        if (filter === 'completed') return r.completed;
        if (filter === 'cancellation') return !r.completed && r.kind === 'cancellation';
        if (filter === 'condition') return !r.completed && r.kind === 'condition';
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [reminders, filter]);

  const applyTemplate = (tpl: (typeof QUICK_TEMPLATES)[number]) => {
    setKind(tpl.kind);
    setTitle(tpl.title);
    setActionDetail(tpl.actionDetail);
    setRiskOrRewardText(tpl.riskOrRewardText);
    setDueDate(futureDateStr(tpl.daysOffset));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const targetAppId = appId || apps[0]?.id;
    if (!targetAppId || !title.trim() || !dueDate) return;

    onAddReminder({
      appId: targetAppId,
      title: title.trim(),
      kind,
      dueDate,
      actionDetail: actionDetail.trim() || '期限までに条件・手続きを確認する',
      riskOrRewardText: riskOrRewardText.trim() || undefined,
    });

    setTitle('');
    setActionDetail('');
    setRiskOrRewardText('');
  };

  const filterTabs: Array<{ id: FilterMode; label: string }> = [
    { id: 'active', label: `未完了 (${counts.active})` },
    { id: 'cancellation', label: '解約期限' },
    { id: 'condition', label: '獲得条件' },
    { id: 'completed', label: `完了済 (${counts.completed})` },
    { id: 'all', label: 'すべて' },
  ];

  return (
    <div className="space-y-6">
      {/* 4-column flat summary strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y lg:divide-y-0 divide-x divide-slate-200 overflow-hidden">
        <div className="p-4">
          <p className="text-xs text-slate-500">期限切れ・3日以内</p>
          <p
            className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
              counts.urgent > 0 ? 'text-red-600' : 'text-slate-900'
            }`}
          >
            {counts.urgent}
            <span className="text-xs font-normal text-slate-400 ml-1">件</span>
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">7日以内の期限</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-700">
            {counts.withinWeek}
            <span className="text-xs font-normal text-slate-400 ml-1">件</span>
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">進行中の条件・解約</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {counts.active}
            <span className="text-xs font-normal text-slate-400 ml-1">件</span>
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">対応完了済み</p>
          <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {counts.completed}
            <span className="text-xs font-normal text-slate-400 ml-1">件</span>
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Reminder List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto max-w-full w-fit">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const activeItems = reminders.filter((r) => !r.completed);
                  if (activeItems.length === 0) {
                    setNotifyFeedback('書き出す未完了リマインダーがありません。');
                    return;
                  }
                  const ics = buildRemindersIcs(activeItems, appMap);
                  triggerTextDownload(
                    `poicho-reminders-${new Date().toISOString().slice(0, 10)}.ics`,
                    ics,
                    'text/calendar;charset=utf-8'
                  );
                  setNotifyFeedback(`未完了 ${activeItems.length} 件の .ics を書き出しました。`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>まとめてカレンダー登録 (.ics)</span>
              </button>
              {typeof window !== 'undefined' && 'Notification' in window && (
                <button
                  type="button"
                  onClick={async () => {
                    const perm = await Notification.requestPermission();
                    if (perm !== 'granted') {
                      setNotifyFeedback('ブラウザ通知が許可されていません。');
                      return;
                    }
                    const soon = reminders.filter((r) => {
                      if (r.completed) return false;
                      const d = daysUntil(r.dueDate);
                      return d !== null && d <= 5;
                    });
                    if (soon.length === 0) {
                      new Notification('ポイ帳 リマインダー', {
                        body: '5日以内に期限を迎える条件・解約案件はありません。',
                      });
                      setNotifyFeedback('通知テストを送信しました（直近5日以内の案件なし）。');
                    } else {
                      new Notification(`ポイ帳: 期限間近 ${soon.length} 件`, {
                        body: soon.map((s) => `${s.dueDate}: ${s.title}`).join('\n'),
                      });
                      setNotifyFeedback(`期限間近 ${soon.length} 件の通知を送信しました。`);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>通知確認</span>
                </button>
              )}
            </div>
          </div>

          {notifyFeedback && (
            <p className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
              {notifyFeedback}
            </p>
          )}

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-900">
                  表示する条件・解約リマインダーがありません
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  クレカ決済条件やサブスク無料トライアルの解約期限を右のフォームから登録できます。
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const app = appMap.get(item.appId);
                const days = daysUntil(item.dueDate);
                const isOverdue = !item.completed && days !== null && days < 0;
                const isUrgent = !item.completed && days !== null && days >= 0 && days <= 5;
                const isSoon = !item.completed && days !== null && days > 5 && days <= 14;

                return (
                  <div
                    key={item.id}
                    className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                      item.completed ? 'bg-slate-50/70' : 'hover:bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onToggleReminder(item.id)}
                        aria-pressed={item.completed}
                        aria-label={`${item.title}を${item.completed ? '未完了に戻す' : '完了にする'}`}
                        className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          item.completed
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {item.completed && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <AppIcon
                        src={app?.iconUrl}
                        name={app?.name ?? '不明'}
                        brandColor={app?.brandColor}
                        size="md"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p
                            className={`text-sm font-semibold ${
                              item.completed ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {item.title}
                          </p>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 tabular-nums">
                          <span>{app?.name ?? '不明'}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              !item.completed && item.kind === 'cancellation'
                                ? 'text-red-700 font-medium'
                                : 'text-slate-600'
                            }
                          >
                            {REMINDER_KIND_LABELS[item.kind]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">期限 {item.dueDate}</span>
                          {!item.completed && days !== null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`inline-flex items-center gap-1 font-medium font-mono ${
                                  isOverdue || isUrgent
                                    ? 'text-red-600'
                                    : isSoon
                                      ? 'text-amber-700'
                                      : 'text-slate-600'
                                }`}
                              >
                                {(isOverdue || isUrgent) && (
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                )}
                                {!isOverdue && !isUrgent && <Clock className="w-3.5 h-3.5" />}
                                {isOverdue
                                  ? `${Math.abs(days)}日超過`
                                  : days === 0
                                    ? '本日締切'
                                    : `あと${days}日`}
                              </span>
                            </>
                          )}
                        </div>

                        <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                          {item.actionDetail}
                        </p>

                        {item.riskOrRewardText && (
                          <p
                            className={`mt-1 text-[11px] font-medium ${
                              item.completed
                                ? 'text-slate-400'
                                : item.kind === 'cancellation'
                                  ? 'text-red-700'
                                  : 'text-emerald-700'
                            }`}
                          >
                            {item.riskOrRewardText}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const ics = buildRemindersIcs([item], appMap);
                          triggerTextDownload(`${item.id}.ics`, ics, 'text/calendar;charset=utf-8');
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                        title="カレンダーに登録 (.ics)"
                        aria-label={`${item.title}をカレンダーに登録`}
                      >
                        <CalendarPlus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteReminder(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                        title="削除"
                        aria-label={`${item.title}を削除`}
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

        {/* Right: Add Reminder Form */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900">条件・解約期限を登録</h3>
          <p className="text-xs text-slate-500 mt-1">
            解約忘れによる課金や、決済条件の未達を防ぎます。
          </p>

          {/* Quick templates */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-600 border border-slate-200 rounded-md hover:border-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">種別</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'cancellation', label: '解約期限' },
                    { id: 'condition', label: '獲得条件' },
                    { id: 'campaign', label: '交換・CP' },
                  ] as const
                ).map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKind(k.id)}
                    className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      kind === k.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">対象アプリ</label>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {apps.map((app) => {
                  const active = (appId || apps[0]?.id) === app.id;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setAppId(app.id)}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
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
              <label htmlFor="rem-title" className="block text-xs font-medium text-slate-700 mb-1">
                案件・タスク名 *
              </label>
              <input
                id="rem-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: U-NEXT 無料トライアル解約"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="rem-due" className="block text-xs font-medium text-slate-700 mb-1">
                期限日 *
              </label>
              <input
                id="rem-due"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="rem-detail" className="block text-xs font-medium text-slate-700 mb-1">
                達成条件・手順メモ
              </label>
              <input
                id="rem-detail"
                type="text"
                value={actionDetail}
                onChange={(e) => setActionDetail(e.target.value)}
                placeholder="例: 翌月末までに1万円以上カード決済"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="rem-risk" className="block text-xs font-medium text-slate-700 mb-1">
                注意点・リターン（任意）
              </label>
              <input
                id="rem-risk"
                type="text"
                value={riskOrRewardText}
                onChange={(e) => setRiskOrRewardText(e.target.value)}
                placeholder="例: 解約忘れで月額¥2,189発生 / 達成で12,000P"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={apps.length === 0}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              リマインダーを登録
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
