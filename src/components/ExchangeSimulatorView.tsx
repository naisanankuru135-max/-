import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { ArrowLeftRight, Check } from 'lucide-react';
import { PoikatsuApp } from '../types/poikatsu';
import { formatPoints, formatYen, pointsToYen } from '../data/presets';
import { AppIcon } from './AppIcon';

interface ExchangeSimulatorViewProps {
  apps: PoikatsuApp[];
  onRecordExchange: (appId?: string, exchangeTarget?: string) => void;
}

interface SimulatedRoute {
  id: string;
  name: string;
  shortName: string;
  exchangeTarget: string;
  routePath: string;
  rateLabel: string;
  effectiveYen: number;
  deltaYen: number;
  mileCount?: number;
  note: string;
  color: string;
}

export function ExchangeSimulatorView({
  apps,
  onRecordExchange,
}: ExchangeSimulatorViewProps) {
  const [sourceMode, setSourceMode] = useState<'apps' | 'manual'>('apps');
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>(() =>
    apps.filter((a) => a.category === 'point_site' || a.category === 'walk_move').map((a) => a.id)
  );
  const [includePending, setIncludePending] = useState(false);
  const [onlyExchangeable, setOnlyExchangeable] = useState(false);
  const [manualYen, setManualYen] = useState('');

  // Tunable campaign parameters
  const [dPointBonusPct, setDPointBonusPct] = useState<number>(10);
  const [mileUnitYen, setMileUnitYen] = useState<number>(2.5);

  const toggleApp = (id: string) => {
    setSelectedAppIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllApps = () => setSelectedAppIds(apps.map((a) => a.id));
  const clearAllApps = () => setSelectedAppIds([]);

  const baseYen = useMemo(() => {
    if (sourceMode === 'manual') {
      return Math.max(0, Number(manualYen) || 0);
    }
    return apps.reduce((sum, app) => {
      if (!selectedAppIds.includes(app.id)) return sum;
      const effectivePoints =
        app.confirmedPoints + (includePending ? app.pendingPoints : 0);
      if (onlyExchangeable && app.minExchangePoints > 0 && effectivePoints < app.minExchangePoints) {
        return sum;
      }
      const confirmed = pointsToYen(app.confirmedPoints, app.pointsPerYen);
      const pending = includePending ? pointsToYen(app.pendingPoints, app.pointsPerYen) : 0;
      return sum + confirmed + pending;
    }, 0);
  }, [sourceMode, manualYen, apps, selectedAppIds, includePending, onlyExchangeable]);

  const routes = useMemo<SimulatedRoute[]>(() => {
    const welkatsuYen = Math.floor(baseYen * 1.5);
    const dPointYen = Math.floor(baseYen * (1 + dPointBonusPct / 100));
    const jalMiles = Math.floor(baseYen * 0.8); // モッピードリームキャンペーン実質80%目安
    const jalYen = Math.floor(jalMiles * mileUnitYen);
    const anaMiles = Math.floor(baseYen * 0.7); // みずほ・nimocaルート70%
    const anaYen = Math.floor(anaMiles * mileUnitYen);
    const commonYen = Math.floor(baseYen);
    const cashYen = Math.floor(baseYen);

    return [
      {
        id: 'jal-dream',
        name: 'JALマイル（実質80%キャンペーン）',
        shortName: 'JALマイル',
        exchangeTarget: 'JALマイル',
        routePath: 'モッピー → JALマイル（ドリームキャンペーン適用時）',
        rateLabel: `交換率80% · 1マイル=${mileUnitYen.toFixed(1)}円想定`,
        effectiveYen: jalYen,
        deltaYen: jalYen - baseYen,
        mileCount: jalMiles,
        note: '特典航空券（国際線・繁忙期国内線）で1マイル2〜4円以上の価値を狙えるルート',
        color: '#BF0000',
      },
      {
        id: 'ana-mizuho',
        name: 'ANAマイル（みずほ・nimocaルート）',
        shortName: 'ANAマイル',
        exchangeTarget: 'ANAマイル',
        routePath: 'ポイントサイト → PeX/ドットマネー → JRキューポ → 永久不滅 → ANAマイル',
        rateLabel: `交換率70% · 1マイル=${mileUnitYen.toFixed(1)}円想定`,
        effectiveYen: anaYen,
        deltaYen: anaYen - baseYen,
        mileCount: anaMiles,
        note: '定番の70%高還元ルート。移行に1〜2ヶ月かかるため計画的な交換がおすすめ',
        color: '#005BAC',
      },
      {
        id: 'welkatsu',
        name: 'ウエル活（毎月20日 WAON POINT利用）',
        shortName: 'ウエル活',
        exchangeTarget: 'WAON POINT',
        routePath: 'ワラウ/モッピー → Vポイント → iAEON（WAON POINT）',
        rateLabel: '1.50倍（実質33.3%OFF）',
        effectiveYen: welkatsuYen,
        deltaYen: welkatsuYen - baseYen,
        note: '毎月20日のウエルシアお客様感謝デーで日用品・食料品を1.5倍価値で購入',
        color: '#00A98F',
      },
      {
        id: 'dpoint-boost',
        name: `dポイント増量キャンペーン（+${dPointBonusPct}%）`,
        shortName: `dポイント+${dPointBonusPct}%`,
        exchangeTarget: 'dポイント',
        routePath: 'ポイントサイト → ドットマネー / PeX → dポイント（要エントリー）',
        rateLabel: `${(1 + dPointBonusPct / 100).toFixed(2)}倍（+${dPointBonusPct}%増量）`,
        effectiveYen: dPointYen,
        deltaYen: dPointYen - baseYen,
        note: '増量分は期間・用途限定ポイント。日興フロッギーや街の決済で消化可能',
        color: '#CC0033',
      },
      {
        id: 'common-pay',
        name: 'PayPay・楽天・Vポイント（等価交換）',
        shortName: '共通ポイント',
        exchangeTarget: 'PayPayポイント',
        routePath: 'ポイントサイト → ドットマネー / 即時交換',
        rateLabel: '1.00倍（手数料無料）',
        effectiveYen: commonYen,
        deltaYen: 0,
        note: '日常決済やクレカ積立・ポイント投資にすぐ使える汎用性の高い出口',
        color: '#475569',
      },
      {
        id: 'cash-bank',
        name: '現金（銀行振込・ドットマネー経由）',
        shortName: '現金振込',
        exchangeTarget: '銀行振込',
        routePath: 'ポイントサイト → ドットマネー → 住信SBIネット銀行 / 楽天銀行',
        rateLabel: '1.00倍（ドットマネー経由で手数料無料）',
        effectiveYen: cashYen,
        deltaYen: 0,
        note: '直接現金化したい場合の王道ルート。直接振込よりドットマネー経由が手数料無料でお得',
        color: '#0F172A',
      },
    ].sort((a, b) => b.effectiveYen - a.effectiveYen);
  }, [baseYen, dPointBonusPct, mileUnitYen]);

  const bestRoute = routes[0];
  const firstSelectedAppId = selectedAppIds[0] || apps[0]?.id;

  return (
    <div className="space-y-6">
      {/* Top 2-Column Layout: Left Source Picker + Right Chart & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Point Source & Parameters */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">試算するポイント原資</h2>
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setSourceMode('apps')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  sourceMode === 'apps'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                保有ポイント
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('manual')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  sourceMode === 'manual'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                金額手入力
              </button>
            </div>
          </div>

          {sourceMode === 'apps' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includePending}
                      onChange={(e) => setIncludePending(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900 cursor-pointer"
                    />
                    <span>判定中ポイントも含める</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyExchangeable}
                      onChange={(e) => setOnlyExchangeable(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900 cursor-pointer"
                    />
                    <span>最低交換額に達したアプリのみ</span>
                  </label>
                </div>
                <div className="flex items-center gap-2.5 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllApps}
                    className="text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    全選択
                  </button>
                  <button
                    type="button"
                    onClick={clearAllApps}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    解除
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                {apps.map((app) => {
                  const checked = selectedAppIds.includes(app.id);
                  const effectivePoints =
                    app.confirmedPoints + (includePending ? app.pendingPoints : 0);
                  const belowMin =
                    app.minExchangePoints > 0 && effectivePoints < app.minExchangePoints;
                  const shortPoints = Math.max(0, app.minExchangePoints - effectivePoints);
                  const excludedByMin = checked && onlyExchangeable && belowMin;
                  const appYen =
                    pointsToYen(app.confirmedPoints, app.pointsPerYen) +
                    (includePending ? pointsToYen(app.pendingPoints, app.pointsPerYen) : 0);
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => toggleApp(app.id)}
                      className={`w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        checked
                          ? excludedByMin
                            ? 'bg-amber-50/60'
                            : 'bg-slate-50'
                          : 'bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            checked
                              ? 'bg-slate-900 border-slate-900 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </span>
                        <AppIcon
                          src={app.iconUrl}
                          name={app.name}
                          brandColor={app.brandColor}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-900 truncate">{app.name}</p>
                          <p className="text-[11px] font-mono tabular-nums text-slate-400">
                            {formatPoints(app.confirmedPoints, app.unit)}
                            {belowMin && (
                              <span className="ml-1.5 text-amber-700 font-sans">
                                （最低交換まであと {formatPoints(shortPoints, app.unit)}）
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${
                          excludedByMin ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {formatYen(appYen)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="sim-manual-yen" className="block text-xs text-slate-600">
                シミュレーション対象の原資（円相当）
              </label>
              <input
                id="sim-manual-yen"
                type="number"
                min={0}
                step={1000}
                value={manualYen}
                placeholder="10000"
                onChange={(e) => setManualYen(e.target.value)}
                className="w-full px-3 py-2 text-base font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[5000, 10000, 30000, 50000, 100000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setManualYen(String(val))}
                    className="px-2.5 py-1 text-[11px] font-mono tabular-nums border border-slate-200 rounded hover:border-slate-400 text-slate-700 cursor-pointer"
                  >
                    {formatYen(val)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Campaign / Mile Settings */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700">dポイント増量キャンペーン率</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  +{dPointBonusPct}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[10, 15, 20].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDPointBonusPct(pct)}
                    className={`py-1.5 text-xs font-mono tabular-nums rounded-lg border transition-colors cursor-pointer ${
                      dPointBonusPct === pct
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-700">1マイルあたりの想定価値</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  ¥{mileUnitYen.toFixed(1)} / マイル
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[1.5, 2.0, 2.5, 3.5].map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setMileUnitYen(unit)}
                    className={`py-1.5 text-xs font-mono tabular-nums rounded-lg border transition-colors cursor-pointer ${
                      mileUnitYen === unit
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    ¥{unit.toFixed(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Visual Value Comparison */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-100">
            <div>
              <p className="text-xs text-slate-500">交換原資（等価ベース）</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                {formatYen(baseYen)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">最大価値ルート</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">
                {formatYen(bestRoute?.effectiveYen ?? 0)}
              </p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{bestRoute?.shortName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">等価交換との最大差額</p>
              <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                +{formatYen(Math.max(0, bestRoute?.deltaYen ?? 0))}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-emerald-700 mt-0.5">
                {baseYen > 0
                  ? `実質 ${(((bestRoute?.effectiveYen ?? 0) / baseYen) * 100).toFixed(0)}% 価値`
                  : '原資を選択してください'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              交換ルート別・実質価値比較（円換算）
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={routes}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 10, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => `¥${v.toLocaleString('ja-JP')}`}
                    tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={96}
                    tick={{ fontSize: 11, fill: '#0F172A' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [formatYen(Number(value) || 0), '実質価値']}
                    contentStyle={{
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                    }}
                  />
                  <Bar dataKey="effectiveYen" radius={[0, 4, 4, 0]} barSize={22} isAnimationActive={false}>
                    {routes.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Route Matrix */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">交換ルート詳細・お得額一覧</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              現在の原資 {formatYen(baseYen)} を各ルートで交換した場合の試算結果
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {routes.map((route, idx) => (
            <div
              key={route.id}
              className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono tabular-nums text-xs text-slate-400">
                    0{idx + 1}.
                  </span>
                  <h4 className="text-sm font-semibold text-slate-900">{route.name}</h4>
                  <span className="text-xs text-slate-500">· {route.rateLabel}</span>
                </div>
                <p className="text-xs text-slate-600">{route.routePath}</p>
                <p className="text-[11px] text-slate-500">{route.note}</p>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                <div className="text-right">
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {formatYen(route.effectiveYen)}
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-500">
                    {route.mileCount !== undefined ? (
                      <span>{route.mileCount.toLocaleString('ja-JP')} マイル · </span>
                    ) : null}
                    <span className={route.deltaYen > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                      {route.deltaYen > 0 ? `+${formatYen(route.deltaYen)} お得` : '等価 (±¥0)'}
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRecordExchange(firstSelectedAppId, route.exchangeTarget)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  交換を記録
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
