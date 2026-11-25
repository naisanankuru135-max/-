import {
  LayoutDashboard,
  Grid2x2,
  ReceiptText,
  BellRing,
  Calculator,
  CheckSquare,
  Database,
  X,
} from 'lucide-react';
import { ActiveTab } from '../types/poikatsu';
import { formatYen } from '../data/presets';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  appCount: number;
  pendingCount: number;
  upcomingReminderCount: number;
  routineRemainingCount: number;
  thisMonthYen: number;
  monthlyGoalYen: number;
  onOpenBackup: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  appCount,
  pendingCount,
  upcomingReminderCount,
  routineRemainingCount,
  thisMonthYen,
  monthlyGoalYen,
  onOpenBackup,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const goalRatio =
    monthlyGoalYen > 0 ? Math.min(100, Math.round((thisMonthYen / monthlyGoalYen) * 100)) : 0;

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: typeof LayoutDashboard;
    countText?: string;
  }[] = [
    { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { id: 'apps', label: 'アプリ一覧', icon: Grid2x2, countText: `${appCount}` },
    {
      id: 'ledger',
      label: '案件・履歴',
      icon: ReceiptText,
      countText: pendingCount > 0 ? `判定中 ${pendingCount}` : undefined,
    },
    {
      id: 'reminders',
      label: '条件・解約期限',
      icon: BellRing,
      countText: upcomingReminderCount > 0 ? `未完 ${upcomingReminderCount}` : undefined,
    },
    {
      id: 'simulator',
      label: '交換シミュレーター',
      icon: Calculator,
    },
    {
      id: 'routine',
      label: '毎日ルーティン',
      icon: CheckSquare,
      countText: routineRemainingCount > 0 ? `残 ${routineRemainingCount}` : '完了',
    },
  ];

  const handleNavClick = (id: ActiveTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64">
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick('dashboard')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
        >
          ポイ帳
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-2 -mr-2 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
          aria-label="メニューを閉じる"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="メインナビゲーション">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.countText && (
                <span
                  className={`text-xs font-mono tabular-nums shrink-0 ${
                    isActive ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {item.countText}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 space-y-4">
        <div>
          <div className="flex items-baseline justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">今月の獲得目標</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {goalRatio}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-900 rounded-full transition-all duration-300"
              style={{ width: `${goalRatio}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 mt-1.5">
            <span>{formatYen(thisMonthYen)}</span>
            <span>目標 {formatYen(monthlyGoalYen)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenBackup();
            onCloseMobile();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
        >
          <Database className="w-4 h-4 shrink-0" />
          <span>目標設定・バックアップ</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{sidebarContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
