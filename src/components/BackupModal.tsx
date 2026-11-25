import { useEffect, useRef, useState, ChangeEvent } from 'react';
import { X, Download, Upload, RotateCcw } from 'lucide-react';
import { PoikatsuStoreData } from '../types/poikatsu';

interface BackupModalProps {
  open: boolean;
  data: PoikatsuStoreData;
  onClose: () => void;
  onUpdateGoal: (goalYen: number) => void;
  onImportData: (nextData: PoikatsuStoreData) => void;
  onResetSample: () => void;
}

export function BackupModal({
  open,
  data,
  onClose,
  onUpdateGoal,
  onImportData,
  onResetSample,
}: BackupModalProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [goalInput, setGoalInput] = useState(String(data.monthlyGoalYen));
  const [statusMessage, setStatusMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (open) {
      setGoalInput(String(data.monthlyGoalYen));
      setStatusMessage('');
      setConfirmReset(false);
    }
  }, [open, data.monthlyGoalYen]);

  if (!open) return null;

  const handleSaveGoal = () => {
    const val = Math.max(1000, Number(goalInput) || 10000);
    onUpdateGoal(val);
    setStatusMessage('今月の目標金額を更新しました。');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poicho-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('バックアップJSONを書き出しました。');
  };

  const handleImportJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PoikatsuStoreData;
        if (!Array.isArray(parsed.apps) || !Array.isArray(parsed.transactions)) {
          setStatusMessage('ファイル形式が正しくありません。');
          return;
        }
        onImportData({
          apps: parsed.apps,
          transactions: parsed.transactions,
          routines: Array.isArray(parsed.routines) ? parsed.routines : [],
          reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
          monthlyGoalYen: Number(parsed.monthlyGoalYen) || 15000,
        });
        setStatusMessage('バックアップデータを復元しました。');
      } catch {
        setStatusMessage('JSONファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="backup-modal-title" className="text-base font-semibold text-slate-900">
            目標設定・データ管理
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

        <div className="p-6 space-y-6">
          {/* Monthly Goal */}
          <div className="space-y-2">
            <label htmlFor="goal-yen" className="block text-xs font-semibold text-slate-900">
              毎月のポイ活目標額（円）
            </label>
            <div className="flex items-center gap-2">
              <input
                id="goal-yen"
                type="number"
                min={1000}
                step={1000}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="flex-1 px-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
              />
              <button
                type="button"
                onClick={handleSaveGoal}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap cursor-pointer"
              >
                保存
              </button>
            </div>
          </div>

          {/* Export / Import */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <p className="text-xs font-semibold text-slate-900">データバックアップ（JSON）</p>
            <p className="text-[11px] text-slate-500">
              登録アプリ・アップロードしたアイコン画像・案件履歴をまるごと保存・復元できます。
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                書き出し
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                onChange={handleImportJson}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                読み込み
              </button>
            </div>
          </div>

          {/* Reset Sample Data */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="text-xs font-semibold text-slate-900">初期データへリセット</p>
            {confirmReset ? (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onResetSample();
                    setConfirmReset(false);
                    setStatusMessage('サンプルデータへ初期化しました。');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
                >
                  本当に初期化する
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                サンプルデータに戻す
              </button>
            )}
          </div>

          {statusMessage && (
            <p className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {statusMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
