import { useEffect, useRef, useState, ChangeEvent, DragEvent } from 'react';
import {
  X,
  Upload,
  ScanLine,
  Check,
  AlertCircle,
  Loader2,
  RotateCcw,
  Settings2,
  Eye,
  EyeOff,
  CheckCircle2,
  PlugZap,
  Save,
  BellRing,
  RefreshCw,
} from 'lucide-react';
import {
  AiConcreteProviderId,
  AiProviderSelection,
  AiRequestConfig,
  AiServerStatus,
  DealReminder,
  ParsedScreenshotResult,
  PoikatsuApp,
  PointTransaction,
  ReminderKind,
  TransactionType,
} from '../types/poikatsu';
import { formatRate, formatYen, getTodayStr, pointsToYen } from '../data/presets';
import {
  AI_PROVIDERS,
  getProviderMeta,
  loadAiConfig,
  saveAiConfig,
} from '../data/aiProviders';
import {
  isNativeMobileRuntime,
  parseScreenshotDirect,
  testAiDirect,
} from '../lib/directAiClient';
import { DiscoveredModelOption, fetchProviderModelsList } from '../lib/screenshotAiShared';
import { AppIcon } from './AppIcon';

export interface ScreenshotApplyPayload {
  appId: string;
  updateConfirmedBalance?: number;
  updatePendingBalance?: number;
  updateExpiryDate?: string;
  transactions: Array<Omit<PointTransaction, 'id'>>;
  reminders?: Array<Omit<DealReminder, 'id' | 'completed'>>;
}

interface ScreenshotImportModalProps {
  open: boolean;
  apps: PoikatsuApp[];
  existingTransactions: PointTransaction[];
  onClose: () => void;
  onApply: (payload: ScreenshotApplyPayload) => void;
}

interface EditableParsedTx {
  selected: boolean;
  isDuplicate: boolean;
  title: string;
  points: number;
  type: TransactionType;
  date: string;
  exchangeTarget?: string;
  note?: string;
}

interface EditableParsedReminder {
  selected: boolean;
  title: string;
  kind: ReminderKind;
  dueDate: string;
  actionDetail: string;
  riskOrRewardText?: string;
}

type ParsedResponseWithMeta = ParsedScreenshotResult & {
  error?: string;
  _meta?: { provider: AiConcreteProviderId; model: string };
};

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s\u3000・\-_/()（）【】[\]]+/g, '');
}

function isLikelyDuplicateTx(
  candidate: { title: string; points: number; date: string; type: TransactionType },
  existing: PointTransaction[],
  targetAppId: string
): boolean {
  const normCand = normalizeTitle(candidate.title);
  return existing.some((ex) => {
    if (targetAppId && ex.appId !== targetAppId) return false;
    if (ex.points !== candidate.points) return false;
    if (ex.date === candidate.date) return true;
    const normEx = normalizeTitle(ex.title);
    if (!normCand || !normEx) return false;
    return normCand === normEx || normEx.includes(normCand) || normCand.includes(normEx);
  });
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
  existingTransactions,
  onClose,
  onApply,
}: ScreenshotImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // AI settings state
  const [aiConfig, setAiConfig] = useState<AiRequestConfig>(() => loadAiConfig());
  const [serverStatus, setServerStatus] = useState<AiServerStatus | null>(null);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [isSavingEnv, setIsSavingEnv] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<
    Partial<Record<AiConcreteProviderId, DiscoveredModelOption[]>>
  >({});
  const [aiTestFeedback, setAiTestFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Parsed review state
  const [result, setResult] = useState<ParsedResponseWithMeta | null>(null);
  const [parsedCount, setParsedCount] = useState(0);
  const [targetAppId, setTargetAppId] = useState<string>(apps[0]?.id ?? '');
  const [applyConfirmed, setApplyConfirmed] = useState(false);
  const [confirmedInput, setConfirmedInput] = useState('0');
  const [applyPending, setApplyPending] = useState(false);
  const [pendingInput, setPendingInput] = useState('0');
  const [applyExpiry, setApplyExpiry] = useState(false);
  const [expiryInput, setExpiryInput] = useState('');
  const [editableTxs, setEditableTxs] = useState<EditableParsedTx[]>([]);
  const [editableReminders, setEditableReminders] = useState<EditableParsedReminder[]>([]);

  const updateAiConfig = (patch: Partial<AiRequestConfig>) => {
    setAiConfig((prev) => {
      const next = { ...prev, ...patch };
      saveAiConfig(next);
      return next;
    });
    setAiTestFeedback(null);
  };

  const resetAll = () => {
    setPreviewUrls([]);
    setIsAnalyzing(false);
    setProgressText('');
    setErrorMsg('');
    setResult(null);
    setParsedCount(0);
    setTargetAppId(apps[0]?.id ?? '');
    setApplyConfirmed(false);
    setConfirmedInput('0');
    setApplyPending(false);
    setPendingInput('0');
    setApplyExpiry(false);
    setExpiryInput('');
    setEditableTxs([]);
    setEditableReminders([]);
  };

  useEffect(() => {
    if (!open) return;
    resetAll();
    setAiTestFeedback(null);

    const saved = loadAiConfig();
    if (isNativeMobileRuntime() && saved.provider === 'auto') {
      saved.provider = 'gemini';
      saveAiConfig(saved);
    }
    setAiConfig(saved);
    if (saved.provider !== 'auto') {
      const meta = getProviderMeta(saved.provider);
      const isPreset = meta.models.some((m) => m.id === saved.model);
      setCustomModelMode(Boolean(saved.model && !isPreset));
    } else {
      setCustomModelMode(false);
    }

    if (isNativeMobileRuntime()) {
      setServerAvailable(false);
      setServerStatus(null);
      const hasDirectCreds = Boolean(
        saved.apiKey?.trim() || saved.baseUrl?.trim()
      );
      if (!hasDirectCreds) setSettingsOpen(true);
      return;
    }

    let cancelled = false;
    fetch('/api/ai-status')
      .then((res) => (res.ok ? (res.json() as Promise<AiServerStatus>) : null))
      .then((status) => {
        if (cancelled) return;
        if (!status) {
          setServerAvailable(false);
          setServerStatus(null);
          return;
        }
        setServerAvailable(true);
        setServerStatus(status);
        const hasLocalOrServer =
          saved.provider === 'auto'
            ? Boolean(status.preferredProvider)
            : Boolean(
                saved.apiKey?.trim() ||
                  saved.project?.trim() ||
                  saved.baseUrl?.trim() ||
                  status.defaults[saved.provider]?.hasCredentials
              );
        if (!hasLocalOrServer) {
          setSettingsOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerAvailable(false);
          setServerStatus(null);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Support Ctrl+V / Cmd+V screenshot paste while modal is open
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void analyzeFiles(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, apps, aiConfig, serverAvailable]);

  if (!open) return null;

  const activeConcreteProvider: AiConcreteProviderId | null =
    aiConfig.provider === 'auto' ? (serverStatus?.preferredProvider ?? null) : aiConfig.provider;
  const activeProviderMeta = activeConcreteProvider ? getProviderMeta(activeConcreteProvider) : null;
  const activeServerDefault = activeConcreteProvider
    ? serverStatus?.defaults[activeConcreteProvider]
    : undefined;

  const effectiveModelLabel = (() => {
    if (!activeConcreteProvider || !activeProviderMeta) return '未設定';
    if (aiConfig.provider === 'auto') {
      return activeServerDefault?.model || activeProviderMeta.defaultModel;
    }
    return aiConfig.model?.trim() || activeServerDefault?.model || activeProviderMeta.defaultModel;
  })();

  const hasActiveCredentials = (() => {
    if (!activeConcreteProvider) return false;
    if (aiConfig.provider === 'auto') return Boolean(serverStatus?.preferredProvider);
    if (activeConcreteProvider === 'vertex_project') {
      return serverAvailable && Boolean(aiConfig.project?.trim() || activeServerDefault?.project);
    }
    if (activeConcreteProvider === 'openai_compatible') {
      return Boolean(aiConfig.baseUrl?.trim() || activeServerDefault?.baseUrl);
    }
    if (activeConcreteProvider === 'opencode') {
      return true;
    }
    if (activeConcreteProvider === 'opencode_go') {
      return Boolean(
        aiConfig.apiKey?.trim() ||
          activeServerDefault?.hasCredentials ||
          effectiveModelLabel.endsWith('-free')
      );
    }
    return Boolean(aiConfig.apiKey?.trim() || activeServerDefault?.hasCredentials);
  })();

  const handleFetchModels = async (providerId: AiConcreteProviderId) => {
    setIsLoadingModels(true);
    setAiTestFeedback(null);
    try {
      let models: DiscoveredModelOption[] = [];
      if (serverAvailable && !isNativeMobileRuntime()) {
        const res = await fetch('/api/ai-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiConfig: { ...aiConfig, provider: providerId } }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          models?: DiscoveredModelOption[];
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'モデル一覧の取得に失敗しました。');
        }
        models = data.models || [];
      } else {
        const meta = getProviderMeta(providerId);
        models = await fetchProviderModelsList({
          provider: providerId,
          baseUrl: aiConfig.baseUrl?.trim() || meta.defaultBaseUrl,
          apiKey: aiConfig.apiKey?.trim(),
        });
      }
      setDiscoveredModels((prev) => ({ ...prev, [providerId]: models }));
      setCustomModelMode(false);
      setAiTestFeedback({
        ok: true,
        message: `${models.length} 件の対応モデルを読み込みました。`,
      });
    } catch (err) {
      setAiTestFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました。',
      });
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleProviderChange = (nextProvider: AiProviderSelection) => {
    if (nextProvider === 'auto') {
      updateAiConfig({ provider: 'auto' });
      setCustomModelMode(false);
      return;
    }
    const meta = getProviderMeta(nextProvider);
    const srvDefault = serverStatus?.defaults[nextProvider];
    const nextModel = srvDefault?.model || meta.defaultModel;
    setCustomModelMode(false);
    updateAiConfig({
      provider: nextProvider,
      model: nextModel,
      location:
        nextProvider === 'vertex_project'
          ? aiConfig.location || srvDefault?.location || meta.defaultLocation || 'global'
          : aiConfig.location,
      baseUrl:
        meta.needsBaseUrl || meta.optionalBaseUrl
          ? srvDefault?.baseUrl || meta.defaultBaseUrl || ''
          : aiConfig.baseUrl,
    });
  };

  const handleTestConnection = async () => {
    setIsTestingAi(true);
    setAiTestFeedback(null);
    try {
      if (serverAvailable && !isNativeMobileRuntime()) {
        const response = await fetch('/api/ai-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiConfig }),
        });
        const data = (await response.json()) as {
          ok?: boolean;
          provider?: string;
          model?: string;
          error?: string;
        };
        if (response.ok && data.ok) {
          setAiTestFeedback({
            ok: true,
            message: `接続成功: ${data.provider} (${data.model})`,
          });
        } else {
          setAiTestFeedback({
            ok: false,
            message: data.error || '接続テストに失敗しました。',
          });
        }
      } else {
        const res = await testAiDirect(aiConfig);
        setAiTestFeedback({
          ok: true,
          message: `端末から直接接続成功: ${res.provider} (${res.model})`,
        });
      }
    } catch (err) {
      setAiTestFeedback({
        ok: false,
        message: err instanceof Error ? err.message : '接続テストに失敗しました。',
      });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveToEnv = async () => {
    if (!serverAvailable || aiConfig.provider === 'auto') return;
    setIsSavingEnv(true);
    setAiTestFeedback(null);
    try {
      const response = await fetch('/api/ai-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiConfig }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        status?: AiServerStatus;
        error?: string;
      };
      if (response.ok && data.ok) {
        if (data.status) setServerStatus(data.status);
        setAiTestFeedback({
          ok: true,
          message: 'サーバーの .env に設定を保存しました（再起動不要で反映済み）。',
        });
      } else {
        setAiTestFeedback({
          ok: false,
          message: data.error || '.env への保存に失敗しました。',
        });
      }
    } catch {
      setAiTestFeedback({
        ok: false,
        message: '.env 保存リクエストに失敗しました。',
      });
    } finally {
      setIsSavingEnv(false);
    }
  };

  const analyzeSingleImage = async (
    base64: string,
    mimeType: string
  ): Promise<ParsedResponseWithMeta> => {
    const registeredApps = apps.map((a) => ({
      id: a.id,
      name: a.name,
      unit: a.unit,
      pointsPerYen: a.pointsPerYen,
    }));

    if (serverAvailable && !isNativeMobileRuntime()) {
      const response = await fetch('/api/parse-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          aiConfig,
          registeredApps,
        }),
      });
      const data = (await response.json()) as ParsedResponseWithMeta;
      if (!response.ok) {
        throw new Error(data.error || 'スクリーンショットの解析に失敗しました。');
      }
      return data;
    }

    return parseScreenshotDirect({
      imageBase64: base64,
      mimeType,
      registeredApps,
      aiConfig,
    });
  };

  const analyzeFiles = async (inputFiles: File[]) => {
    const imageFiles = inputFiles.filter((f) => f.type.startsWith('image/')).slice(0, 8);
    if (imageFiles.length === 0) {
      setErrorMsg('PNG / JPG / WebP などの画像ファイルを選択してください。');
      return;
    }

    setErrorMsg('');
    setResult(null);
    setIsAnalyzing(true);

    try {
      const encoded = await Promise.all(imageFiles.map((f) => fileToBase64(f)));
      setPreviewUrls(encoded.map((e) => e.dataUrl));

      const results: ParsedResponseWithMeta[] = [];
      for (let i = 0; i < encoded.length; i++) {
        setProgressText(
          encoded.length > 1
            ? `${i + 1} / ${encoded.length} 枚目を解析しています...`
            : 'スクリーンショットからポイント・案件を読み取っています...'
        );
        const parsed = await analyzeSingleImage(encoded[i].base64, encoded[i].mimeType);
        results.push(parsed);
      }

      const primary = results[0];
      const mergedSummary =
        results.length === 1
          ? primary.summary
          : results.map((r, idx) => `[${idx + 1}] ${r.summary}`).join(' / ');

      const merged: ParsedResponseWithMeta = {
        ...primary,
        summary: mergedSummary,
      };
      setResult(merged);
      setParsedCount(results.length);

      // Match app by returned ID or fallback name search
      const matchedById = apps.find((a) =>
        results.some((r) => r.matchedAppId && a.id === r.matchedAppId)
      );
      const matchedByName = !matchedById
        ? apps.find((a) =>
            results.some(
              (r) =>
                r.detectedAppName &&
                (a.name.includes(r.detectedAppName) || r.detectedAppName.includes(a.name))
            )
          )
        : undefined;
      const resolvedAppId = matchedById?.id || matchedByName?.id || apps[0]?.id || '';
      setTargetAppId(resolvedAppId);

      const confirmedCandidate = results.find(
        (r) => typeof r.confirmedBalance === 'number' && r.confirmedBalance >= 0
      );
      setApplyConfirmed(Boolean(confirmedCandidate));
      setConfirmedInput(confirmedCandidate ? String(confirmedCandidate.confirmedBalance) : '0');

      const pendingCandidate = results.find(
        (r) => typeof r.pendingBalance === 'number' && r.pendingBalance >= 0
      );
      setApplyPending(Boolean(pendingCandidate));
      setPendingInput(pendingCandidate ? String(pendingCandidate.pendingBalance) : '0');

      const expiryCandidate = results.find(
        (r) => Boolean(r.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(r.expiryDate))
      );
      setApplyExpiry(Boolean(expiryCandidate));
      setExpiryInput(expiryCandidate?.expiryDate || '');

      // Merge & deduplicate transactions across batch + existing ledger
      const seenBatchKeys = new Set<string>();
      const normalizedTxs: EditableParsedTx[] = [];
      for (const r of results) {
        if (!Array.isArray(r.transactions)) continue;
        for (const t of r.transactions) {
          if (!t || !t.title || Number(t.points) <= 0) continue;
          const points = Math.max(1, Math.round(Number(t.points) || 0));
          const type: TransactionType =
            t.type === 'pending' || t.type === 'exchanged' || t.type === 'earned'
              ? t.type
              : 'earned';
          const date =
            typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
              ? t.date
              : getTodayStr();
          const title = String(t.title).trim();
          const batchKey = `${date}|${points}|${normalizeTitle(title)}`;
          const dupInBatch = seenBatchKeys.has(batchKey);
          seenBatchKeys.add(batchKey);

          const dupInLedger = isLikelyDuplicateTx(
            { title, points, date, type },
            existingTransactions,
            resolvedAppId
          );
          const isDuplicate = dupInBatch || dupInLedger;

          normalizedTxs.push({
            selected: !isDuplicate,
            isDuplicate,
            title,
            points,
            type,
            date,
            exchangeTarget: t.exchangeTarget || undefined,
            note: t.note || undefined,
          });
        }
      }
      setEditableTxs(normalizedTxs);

      // Merge extracted reminders
      const normalizedReminders: EditableParsedReminder[] = [];
      for (const r of results) {
        if (!Array.isArray(r.reminders)) continue;
        for (const rem of r.reminders) {
          if (!rem || !rem.title) continue;
          const kind: ReminderKind =
            rem.kind === 'cancellation' || rem.kind === 'condition' || rem.kind === 'campaign'
              ? rem.kind
              : 'condition';
          const dueDate =
            typeof rem.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rem.dueDate)
              ? rem.dueDate
              : getTodayStr();
          normalizedReminders.push({
            selected: true,
            title: String(rem.title).trim(),
            kind,
            dueDate,
            actionDetail: String(rem.actionDetail || rem.title).trim(),
            riskOrRewardText: rem.riskOrRewardText || undefined,
          });
        }
      }
      setEditableReminders(normalizedReminders);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : '解析中にエラーが発生しました。ネットワークや設定を確認してください。'
      );
    } finally {
      setIsAnalyzing(false);
      setProgressText('');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void analyzeFiles(files);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) void analyzeFiles(files);
  };

  const selectedApp = apps.find((a) => a.id === targetAppId) ?? apps[0];
  const selectedTxCount = editableTxs.filter((t) => t.selected).length;
  const selectedReminderCount = editableReminders.filter((r) => r.selected).length;
  const duplicateCount = editableTxs.filter((t) => t.isDuplicate).length;
  const canApply =
    Boolean(selectedApp) &&
    (applyConfirmed ||
      applyPending ||
      applyExpiry ||
      selectedTxCount > 0 ||
      selectedReminderCount > 0);

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
      reminders: editableReminders
        .filter((r) => r.selected && r.title.trim())
        .map((r) => ({
          appId: selectedApp.id,
          title: r.title.trim(),
          kind: r.kind,
          dueDate: r.dueDate || getTodayStr(),
          actionDetail: r.actionDetail.trim() || r.title.trim(),
          riskOrRewardText: r.riskOrRewardText?.trim() || undefined,
        })),
    });
    onClose();
  };

  const selectedMeta =
    aiConfig.provider !== 'auto' ? getProviderMeta(aiConfig.provider) : null;
  const selectedServerDefault =
    aiConfig.provider !== 'auto' ? serverStatus?.defaults[aiConfig.provider] : undefined;
  const availableModelsForSelected = (() => {
    if (!selectedMeta) return [];
    const live = discoveredModels[selectedMeta.id] || [];
    if (live.length === 0) return selectedMeta.models;
    const seen = new Set(selectedMeta.models.map((m) => m.id));
    return [...selectedMeta.models, ...live.filter((m) => !seen.has(m.id))];
  })();
  const selectedModelValue =
    (aiConfig.provider !== 'auto' && aiConfig.model) ||
    selectedServerDefault?.model ||
    selectedMeta?.defaultModel ||
    '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="screenshot-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 min-w-0">
            <ScanLine className="w-4 h-4 text-slate-900 shrink-0" />
            <h2 id="screenshot-modal-title" className="text-base font-semibold text-slate-900 truncate">
              スクリーンショットから自動読み取り
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                settingsOpen
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : hasActiveCredentials
                    ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>AI設定</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Active AI Provider Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  hasActiveCredentials ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {hasActiveCredentials && activeProviderMeta ? (
                <span className="text-slate-700 truncate">
                  接続先:{' '}
                  <strong className="font-semibold text-slate-900">
                    {activeProviderMeta.shortLabel}
                  </strong>{' '}
                  <span className="font-mono text-[11px] text-slate-500">
                    ({effectiveModelLabel})
                  </span>
                  {aiConfig.provider === 'auto' && (
                    <span className="ml-1.5 text-[11px] text-slate-400">[.env 自動]</span>
                  )}
                </span>
              ) : (
                <span className="text-amber-800 font-medium">
                  AI API が未設定です。「AI設定」から API キー等を設定してください。
                </span>
              )}
            </div>
            {!settingsOpen && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="text-[11px] font-medium text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                変更・テスト
              </button>
            )}
          </div>

          {/* Expandable AI Provider Settings Panel */}
          {settingsOpen && (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900">
                  AI プロバイダー・APIキー設定
                </p>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  閉じる
                </button>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="ai-provider-select"
                  className="block text-[11px] font-medium text-slate-700"
                >
                  プロバイダー
                </label>
                <select
                  id="ai-provider-select"
                  value={aiConfig.provider}
                  onChange={(e) => handleProviderChange(e.target.value as AiProviderSelection)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                >
                  {serverAvailable && !isNativeMobileRuntime() && (
                    <option value="auto">
                      自動（サーバーの .env 設定を使用
                      {serverStatus?.preferredProvider
                        ? `: ${getProviderMeta(serverStatus.preferredProvider).shortLabel}`
                        : ': 未設定'}
                      ）
                    </option>
                  )}
                  {AI_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {serverStatus?.defaults[p.id]?.hasCredentials ? ' [✓ .env設定済]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedMeta && (
                <div className="space-y-3 pt-1">
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {selectedMeta.description}
                  </p>

                  {selectedMeta.note && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                      {selectedMeta.note}
                    </div>
                  )}

                  {selectedMeta.needsProjectLocation && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label
                          htmlFor="ai-vertex-project"
                          className="block text-[11px] font-medium text-slate-700"
                        >
                          GCP プロジェクトID
                        </label>
                        <input
                          id="ai-vertex-project"
                          type="text"
                          value={aiConfig.project || ''}
                          onChange={(e) => updateAiConfig({ project: e.target.value })}
                          placeholder={selectedServerDefault?.project || 'my-gcp-project-id'}
                          className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="ai-vertex-location"
                          className="block text-[11px] font-medium text-slate-700"
                        >
                          ロケーション
                        </label>
                        <input
                          id="ai-vertex-location"
                          type="text"
                          list="vertex-location-presets"
                          value={aiConfig.location ?? ''}
                          onChange={(e) => updateAiConfig({ location: e.target.value })}
                          placeholder={selectedServerDefault?.location || 'global'}
                          className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
                        />
                        <datalist id="vertex-location-presets">
                          <option value="global" />
                          <option value="us" />
                          <option value="eu" />
                          <option value="us-central1" />
                          <option value="asia-northeast1" />
                        </datalist>
                      </div>
                    </div>
                  )}

                  {selectedMeta.needsApiKey && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="ai-api-key"
                          className="block text-[11px] font-medium text-slate-700"
                        >
                          API キー{selectedMeta.apiKeyOptional ? '（任意）' : ''}
                        </label>
                        {selectedServerDefault?.hasCredentials && (
                          <span className="text-[10px] text-emerald-700 font-medium">
                            空欄時はサーバーの .env キーを使用
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          id="ai-api-key"
                          type={showApiKey ? 'text' : 'password'}
                          value={aiConfig.apiKey || ''}
                          onChange={(e) => updateAiConfig({ apiKey: e.target.value })}
                          placeholder={selectedMeta.apiKeyPlaceholder || 'APIキーを入力'}
                          autoComplete="off"
                          className="w-full pl-3 pr-9 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          aria-label={showApiKey ? 'APIキーを隠す' : 'APIキーを表示'}
                        >
                          {showApiKey ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {(selectedMeta.needsBaseUrl || selectedMeta.optionalBaseUrl) && (
                    <div className="space-y-1">
                      <label
                        htmlFor="ai-base-url"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        Base URL{selectedMeta.optionalBaseUrl ? '（任意 / 既定値で可）' : ''}
                      </label>
                      <input
                        id="ai-base-url"
                        type="url"
                        value={aiConfig.baseUrl || ''}
                        onChange={(e) => updateAiConfig({ baseUrl: e.target.value })}
                        placeholder={
                          selectedServerDefault?.baseUrl || selectedMeta.baseUrlPlaceholder
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                  )}

                  {/* Model selector + live fetch + custom input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="ai-model-select"
                        className="block text-[11px] font-medium text-slate-700"
                      >
                        モデル
                      </label>
                      <div className="flex items-center gap-3">
                        {(selectedMeta.id === 'opencode' ||
                          selectedMeta.id === 'opencode_go' ||
                          selectedMeta.id === 'gemini' ||
                          selectedMeta.id === 'openai' ||
                          selectedMeta.id === 'openai_compatible') && (
                          <button
                            type="button"
                            disabled={isLoadingModels}
                            onClick={() => void handleFetchModels(selectedMeta.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-700 hover:text-slate-900 underline disabled:opacity-50 cursor-pointer"
                          >
                            {isLoadingModels ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            <span>モデル一覧を取得</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setCustomModelMode((v) => !v)}
                          className="text-[11px] text-slate-600 hover:text-slate-900 underline cursor-pointer"
                        >
                          {customModelMode ? '一覧から選ぶ' : 'モデルIDを手入力する'}
                        </button>
                      </div>
                    </div>
                    {customModelMode ? (
                      <input
                        id="ai-model-select"
                        type="text"
                        value={aiConfig.model || ''}
                        onChange={(e) => updateAiConfig({ model: e.target.value })}
                        placeholder={selectedMeta.defaultModel}
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900"
                      />
                    ) : (
                      <select
                        id="ai-model-select"
                        value={
                          availableModelsForSelected.some((m) => m.id === selectedModelValue)
                            ? selectedModelValue
                            : '__custom__'
                        }
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setCustomModelMode(true);
                          } else {
                            updateAiConfig({ model: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                      >
                        {availableModelsForSelected.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} ({m.id})
                          </option>
                        ))}
                        {!availableModelsForSelected.some((m) => m.id === selectedModelValue) &&
                          selectedModelValue && (
                            <option value="__custom__">カスタム: {selectedModelValue}</option>
                          )}
                      </select>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  設定は端末内に自動保存されます。
                </p>
                <div className="flex items-center gap-2">
                  {serverAvailable && !isNativeMobileRuntime() && aiConfig.provider !== 'auto' && (
                    <button
                      type="button"
                      disabled={isSavingEnv}
                      onClick={() => void handleSaveToEnv()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingEnv ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>.env に保存</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isTestingAi}
                    onClick={() => void handleTestConnection()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                  >
                    {isTestingAi ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlugZap className="w-3.5 h-3.5" />
                    )}
                    <span>接続テスト</span>
                  </button>
                </div>
              </div>

              {aiTestFeedback && (
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                    aiTestFeedback.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {aiTestFeedback.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{aiTestFeedback.message}</span>
                </div>
              )}
            </div>
          )}

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
                multiple
                onChange={handleFileChange}
                className="hidden"
              />

              {isAnalyzing ? (
                <div className="py-4 flex flex-col items-center gap-3">
                  {previewUrls.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {previewUrls.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`解析中のスクリーンショット ${idx + 1}`}
                          className="max-h-36 rounded-lg border border-slate-200 object-contain"
                        />
                      ))}
                    </div>
                  )}
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progressText || 'スクリーンショットを読み取っています...'}</span>
                  </div>
                  <p className="text-xs text-slate-500">1枚あたり通常 2〜5 秒ほどで完了します</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-700">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      ポイ活アプリのスクショをドロップ（複数枚一括OK）
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      残高画面・通帳履歴・条件ページなど最大 8 枚までまとめて解析できます（Ctrl+V 貼付も対応）
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
                    対応例: モッピー・ハピタス・ポイントインカム・トリマ・楽天ポイント等のマイページ / 通帳 / 案件詳細画面
                  </p>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Review Parsed Result */}
          {result && (
            <div className="space-y-5">
              {/* Top Preview & Summary */}
              <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                {previewUrls.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap sm:w-32 shrink-0">
                    {previewUrls.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`スクリーンショット ${idx + 1}`}
                        className={`${
                          previewUrls.length === 1 ? 'w-full max-h-36' : 'w-14 h-14'
                        } rounded-lg border border-slate-200 object-cover bg-white`}
                      />
                    ))}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">
                      検出アプリ: {result.detectedAppName || '不明'}
                      {parsedCount > 1 && (
                        <span className="ml-1.5 text-[11px] font-normal text-slate-500">
                          （{parsedCount} 枚一括解析）
                        </span>
                      )}
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
                    内容を確認・修正してから「選択した内容を反映する」を押してください。
                    {result._meta && (
                      <span className="ml-2 font-mono">
                        [{result._meta.provider} / {result._meta.model}]
                      </span>
                    )}
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">
                      検出された履歴・案件（{selectedTxCount} / {editableTxs.length} 件選択中）
                    </p>
                    {duplicateCount > 0 && (
                      <span className="text-[11px] text-amber-700 font-medium">
                        重複候補 {duplicateCount} 件を自動除外済み
                      </span>
                    )}
                  </div>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                    {editableTxs.map((tx, idx) => (
                      <div
                        key={idx}
                        className={`p-3 flex items-start gap-3 ${
                          tx.isDuplicate ? 'bg-amber-50/40' : ''
                        }`}
                      >
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

                        <div className="flex-1 space-y-1.5">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
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
                              className="sm:col-span-5 px-2 py-1 text-xs border border-slate-200 rounded bg-white"
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
                              className="sm:col-span-2 px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded bg-white"
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
                              className="sm:col-span-3 px-1.5 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded bg-white"
                            />
                          </div>
                          {tx.isDuplicate && (
                            <p className="text-[10px] font-medium text-amber-700">
                              ※ 既存の履歴と一致するため重複候補としてチェックを外しています
                            </p>
                          )}
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

              {/* Extracted Reminders */}
              {editableReminders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5" />
                    <span>
                      検出された条件・解約期限（{selectedReminderCount} / {editableReminders.length} 件選択中）
                    </span>
                  </p>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {editableReminders.map((rem, idx) => (
                      <div key={idx} className="p-3 flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setEditableReminders((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, selected: !item.selected } : item
                              )
                            )
                          }
                          className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                            rem.selected
                              ? 'bg-slate-900 border-slate-900 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {rem.selected && <Check className="w-3 h-3" />}
                        </button>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <input
                            type="text"
                            value={rem.title}
                            onChange={(e) =>
                              setEditableReminders((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, title: e.target.value } : item
                                )
                              )
                            }
                            className="sm:col-span-6 px-2 py-1 text-xs border border-slate-200 rounded"
                          />
                          <select
                            value={rem.kind}
                            onChange={(e) =>
                              setEditableReminders((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, kind: e.target.value as ReminderKind }
                                    : item
                                )
                              )
                            }
                            className="sm:col-span-3 px-1.5 py-1 text-xs border border-slate-200 rounded bg-white"
                          >
                            <option value="cancellation">解約期限</option>
                            <option value="condition">達成条件</option>
                            <option value="campaign">キャンペーン</option>
                          </select>
                          <input
                            type="date"
                            value={rem.dueDate}
                            onChange={(e) =>
                              setEditableReminders((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, dueDate: e.target.value } : item
                                )
                              )
                            }
                            className="sm:col-span-3 px-1.5 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
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
