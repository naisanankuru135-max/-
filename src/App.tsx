import { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Plus, ScanLine } from 'lucide-react';
import {
  ActiveTab,
  DailyRoutine,
  DealReminder,
  PoikatsuApp,
  PoikatsuStoreData,
  PointTransaction,
  TransactionType,
} from './types/poikatsu';
import {
  createEmptyData,
  createInitialData,
  getTodayStr,
  isUntouchedSampleData,
  pointsToYen,
  PRESET_APP_TEMPLATES,
} from './data/presets';
import { isNativeMobileRuntime } from './lib/directAiClient';
import {
  AppUpdateInfo,
  UPDATE_LAST_CHECK_KEY,
  checkForAppUpdate,
  installAppUpdate,
} from './lib/appUpdater';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { AppsView } from './components/AppsView';
import { LedgerView } from './components/LedgerView';
import { RemindersView } from './components/RemindersView';
import { ExchangeSimulatorView } from './components/ExchangeSimulatorView';
import { RoutineView } from './components/RoutineView';
import { TransactionModal } from './components/TransactionModal';
import { AppFormModal } from './components/AppFormModal';
import { BackupModal } from './components/BackupModal';
import {
  ScreenshotApplyPayload,
  ScreenshotImportModal,
} from './components/ScreenshotImportModal';

const STORAGE_KEY = 'poicho_store_v1';

function migratePresetIcons(apps: PoikatsuApp[]): PoikatsuApp[] {
  const presetByName = new Map(PRESET_APP_TEMPLATES.map((p) => [p.name, p.iconUrl]));
  return apps.map((app) => {
    if (app.iconUrl?.startsWith('data:image/svg+xml')) {
      const officialUrl = presetByName.get(app.name);
      if (officialUrl) return { ...app, iconUrl: officialUrl };
    }
    return app;
  });
}

function loadInitialStore(): PoikatsuStoreData {
  const empty = createEmptyData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PoikatsuStoreData>;
    if (!Array.isArray(parsed.apps) || !Array.isArray(parsed.transactions)) {
      return empty;
    }
    if (isUntouchedSampleData(parsed)) {
      return empty;
    }
    return {
      apps: migratePresetIcons(parsed.apps),
      transactions: parsed.transactions,
      routines: Array.isArray(parsed.routines) ? parsed.routines : [],
      reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [],
      monthlyGoalYen: Number(parsed.monthlyGoalYen) || 10000,
    };
  } catch {
    return empty;
  }
}

const TAB_LABELS: Record<ActiveTab, string> = {
  dashboard: 'ダッシュボード',
  apps: 'アプリ一覧',
  ledger: '案件・履歴',
  reminders: '条件・解約期限',
  simulator: '交換シミュレーター',
  routine: '毎日ルーティン',
};

export default function App() {
  const [store, setStore] = useState<PoikatsuStoreData>(() => loadInitialStore());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txDefaultAppId, setTxDefaultAppId] = useState<string | undefined>(undefined);
  const [txDefaultType, setTxDefaultType] = useState<TransactionType>('earned');
  const [txDefaultExchangeTarget, setTxDefaultExchangeTarget] = useState<string | undefined>(
    undefined
  );

  const [appModalOpen, setAppModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<PoikatsuApp | null>(null);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [screenshotModalOpen, setScreenshotModalOpen] = useState(false);

  // Cross-view ledger filter
  const [ledgerAppFilter, setLedgerAppFilter] = useState<string>('');

  // Transient feedback toast
  const [toast, setToast] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateInfo | null>(null);
  const [installingApk, setInstallingApk] = useState(false);
  const serverSyncReadyRef = useRef(false);
  const skipNextServerPushRef = useRef(false);

  // Silent background check for APK updates (at most once per 12h)
  useEffect(() => {
    if (!isNativeMobileRuntime()) return;
    try {
      const last = Number(localStorage.getItem(UPDATE_LAST_CHECK_KEY) || 0);
      if (Date.now() - last < 12 * 60 * 60 * 1000) return;
      localStorage.setItem(UPDATE_LAST_CHECK_KEY, String(Date.now()));
    } catch {
      // Ignore
    }
    checkForAppUpdate()
      .then((info) => {
        if (info.hasUpdate) setAvailableUpdate(info);
      })
      .catch(() => {});
  }, []);

  // Sync with PC server file store (data/store.json) when available; fallback silently to localStorage on mobile APK
  useEffect(() => {
    if (isNativeMobileRuntime()) return;
    let cancelled = false;
    fetch('/api/store')
      .then((res) => (res.ok ? (res.json() as Promise<{ exists?: boolean; data?: Partial<PoikatsuStoreData> }>) : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        if (
          payload.exists &&
          payload.data &&
          Array.isArray(payload.data.apps) &&
          Array.isArray(payload.data.transactions)
        ) {
          skipNextServerPushRef.current = true;
          setStore({
            apps: payload.data.apps,
            transactions: payload.data.transactions,
            routines: Array.isArray(payload.data.routines) ? payload.data.routines : [],
            reminders: Array.isArray(payload.data.reminders) ? payload.data.reminders : [],
            monthlyGoalYen: Number(payload.data.monthlyGoalYen) || 15000,
          });
        } else {
          // Seed server file from current localStorage/default store
          void fetch('/api/store', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(store),
          }).catch(() => {});
        }
        serverSyncReadyRef.current = true;
      })
      .catch(() => {
        // Running as static bundle without Express server
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore storage quota errors gracefully
    }

    if (isNativeMobileRuntime() || !serverSyncReadyRef.current) return;
    if (skipNextServerPushRef.current) {
      skipNextServerPushRef.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      void fetch('/api/store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      }).catch(() => {});
    }, 350);
    return () => window.clearTimeout(timer);
  }, [store]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  const sidebarMetrics = useMemo(() => {
    const today = getTodayStr();
    const appMap = new Map(store.apps.map((a) => [a.id, a]));
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let thisMonthYen = 0;
    let pendingCount = 0;

    store.transactions.forEach((tx) => {
      if (tx.type === 'pending') pendingCount += 1;
      if (tx.date.startsWith(monthPrefix) && (tx.type === 'earned' || tx.type === 'pending')) {
        const app = appMap.get(tx.appId);
        thisMonthYen += pointsToYen(tx.points, app?.pointsPerYen ?? 1);
      }
    });

    const routineRemainingCount = store.routines.filter(
      (r) => !r.completedDates.includes(today)
    ).length;

    const upcomingReminderCount = store.reminders.filter((r) => !r.completed).length;

    return { thisMonthYen, pendingCount, routineRemainingCount, upcomingReminderCount };
  }, [store]);

  // Handlers
  const openTransactionModal = (
    appId?: string,
    defaultType: TransactionType = 'earned',
    exchangeTarget?: string
  ) => {
    setTxDefaultAppId(appId);
    setTxDefaultType(defaultType);
    setTxDefaultExchangeTarget(exchangeTarget);
    setTxModalOpen(true);
  };

  const openAddAppModal = () => {
    setEditingApp(null);
    setAppModalOpen(true);
  };

  const openEditAppModal = (app: PoikatsuApp) => {
    setEditingApp(app);
    setAppModalOpen(true);
  };

  const handleSaveApp = (payload: Omit<PoikatsuApp, 'id'>, existingId?: string) => {
    setStore((prev) => {
      if (existingId) {
        return {
          ...prev,
          apps: prev.apps.map((a) => (a.id === existingId ? { ...payload, id: existingId } : a)),
        };
      }
      const newApp: PoikatsuApp = {
        ...payload,
        id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      return {
        ...prev,
        apps: [newApp, ...prev.apps],
      };
    });
    showToast(existingId ? `${payload.name} の設定を更新しました` : `${payload.name} を追加しました`);
  };

  const handleDeleteApp = (appId: string) => {
    const target = store.apps.find((a) => a.id === appId);
    setStore((prev) => ({
      ...prev,
      apps: prev.apps.filter((a) => a.id !== appId),
      routines: prev.routines.filter((r) => r.appId !== appId),
      reminders: prev.reminders.filter((r) => r.appId !== appId),
    }));
    if (target) showToast(`${target.name} を削除しました`);
  };

  const handleAddTransaction = (txPayload: Omit<PointTransaction, 'id'>) => {
    const newTx: PointTransaction = {
      ...txPayload,
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };

    setStore((prev) => ({
      ...prev,
      transactions: [newTx, ...prev.transactions],
      apps: prev.apps.map((app) => {
        if (app.id !== txPayload.appId) return app;
        if (txPayload.type === 'earned') {
          return { ...app, confirmedPoints: app.confirmedPoints + txPayload.points };
        }
        if (txPayload.type === 'pending') {
          return { ...app, pendingPoints: app.pendingPoints + txPayload.points };
        }
        return {
          ...app,
          confirmedPoints: Math.max(0, app.confirmedPoints - txPayload.points),
        };
      }),
    }));

    const label =
      txPayload.type === 'earned'
        ? 'ポイント獲得を記録しました'
        : txPayload.type === 'pending'
          ? '判定中案件を登録しました'
          : 'ポイント交換を記録しました';
    showToast(label);
  };

  const handleApproveTransaction = (txId: string) => {
    const target = store.transactions.find((t) => t.id === txId);
    if (!target || target.type !== 'pending') return;

    setStore((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === txId ? { ...t, type: 'earned', expectedApprovalDate: undefined } : t
      ),
      apps: prev.apps.map((app) => {
        if (app.id !== target.appId) return app;
        return {
          ...app,
          confirmedPoints: app.confirmedPoints + target.points,
          pendingPoints: Math.max(0, app.pendingPoints - target.points),
        };
      }),
    }));
    showToast(`「${target.title}」を確定ポイントへ反映しました`);
  };

  const handleDeleteTransaction = (txId: string) => {
    const target = store.transactions.find((t) => t.id === txId);
    if (!target) return;

    setStore((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== txId),
      apps: prev.apps.map((app) => {
        if (app.id !== target.appId) return app;
        if (target.type === 'earned') {
          return { ...app, confirmedPoints: Math.max(0, app.confirmedPoints - target.points) };
        }
        if (target.type === 'pending') {
          return { ...app, pendingPoints: Math.max(0, app.pendingPoints - target.points) };
        }
        return { ...app, confirmedPoints: app.confirmedPoints + target.points };
      }),
    }));
    showToast('履歴を削除し、残高を調整しました');
  };

  const handleToggleRoutine = (routineId: string, creditPoints: boolean) => {
    const today = getTodayStr();
    const target = store.routines.find((r) => r.id === routineId);
    if (!target) return;

    const alreadyDone = target.completedDates.includes(today);

    setStore((prev) => ({
      ...prev,
      routines: prev.routines.map((r) => {
        if (r.id !== routineId) return r;
        return {
          ...r,
          completedDates: alreadyDone
            ? r.completedDates.filter((d) => d !== today)
            : [...r.completedDates, today],
        };
      }),
      apps:
        creditPoints && target.rewardPoints > 0
          ? prev.apps.map((app) => {
              if (app.id !== target.appId) return app;
              const delta = alreadyDone ? -target.rewardPoints : target.rewardPoints;
              return { ...app, confirmedPoints: Math.max(0, app.confirmedPoints + delta) };
            })
          : prev.apps,
    }));
  };

  const handleAddRoutine = (payload: Omit<DailyRoutine, 'id' | 'completedDates'>) => {
    const newRoutine: DailyRoutine = {
      ...payload,
      id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      completedDates: [],
    };
    setStore((prev) => ({
      ...prev,
      routines: [newRoutine, ...prev.routines],
    }));
    showToast('毎日ルーティンを追加しました');
  };

  const handleDeleteRoutine = (routineId: string) => {
    setStore((prev) => ({
      ...prev,
      routines: prev.routines.filter((r) => r.id !== routineId),
    }));
  };

  const handleToggleReminder = (reminderId: string) => {
    const target = store.reminders.find((r) => r.id === reminderId);
    setStore((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === reminderId ? { ...r, completed: !r.completed } : r
      ),
    }));
    if (target) {
      showToast(
        target.completed
          ? `「${target.title}」を未完了に戻しました`
          : `「${target.title}」を完了にしました`
      );
    }
  };

  const handleAddReminder = (payload: Omit<DealReminder, 'id' | 'completed'>) => {
    const newReminder: DealReminder = {
      ...payload,
      id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      completed: false,
    };
    setStore((prev) => ({
      ...prev,
      reminders: [newReminder, ...prev.reminders],
    }));
    showToast('条件・解約期限リマインダーを登録しました');
  };

  const handleDeleteReminder = (reminderId: string) => {
    setStore((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((r) => r.id !== reminderId),
    }));
    showToast('リマインダーを削除しました');
  };

  const handleApplyScreenshot = (payload: ScreenshotApplyPayload) => {
    const newTxs: PointTransaction[] = payload.transactions.map((t, idx) => ({
      ...t,
      id: `tx-ai-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
    }));

    const newReminders: DealReminder[] = (payload.reminders ?? []).map((r, idx) => ({
      ...r,
      id: `rem-ai-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      completed: false,
    }));

    setStore((prev) => ({
      ...prev,
      transactions: [...newTxs, ...prev.transactions],
      reminders: [...newReminders, ...prev.reminders],
      apps: prev.apps.map((app) => {
        if (app.id !== payload.appId) return app;
        let nextConfirmed = app.confirmedPoints;
        let nextPending = app.pendingPoints;

        if (payload.updateConfirmedBalance !== undefined) {
          nextConfirmed = payload.updateConfirmedBalance;
        } else {
          // Only adjust confirmed balance by transactions if balance wasn't explicitly overwritten
          newTxs.forEach((tx) => {
            if (tx.type === 'earned') nextConfirmed += tx.points;
            if (tx.type === 'exchanged') nextConfirmed = Math.max(0, nextConfirmed - tx.points);
          });
        }

        if (payload.updatePendingBalance !== undefined) {
          nextPending = payload.updatePendingBalance;
        } else {
          newTxs.forEach((tx) => {
            if (tx.type === 'pending') nextPending += tx.points;
          });
        }

        return {
          ...app,
          confirmedPoints: nextConfirmed,
          pendingPoints: nextPending,
          expiryDate: payload.updateExpiryDate || app.expiryDate,
        };
      }),
    }));

    const parts: string[] = [];
    if (payload.updateConfirmedBalance !== undefined || payload.updatePendingBalance !== undefined) {
      parts.push('残高を更新');
    }
    if (newTxs.length > 0) {
      parts.push(`履歴 ${newTxs.length} 件を追加`);
    }
    if (newReminders.length > 0) {
      parts.push(`期限リマインダー ${newReminders.length} 件を追加`);
    }
    showToast(`スクショ読取結果を反映しました（${parts.join('・') || '更新完了'}）`);
  };

  const handleFilterLedgerByApp = (appId: string) => {
    setLedgerAppFilter(appId);
    setActiveTab('ledger');
  };

  return (
    <div className="min-h-screen flex bg-[#F7F8FA] text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab !== 'ledger') setLedgerAppFilter('');
          setActiveTab(tab);
        }}
        appCount={store.apps.length}
        pendingCount={sidebarMetrics.pendingCount}
        upcomingReminderCount={sidebarMetrics.upcomingReminderCount}
        routineRemainingCount={sidebarMetrics.routineRemainingCount}
        thisMonthYen={sidebarMetrics.thisMonthYen}
        monthlyGoalYen={store.monthlyGoalYen}
        onOpenBackup={() => setBackupModalOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, at most 2 concise actions on right */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
              aria-label="メニューを開く"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="パンくずリスト" className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">ポイ帳</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-semibold text-slate-900 truncate">{TAB_LABELS[activeTab]}</h1>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setScreenshotModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>スクショ読取</span>
            </button>

            {activeTab === 'apps' ? (
              <button
                type="button"
                onClick={openAddAppModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                アプリを追加
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openTransactionModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                ポイント・案件を記録
              </button>
            )}
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-[1280px] w-full mx-auto">
          {availableUpdate && (
            <div className="mb-5 p-3.5 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                <span className="font-semibold">
                  新しいバージョン v{availableUpdate.latestVersion} が配信されています
                </span>
                {availableUpdate.releaseNotes && (
                  <span className="ml-2 text-slate-300 hidden sm:inline">
                    {availableUpdate.releaseNotes.slice(0, 60)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={installingApk}
                  onClick={async () => {
                    setInstallingApk(true);
                    try {
                      const res = await installAppUpdate(
                        availableUpdate.apkUrl,
                        availableUpdate.htmlUrl
                      );
                      if (res.status === 'needs_permission') {
                        showToast('不明なアプリのインストールを許可して再度お試しください');
                      } else if (res.status === 'installing') {
                        showToast('インストーラーを起動しました');
                      }
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : 'アップデートに失敗しました'
                      );
                    } finally {
                      setInstallingApk(false);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-900 rounded-lg hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                >
                  {installingApk ? 'ダウンロード中...' : '今すぐ更新'}
                </button>
                <button
                  type="button"
                  onClick={() => setAvailableUpdate(null)}
                  className="text-xs text-slate-400 hover:text-white px-1.5 cursor-pointer"
                >
                  後で
                </button>
              </div>
            </div>
          )}
          {activeTab === 'dashboard' && (
            <DashboardView
              apps={store.apps}
              transactions={store.transactions}
              reminders={store.reminders}
              monthlyGoalYen={store.monthlyGoalYen}
              onNavigate={setActiveTab}
              onQuickLog={(appId) => openTransactionModal(appId, 'earned')}
              onAddApp={openAddAppModal}
              onEditApp={openEditAppModal}
              onApproveTransaction={handleApproveTransaction}
              onToggleReminder={handleToggleReminder}
              onFilterLedgerByApp={handleFilterLedgerByApp}
            />
          )}

          {activeTab === 'apps' && (
            <AppsView
              apps={store.apps}
              onAddApp={openAddAppModal}
              onEditApp={openEditAppModal}
              onQuickLog={(appId, type) => openTransactionModal(appId, type)}
              onViewHistory={handleFilterLedgerByApp}
            />
          )}

          {activeTab === 'ledger' && (
            <LedgerView
              apps={store.apps}
              transactions={store.transactions}
              initialAppFilter={ledgerAppFilter}
              onClearInitialAppFilter={() => setLedgerAppFilter('')}
              onApproveTransaction={handleApproveTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenNewTransaction={(appId) => openTransactionModal(appId, 'earned')}
            />
          )}

          {activeTab === 'reminders' && (
            <RemindersView
              apps={store.apps}
              reminders={store.reminders}
              onToggleReminder={handleToggleReminder}
              onAddReminder={handleAddReminder}
              onDeleteReminder={handleDeleteReminder}
            />
          )}

          {activeTab === 'simulator' && (
            <ExchangeSimulatorView
              apps={store.apps}
              onRecordExchange={(appId, exchangeTarget) =>
                openTransactionModal(appId, 'exchanged', exchangeTarget)
              }
            />
          )}

          {activeTab === 'routine' && (
            <RoutineView
              apps={store.apps}
              routines={store.routines}
              onToggleRoutine={handleToggleRoutine}
              onAddRoutine={handleAddRoutine}
              onDeleteRoutine={handleDeleteRoutine}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <TransactionModal
        open={txModalOpen}
        apps={store.apps}
        defaultAppId={txDefaultAppId}
        defaultType={txDefaultType}
        defaultExchangeTarget={txDefaultExchangeTarget}
        onClose={() => setTxModalOpen(false)}
        onSubmit={handleAddTransaction}
      />

      <AppFormModal
        open={appModalOpen}
        editingApp={editingApp}
        existingApps={store.apps}
        onClose={() => setAppModalOpen(false)}
        onSave={handleSaveApp}
        onDelete={handleDeleteApp}
      />

      <BackupModal
        open={backupModalOpen}
        data={store}
        onClose={() => setBackupModalOpen(false)}
        onUpdateGoal={(goalYen) => setStore((prev) => ({ ...prev, monthlyGoalYen: goalYen }))}
        onImportData={(nextData) => setStore(nextData)}
        onResetEmpty={() => setStore(createEmptyData())}
        onLoadSample={() => setStore(createInitialData())}
      />

      <ScreenshotImportModal
        open={screenshotModalOpen}
        apps={store.apps}
        existingTransactions={store.transactions}
        onClose={() => setScreenshotModalOpen(false)}
        onApply={handleApplyScreenshot}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
