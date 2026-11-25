import { useEffect, useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { PoikatsuApp, PointTransaction, TransactionType } from '../types/poikatsu';
import { formatRate, formatYen, getTodayStr, pointsToYen } from '../data/presets';
import { AppIcon } from './AppIcon';

interface TransactionModalProps {
  open: boolean;
  apps: PoikatsuApp[];
  defaultAppId?: string;
  defaultType?: TransactionType;
  defaultExchangeTarget?: string;
  onClose: () => void;
  onSubmit: (tx: Omit<PointTransaction, 'id'>) => void;
}

const EXCHANGE_PRESETS = [
  '銀行振込',
  'PayPayポイント',
  '楽天ポイント',
  'Vポイント',
  'WAON POINT',
  'dポイント',
  'JALマイル',
  'ANAマイル',
  'Amazonギフトカード',
  'ドットマネー / PeX',
];

export function TransactionModal({
  open,
  apps,
  defaultAppId,
  defaultType = 'earned',
  defaultExchangeTarget,
  onClose,
  onSubmit,
}: TransactionModalProps) {
  const [appId, setAppId] = useState(defaultAppId || apps[0]?.id || '');
  const [type, setType] = useState<TransactionType>(defaultType);
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [expectedApprovalDate, setExpectedApprovalDate] = useState('');
  const [exchangeTarget, setExchangeTarget] = useState(defaultExchangeTarget || 'PayPayポイント');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setAppId(defaultAppId || apps[0]?.id || '');
      setType(defaultType);
      setTitle('');
      setPoints('');
      setDate(getTodayStr());
      setExpectedApprovalDate('');
      setExchangeTarget(defaultExchangeTarget || 'PayPayポイント');
      setNote('');
    }
  }, [open, defaultAppId, defaultType, defaultExchangeTarget, apps]);

  if (!open) return null;

  const selectedApp = apps.find((a) => a.id === appId) ?? apps[0];
  const numericPoints = Math.max(0, Number(points) || 0);
  const yenPreview = selectedApp ? pointsToYen(numericPoints, selectedApp.pointsPerYen) : 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedApp || numericPoints <= 0) return;

    const finalTitle =
      title.trim() ||
      (type === 'exchanged'
        ? `${exchangeTarget}へポイント交換`
        : type === 'pending'
          ? `${selectedApp.name} 案件（判定中）`
          : `${selectedApp.name} ポイント獲得`);

    onSubmit({
      appId: selectedApp.id,
      title: finalTitle,
      type,
      points: numericPoints,
      date: date || getTodayStr(),
      exchangeTarget: type === 'exchanged' ? exchangeTarget.trim() : undefined,
      expectedApprovalDate: type === 'pending' && expectedApprovalDate ? expectedApprovalDate : undefined,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 id="tx-modal-title" className="text-base font-semibold text-slate-900">
            ポイント・案件を記録
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">記録タイプ</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'earned', label: '獲得（確定）' },
                  { id: 'pending', label: '判定中（予定）' },
                  { id: 'exchanged', label: 'ポイント交換' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id)}
                  className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    type === item.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visual App Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">ポイ活アプリ</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
              {apps.map((app) => {
                const active = selectedApp?.id === app.id;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setAppId(app.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <AppIcon src={app.iconUrl} name={app.name} brandColor={app.brandColor} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{app.shortName}</p>
                      <p
                        className={`text-[10px] font-mono truncate ${
                          active ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {formatRate(app.unit, app.pointsPerYen)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Points & Yen Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tx-points" className="block text-xs font-medium text-slate-700 mb-1">
                ポイント数（{selectedApp?.unit ?? 'P'}）
              </label>
              <input
                id="tx-points"
                type="number"
                min={1}
                required
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="例: 5000"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
              />
              <p className="mt-1 text-xs font-mono tabular-nums text-slate-500">
                円換算: <strong className="text-slate-900">{formatYen(yenPreview)}</strong>
                {selectedApp && ` (${formatRate(selectedApp.unit, selectedApp.pointsPerYen)})`}
              </p>
            </div>

            <div>
              <label htmlFor="tx-date" className="block text-xs font-medium text-slate-700 mb-1">
                日付
              </label>
              <input
                id="tx-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="tx-title" className="block text-xs font-medium text-slate-700 mb-1">
              案件名・内容
            </label>
            <input
              id="tx-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === 'exchanged'
                  ? '例: ドットマネー経由で銀行振込'
                  : '例: 三井住友カード発行、楽天市場ショッピング'
              }
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Conditional Fields */}
          {type === 'pending' && (
            <div>
              <label htmlFor="tx-expected" className="block text-xs font-medium text-slate-700 mb-1">
                承認予定日（任意）
              </label>
              <input
                id="tx-expected"
                type="date"
                value={expectedApprovalDate}
                onChange={(e) => setExpectedApprovalDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>
          )}

          {type === 'exchanged' && (
            <div>
              <label htmlFor="tx-target" className="block text-xs font-medium text-slate-700 mb-1">
                交換先
              </label>
              <input
                id="tx-target"
                type="text"
                value={exchangeTarget}
                onChange={(e) => setExchangeTarget(e.target.value)}
                placeholder="例: PayPayポイント、銀行振込"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXCHANGE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExchangeTarget(preset)}
                    className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
                      exchangeTarget === preset
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="tx-note" className="block text-xs font-medium text-slate-700 mb-1">
              メモ（条件・キャンペーン等）
            </label>
            <input
              id="tx-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 翌月末までに5,000円決済条件あり"
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!selectedApp || numericPoints <= 0}
              className="px-5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
            >
              記録を保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
