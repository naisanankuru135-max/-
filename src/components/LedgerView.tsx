import { useMemo, useState } from 'react';
import {
  Search,
  Download,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Trash2,
  Plus,
} from 'lucide-react';
import { PoikatsuApp, PointTransaction, TransactionType } from '../types/poikatsu';
import { formatPoints, formatYen, pointsToYen } from '../data/presets';
import { AppIcon } from './AppIcon';

interface LedgerViewProps {
  apps: PoikatsuApp[];
  transactions: PointTransaction[];
  initialAppFilter: string;
  onClearInitialAppFilter: () => void;
  onApproveTransaction: (txId: string) => void;
  onDeleteTransaction: (txId: string) => void;
  onOpenNewTransaction: (appId?: string) => void;
}

export function LedgerView({
  apps,
  transactions,
  initialAppFilter,
  onClearInitialAppFilter,
  onApproveTransaction,
  onDeleteTransaction,
  onOpenNewTransaction,
}: LedgerViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [appFilter, setAppFilter] = useState<string>(initialAppFilter || 'all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const effectiveAppFilter = initialAppFilter || appFilter;

  const appMap = useMemo(() => {
    const map = new Map<string, PoikatsuApp>();
    apps.forEach((a) => map.set(a.id, a));
    return map;
  }, [apps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...transactions]
      .filter((tx) => {
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (effectiveAppFilter !== 'all' && tx.appId !== effectiveAppFilter) return false;
        if (q) {
          const appName = appMap.get(tx.appId)?.name.toLowerCase() ?? '';
          const match =
            tx.title.toLowerCase().includes(q) ||
            appName.includes(q) ||
            (tx.exchangeTarget || '').toLowerCase().includes(q) ||
            (tx.note || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, typeFilter, effectiveAppFilter, search, appMap]);

  const summary = useMemo(() => {
    let earnedYen = 0;
    let pendingYen = 0;
    let exchangedYen = 0;
    filtered.forEach((tx) => {
      const app = appMap.get(tx.appId);
      const yen = pointsToYen(tx.points, app?.pointsPerYen ?? 1);
      if (tx.type === 'earned') earnedYen += yen;
      if (tx.type === 'pending') pendingYen += yen;
      if (tx.type === 'exchanged') exchangedYen += yen;
    });
    return { earnedYen, pendingYen, exchangedYen };
  }, [filtered, appMap]);

  const handleSelectAppFilter = (id: string) => {
    if (initialAppFilter) onClearInitialAppFilter();
    setAppFilter(id);
  };

  const handleExportCsv = () => {
    const headers = ['日付', 'アプリ名', '種別', '案件・内容', 'ポイント数', '単位', '円換算', '交換先/承認予定日', 'メモ'];
    const typeLabels: Record<TransactionType, string> = {
      earned: '確定獲得',
      pending: '判定中',
      exchanged: '交換',
    };
    const rows = filtered.map((tx) => {
      const app = appMap.get(tx.appId);
      const yen = pointsToYen(tx.points, app?.pointsPerYen ?? 1);
      return [
        tx.date,
        app?.name ?? '不明',
        typeLabels[tx.type],
        tx.title,
        tx.type === 'exchanged' ? `-${tx.points}` : `${tx.points}`,
        app?.unit ?? 'P',
        tx.type === 'exchanged' ? `-${yen}` : `${yen}`,
        tx.type === 'exchanged' ? tx.exchangeTarget || '' : tx.expectedApprovalDate || '',
        tx.note || '',
      ]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(',');
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poicho-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeTabs: { id: 'all' | TransactionType; label: string }[] = [
    { id: 'all', label: 'すべて' },
    { id: 'earned', label: '確定' },
    { id: 'pending', label: '判定中' },
    { id: 'exchanged', label: '交換' },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
            {typeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  typeFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="案件名・アプリ・交換先を検索"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              CSV出力
            </button>
          </div>
        </div>

        {/* Visual App Selector Filter Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => handleSelectAppFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              effectiveAppFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            すべてのアプリ
          </button>
          {apps.map((app) => {
            const active = effectiveAppFilter === app.id;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => handleSelectAppFilter(app.id)}
                className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <AppIcon src={app.iconUrl} name={app.name} brandColor={app.brandColor} size="xs" />
                <span>{app.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtered Summary Strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 px-1">
        <span className="tabular-nums">表示件数 {filtered.length} 件</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          確定獲得 <strong className="font-mono text-emerald-700">+{formatYen(summary.earnedYen)}</strong>
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          判定中 <strong className="font-mono text-amber-700">+{formatYen(summary.pendingYen)}</strong>
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          交換済 <strong className="font-mono text-slate-900">{formatYen(summary.exchangedYen)}</strong>
        </span>
      </div>

      {/* High-density Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900">該当する案件・履歴がありません</p>
            <p className="text-xs text-slate-500 mt-1">
              フィルターを変更するか、新しいポイント獲得・交換履歴を記録してください。
            </p>
            <button
              type="button"
              onClick={() =>
                onOpenNewTransaction(effectiveAppFilter === 'all' ? undefined : effectiveAppFilter)
              }
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              ポイント・案件を記録
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 pl-5 pr-3 whitespace-nowrap">日付</th>
                  <th className="py-3 px-3 whitespace-nowrap">アプリ</th>
                  <th className="py-3 px-3 whitespace-nowrap">案件・内容</th>
                  <th className="py-3 px-3 whitespace-nowrap">状態</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">ポイント</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">円換算</th>
                  <th className="py-3 pl-3 pr-5 text-right whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((tx) => {
                  const app = appMap.get(tx.appId);
                  const yen = pointsToYen(tx.points, app?.pointsPerYen ?? 1);
                  const isPending = tx.type === 'pending';
                  const isExchanged = tx.type === 'exchanged';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 pl-5 pr-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {tx.date}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <AppIcon
                            src={app?.iconUrl}
                            name={app?.name ?? '不明'}
                            brandColor={app?.brandColor}
                            size="sm"
                          />
                          <span className="font-medium text-slate-900">
                            {app?.name ?? '削除済みアプリ'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 min-w-[220px] max-w-[340px]">
                        <p className="font-medium text-slate-900 truncate">{tx.title}</p>
                        {(tx.exchangeTarget || tx.expectedApprovalDate || tx.note) && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {isExchanged && tx.exchangeTarget ? `交換先: ${tx.exchangeTarget}` : ''}
                            {isPending && tx.expectedApprovalDate
                              ? `承認予定: ${tx.expectedApprovalDate}`
                              : ''}
                            {(isExchanged && tx.exchangeTarget) ||
                            (isPending && tx.expectedApprovalDate)
                              ? tx.note
                                ? ` · ${tx.note}`
                                : ''
                              : tx.note || ''}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        {tx.type === 'earned' && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            確定
                          </span>
                        )}
                        {tx.type === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            判定中
                          </span>
                        )}
                        {tx.type === 'exchanged' && (
                          <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            交換済
                          </span>
                        )}
                      </td>

                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap font-medium ${
                          isExchanged
                            ? 'text-slate-600'
                            : isPending
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {isExchanged ? '-' : '+'}
                        {formatPoints(tx.points, app?.unit ?? 'P')}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap font-semibold text-slate-900">
                        {isExchanged ? '-' : '+'}
                        {formatYen(yen)}
                      </td>

                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => onApproveTransaction(tx.id)}
                              className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 rounded-md transition-colors cursor-pointer"
                            >
                              確定にする
                            </button>
                          )}

                          {confirmDeleteId === tx.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteTransaction(tx.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 text-[11px] font-medium text-white bg-red-600 rounded hover:bg-red-700 cursor-pointer"
                              >
                                削除
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer"
                              >
                                戻る
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(tx.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                              aria-label="この履歴を削除"
                              title="削除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
