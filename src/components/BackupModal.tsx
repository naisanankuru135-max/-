import { useEffect, useRef, useState, ChangeEvent } from 'react';
import {
  X,
  Download,
  Upload,
  RotateCcw,
  FileSpreadsheet,
  RefreshCw,
  ArrowDownCircle,
  Loader2,
} from 'lucide-react';
import { PoikatsuStoreData } from '../types/poikatsu';
import { buildTransactionsCsv, triggerTextDownload } from '../lib/exportHelpers';
import {
  AppUpdateInfo,
  CURRENT_APP_VERSION,
  checkForAppUpdate,
  getSavedUpdateFeedUrl,
  installAppUpdate,
  saveUpdateFeedUrl,
} from '../lib/appUpdater';

interface BackupModalProps {
  open: boolean;
  data: PoikatsuStoreData;
  onClose: () => void;
  onUpdateGoal: (goalYen: number) => void;
  onImportData: (nextData: PoikatsuStoreData) => void;
  onResetEmpty: () => void;
  onLoadSample: () => void;
}

export function BackupModal({
  open,
  data,
  onClose,
  onUpdateGoal,
  onImportData,
  onResetEmpty,
  onLoadSample,
}: BackupModalProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [goalInput, setGoalInput] = useState(String(data.monthlyGoalYen));
  const [statusMessage, setStatusMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [updateFeedUrl, setUpdateFeedUrl] = useState(() => getSavedUpdateFeedUrl());
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    if (open) {
      setGoalInput(String(data.monthlyGoalYen));
      setStatusMessage('');
      setConfirmReset(false);
      setUpdateFeedUrl(getSavedUpdateFeedUrl());
      setUpdateError('');
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

  const handleExportCsv = () => {
    const csv = buildTransactionsCsv(data.transactions, data.apps);
    triggerTextDownload(
      `poicho-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    setStatusMessage(`案件・履歴 ${data.transactions.length} 件を CSV で書き出しました。`);
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
            <button
              type="button"
              onClick={handleExportCsv}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              案件・履歴を CSV 書き出し（確定申告・Excel用）
            </button>
          </div>

          {/* App Auto-Update (APK) */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-900">
                アプリアップデート（現在 v{CURRENT_APP_VERSION}）
              </p>
              <button
                type="button"
                disabled={checkingUpdate}
                onClick={async () => {
                  setCheckingUpdate(true);
                  setUpdateError('');
                  try {
                    saveUpdateFeedUrl(updateFeedUrl);
                    const info = await checkForAppUpdate(updateFeedUrl);
                    setUpdateInfo(info);
                  } catch (err) {
                    setUpdateError(
                      err instanceof Error ? err.message : '更新確認に失敗しました。'
                    );
                  } finally {
                    setCheckingUpdate(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                {checkingUpdate ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                <span>更新を確認</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              GitHub Releases（既定）またはカスタム version.json から最新 APK を自動取得・インストールします。
            </p>
            <input
              type="url"
              value={updateFeedUrl}
              onChange={(e) => {
                setUpdateFeedUrl(e.target.value);
                saveUpdateFeedUrl(e.target.value);
              }}
              placeholder="配信JSON URL（空欄時は GitHub Releases を参照）"
              className="w-full px-3 py-1.5 text-[11px] font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
            />
            {updateError && <p className="text-[11px] text-red-600">{updateError}</p>}
            {updateInfo && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">
                    {updateInfo.hasUpdate
                      ? `新しいバージョン v${updateInfo.latestVersion} があります`
                      : `最新版です（v${updateInfo.latestVersion}）`}
                  </span>
                </div>
                {updateInfo.releaseNotes && (
                  <p className="text-[11px] text-slate-600 whitespace-pre-line line-clamp-3">
                    {updateInfo.releaseNotes}
                  </p>
                )}
                {updateInfo.hasUpdate && (
                  <button
                    type="button"
                    disabled={installingUpdate}
                    onClick={async () => {
                      setInstallingUpdate(true);
                      setUpdateError('');
                      try {
                        const res = await installAppUpdate(
                          updateInfo.apkUrl,
                          updateInfo.htmlUrl
                        );
                        if (res.status === 'needs_permission') {
                          setStatusMessage(
                            '設定画面で「不明なアプリのインストール」を許可してから再度お試しください。'
                          );
                        } else if (res.status === 'installing') {
                          setStatusMessage('最新 APK をダウンロードしインストーラーを起動しました。');
                        } else {
                          setStatusMessage('最新リリースのダウンロードページを開きました。');
                        }
                      } catch (err) {
                        setUpdateError(
                          err instanceof Error ? err.message : '更新のインストールに失敗しました。'
                        );
                      } finally {
                        setInstallingUpdate(false);
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50 cursor-pointer"
                  >
                    {installingUpdate ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ArrowDownCircle className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {installingUpdate
                        ? 'APK ダウンロード中...'
                        : `v${updateInfo.latestVersion} をダウンロードして更新`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Reset / Demo Data */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <p className="text-xs font-semibold text-slate-900">データ初期化</p>
            {confirmReset ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onResetEmpty();
                    setConfirmReset(false);
                    setStatusMessage('すべてのデータを空にリセットしました。');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
                >
                  本当に空にする
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
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  すべて空にリセット
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLoadSample();
                    setStatusMessage('デモ用サンプルデータを読み込みました。');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 underline cursor-pointer"
                >
                  デモ用サンプルを試す
                </button>
              </div>
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
