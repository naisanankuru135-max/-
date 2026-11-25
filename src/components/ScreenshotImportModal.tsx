import { useEffect, useRef, useState, ChangeEvent, DragEvent } from 'react';
import { X, Upload, ScanLine, Check, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import {
  ParsedScreenshotResult,
  PoikatsuApp,
  PointTransaction,
  TransactionType,
} from '../types/poikatsu';
import { formatRate, formatYen, getTodayStr, pointsToYen } from '../data/presets';
import { AppIcon } from './AppIcon';

export interface ScreenshotApplyPayload {
  appId: string;
  updateConfirmedBalance?: number;
  updatePendingBalance?: number;
  updateExpiryDate?: string;
  transactions: Array<Omit<PointTransaction, 'id'>>;
}

interface ScreenshotImportModalProps {
  open: boolean;
  apps: PoikatsuApp[];
  onClose: () => void;
  onApply: (payload: ScreenshotApplyPayload) => void;
}

interface EditableParsedTx {
  selected: boolean;
  title: string;
  points: number;
  type: TransactionType;
  date: string;
  exchangeTarget?: string;
  note?: string;
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const commaIndex = dataUrl.indexOf(',');
      if (commaIndex === -1) {
        reject(new Error('画像の変換に失敗しました'));
        return;
      }
      resolve({
        base64: dataUrl.slice(commaIndex + 1),
        mimeType: file.type || 'image/png',
        dataUrl,
      });
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

export function ScreenshotImportModal({
  open,
  apps,
  onClose,
  onApply,
}: ScreenshotImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Parsed review state
  const [result, setResult] = useState<ParsedScreenshotResult | null>(null);
  const [targetAppId, setTargetAppId] = useState<string>(apps[0]?.id ?? '');
  const [applyConfirmed, setApplyConfirmed] = useState(false);
  const [confirmedInput, setConfirmedInput] = useState('0');
  const [applyPending, setApplyPending] = useState(false);
  const [pendingInput, setPendingInput] = useState('0');
  const [applyExpiry, setApplyExpiry] = useState(false);
  const [expiryInput, setExpiryInput] = useState('');
  const [editableTxs, setEditableTxs] = useState<EditableParsedTx[]>([]);

  const resetAll = () => {
    setPreviewUrl('');
    setIsAnalyzing(false);
    setErrorMsg('');
    setResult(null);
    setTargetAppId(apps[0]?.id ?? '');
    setApplyConfirmed(false);
    setConfirmedInput('0');
    setApplyPending(false);
    setPendingInput('0');
    setApplyExpiry(false);
    setExpiryInput('');
    setEditableTxs([]);
  };

  useEffect(() => {
    if (open) {
      resetAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Support Ctrl+V / Cmd+V screenshot paste while modal is open
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void analyzeFile(file);
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, apps]);

  if (!open) return null;

  const analyzeFile = async (file: File) => {
    setErrorMsg('');
    setResult(null);

    if (!file.type.startsWith('image/')) {
      setErrorMsg('PNG / JPG / WebP などの画像ファイルを選択してください。');
      return;
    }

    try {
      const { base64, mimeType, dataUrl } = await fileToBase64(file);
      setPreviewUrl(dataUrl);
      setIsAnalyzing(true);

      const response = await fetch('/api/parse-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          registeredApps: apps.map((a) => ({
            id: a.id,
            name: a.name,
            unit: a.unit,
            pointsPerYen: a.pointsPerYen,
          })),
        }),
      });

      const data = (await response.json()) as ParsedScreenshotResult & { error?: string };

      if (!response.ok) {
        setErrorMsg(data.error || 'スクリーンショットの解析に失敗しました。');
        setIsAnalyzing(false);
        return;
      }

      setResult(data);

      // Match app by returned ID or fallback name search
      const matchedById = apps.find((a) => a.id === data.matchedAppId);
      const matchedByName = !matchedById
        ? apps.find(
            (a) =>
              data.detectedAppName &&
              (a.name.includes(data.detectedAppName) || data.detectedAppName.includes(a.name))
          )
        : undefined;
      setTargetAppId(matchedById?.id || matchedByName?.id || apps[0]?.id || '');

      const hasConfirmed = typeof data.confirmedBalance === 'number' && data.confirmedBalance >= 0;
      setApplyConfirmed(hasConfirmed);
      setConfirmedInput(hasConfirmed ? String(data.confirmedBalance) : '0');

      const hasPending = typeof data.pendingBalance === 'number' && data.pendingBalance >= 0;
      setApplyPending(hasPending);
      setPendingInput(hasPending ? String(data.pendingBalance) : '0');

      const hasExpiry = Boolean(data.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(data.expiryDate));
      setApplyExpiry(hasExpiry);
      setExpiryInput(hasExpiry ? data.expiryDate || '' : '');

      const normalizedTxs: EditableParsedTx[] = Array.isArray(data.transactions)
        ? data.transactions
            .filter((t) => t && t.title && Number(t.points) > 0)
            .map((t) => ({
              selected: true,
              title: String(t.title),
              points: Math.max(1, Math.round(Number(t.points) || 0)),
              type:
                t.type === 'pending' || t.type === 'exchanged' || t.type === 'earned'
                  ? t.type
                  : 'earned',
              date:
                typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
                  ? t.date
                  : getTodayStr(),
              exchangeTarget: t.exchangeTarget || undefined,
              note: t.note || undefined,
            }))
        : [];

      setEditableTxs(normalizedTxs);
    } catch {
      setErrorMsg('サーバーとの通信に失敗しました。ネットワーク接続を確認してください。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void analyzeFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void analyzeFile(file);
  };

  const selectedApp = apps.find((a) => a.id === targetAppId) ?? apps[0];

  const selectedTxCount = editableTxs.filter((t) => t.selected).length;
  const canApply =
    Boolean(selectedApp) &&
    (applyConfirmed || applyPending || applyExpiry || selectedTxCount > 0);

  const handleConfirmApply = () => {
    if (!selectedApp || !canApply) return;
    onApply({
      appId: selectedApp.id,
      updateConfirmedBalance: applyConfirmed ? Math.max(0, Number(confirmedInput) || 0) : undefined,
      updatePendingBalance: applyPending ? Math.max(0, Number(pendingInput) || 0) : undefined,
      updateExpiryDate: applyExpiry && expiryInput ? expiryInput : undefined,
      transactions: editableTxs
        .filter((t) => t.selected && t.points > 0)
        .map((t) => ({
          appId: selectedApp.id,
          title: t.title.trim() || `${selectedApp.name} 獲得`,
          points: Math.max(1, Math.round(t.points)),
          type: t.type,
          date: t.date || getTodayStr(),
          exchangeTarget: t.type === 'exchanged' ? t.exchangeTarget : undefined,
          note: t.note,
        })),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="screenshot-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-slate-900" />
            <h2 id="screenshot-modal-title" className="text-base font-semibold text-slate-900">
              スクリーンショットから自動読み取り
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Upload / Drop Zone */}
          {!result && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isDragging
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-300 bg-slate-50/50 hover:border-slate-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {isAnalyzing ? (
                <div className="py-4 flex flex-col items-center gap-3">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="解析中のスクリーンショット"
                      className="max-h-40 rounded-lg border border-slate-200 object-contain"
                    />
                  )}
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>スクリーンショットからポイント・案件を読み取っています...</span>
                  </div>
                  <p className="text-xs text-slate-500">通常 2〜5 秒ほどで完了します</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-700">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      ポイ活アプリの残高画面・獲得履歴スクショをドロップ
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      またはクリップボードから直接貼り付け（Ctrl+V / Cmd+V）にも対応しています
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    画像ファイルを選択
                  </button>
                  <p className="text-[11px] text-slate-400">
                    対応例: モッピー・ハピタス・ポイントインカム・トリマ・楽天ポイント等のマイページ / 通帳画面
                  </p>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Review Parsed Result */}
          {result && (
            <div className="space-y-5">
              {/* Top Preview & Summary */}
              <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="アップロードしたスクリーンショット"
                    className="w-full sm:w-28 max-h-36 rounded-lg border border-slate-200 object-cover shrink-0 bg-white"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">
                      検出アプリ: {result.detectedAppName || '不明'}
                    </p>
                    <button
                      type="button"
                      onClick={resetAll}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      別の画像を読み込む
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{result.summary}</p>
                  <p className="text-[11px] text-slate-400">
                    内容を確認・必要に応じて修正してから「選択した内容を反映する」を押してください。
                  </p>
                </div>
              </div>

              {/* Target App Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  反映先のポイ活アプリ
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                  {apps.map((app) => {
                    const active = selectedApp?.id === app.id;
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => setTargetAppId(app.id)}
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

              {/* Balance Updates */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-slate-900">
                  残高・有効期限の更新（{selectedApp ? formatRate(selectedApp.unit, selectedApp.pointsPerYen) : ''}）
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyConfirmed}
                        onChange={(e) => setApplyConfirmed(e.target.checked)}
                        className="w-4 h-4 rounded accent-slate-900 cursor-pointer"
                      />
                      <span>確定残高を上書き更新</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={!applyConfirmed}
                      value={confirmedInput}
                      onChange={(e) => setConfirmedInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    {applyConfirmed && selectedApp && (
                      <p className="text-[11px] font-mono tabular-nums text-slate-500">
                        円換算: {formatYen(pointsToYen(Number(confirmedInput) || 0, selectedApp.pointsPerYen))}
                      </p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyPending}
                        onChange={(e) => setApplyPending(e.target.checked)}
                        className="w-4 h-4 rounded accent-slate-900 cursor-pointer"
                      />
                      <span>判定中残高を上書き更新</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={!applyPending}
                      value={pendingInput}
                      onChange={(e) => setPendingInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md disabled:bg-slate-50 disabled:text-slate-400"
                    />
                    {applyPending && selectedApp && (
                      <p className="text-[11px] font-mono tabular-nums text-amber-700">
                        円換算: {formatYen(pointsToYen(Number(pendingInput) || 0, selectedApp.pointsPerYen))}
                      </p>
                    )}
                  </div>
                </div>

                {expiryInput && (
                  <div className="p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyExpiry}
                        onChange={(e) => setApplyExpiry(e.target.checked)}
                        className="w-4 h-4 rounded accent-slate-900 cursor-pointer"
                      />
                      <span>有効期限を更新</span>
                    </label>
                    <input
                      type="date"
                      disabled={!applyExpiry}
                      value={expiryInput}
                      onChange={(e) => setExpiryInput(e.target.value)}
                      className="px-2.5 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded-md disabled:bg-slate-50"
                    />
                  </div>
                )}
              </div>

              {/* Extracted Transactions */}
              {editableTxs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-900">
                    検出された履歴・案件（{selectedTxCount} / {editableTxs.length} 件選択中）
                  </p>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {editableTxs.map((tx, idx) => (
                      <div key={idx} className="p-3 flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setEditableTxs((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, selected: !item.selected } : item
                              )
                            )
                          }
                          className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                            tx.selected
                              ? 'bg-slate-900 border-slate-900 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {tx.selected && <Check className="w-3 h-3" />}
                        </button>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <input
                            type="text"
                            value={tx.title}
                            onChange={(e) =>
                              setEditableTxs((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, title: e.target.value } : item
                                )
                              )
                            }
                            className="sm:col-span-5 px-2 py-1 text-xs border border-slate-200 rounded"
                          />
                          <select
                            value={tx.type}
                            onChange={(e) =>
                              setEditableTxs((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, type: e.target.value as TransactionType }
                                    : item
                                )
                              )
                            }
                            className="sm:col-span-2 px-1.5 py-1 text-xs border border-slate-200 rounded bg-white"
                          >
                            <option value="earned">確定</option>
                            <option value="pending">判定中</option>
                            <option value="exchanged">交換</option>
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={tx.points}
                            onChange={(e) =>
                              setEditableTxs((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, points: Math.max(0, Number(e.target.value) || 0) }
                                    : item
                                )
                              )
                            }
                            className="sm:col-span-2 px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded"
                          />
                          <input
                            type="date"
                            value={tx.date}
                            onChange={(e) =>
                              setEditableTxs((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, date: e.target.value } : item
                                )
                              )
                            }
                            className="sm:col-span-3 px-1.5 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {applyConfirmed && selectedTxCount > 0 && (
                    <p className="text-[11px] text-slate-500">
                      ※ 確定残高の上書きと履歴追加を同時に行う場合、残高は上書き入力した値に設定され、履歴のみ追加されます。
                    </p>
                  )}
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={!canApply}
                  onClick={handleConfirmApply}
                  className="px-5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
                >
                  選択した内容を反映する
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
