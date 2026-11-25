import { useEffect, useRef, useState, ChangeEvent, FormEvent } from 'react';
import { X, Upload, Check, Trash2, Search } from 'lucide-react';
import { AppCategory, PoikatsuApp, PresetAppTemplate } from '../types/poikatsu';
import { APP_CATEGORY_LABELS, PRESET_APP_TEMPLATES } from '../data/presets';
import { AppIcon } from './AppIcon';

interface AppFormModalProps {
  open: boolean;
  editingApp: PoikatsuApp | null;
  existingApps: PoikatsuApp[];
  onClose: () => void;
  onSave: (app: Omit<PoikatsuApp, 'id'>, existingId?: string) => void;
  onDelete?: (appId: string) => void;
}

const BRAND_SWATCHES = [
  '#E6005C',
  '#F5A623',
  '#00A98F',
  '#00B8D9',
  '#1B9DF0',
  '#FF6B00',
  '#BF0000',
  '#005BAC',
  '#6366F1',
  '#0F172A',
];

function resizeImageToDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        // Center-crop square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png', 0.92));
      };
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

export function AppFormModal({
  open,
  editingApp,
  existingApps,
  onClose,
  onSave,
  onDelete,
}: AppFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'preset' | 'form'>('preset');
  const [presetQuery, setPresetQuery] = useState('');
  const [presetCategory, setPresetCategory] = useState<'all' | AppCategory>('all');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [category, setCategory] = useState<AppCategory>('point_site');
  const [iconUrl, setIconUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#E6005C');
  const [unit, setUnit] = useState('P');
  const [pointsPerYen, setPointsPerYen] = useState('1');
  const [confirmedPoints, setConfirmedPoints] = useState('0');
  const [pendingPoints, setPendingPoints] = useState('0');
  const [minExchangePoints, setMinExchangePoints] = useState('300');
  const [expiryDate, setExpiryDate] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [memo, setMemo] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUploadError('');
    setConfirmDelete(false);
    if (editingApp) {
      setMode('form');
      setName(editingApp.name);
      setShortName(editingApp.shortName);
      setCategory(editingApp.category);
      setIconUrl(editingApp.iconUrl);
      setBrandColor(editingApp.brandColor);
      setUnit(editingApp.unit);
      setPointsPerYen(String(editingApp.pointsPerYen));
      setConfirmedPoints(String(editingApp.confirmedPoints));
      setPendingPoints(String(editingApp.pendingPoints));
      setMinExchangePoints(String(editingApp.minExchangePoints));
      setExpiryDate(editingApp.expiryDate || '');
      setSiteUrl(editingApp.siteUrl || '');
      setMemo(editingApp.memo || '');
    } else {
      setMode('preset');
      setName('');
      setShortName('');
      setCategory('point_site');
      setIconUrl(PRESET_APP_TEMPLATES[0].iconUrl);
      setBrandColor(PRESET_APP_TEMPLATES[0].brandColor);
      setUnit('P');
      setPointsPerYen('1');
      setConfirmedPoints('');
      setPendingPoints('');
      setMinExchangePoints('300');
      setExpiryDate('');
      setSiteUrl('');
      setMemo('');
    }
  }, [open, editingApp]);

  if (!open) return null;

  const existingNames = new Set(existingApps.map((a) => a.name));

  const applyPreset = (preset: PresetAppTemplate) => {
    setName(preset.name);
    setShortName(preset.shortName);
    setCategory(preset.category);
    setIconUrl(preset.iconUrl);
    setBrandColor(preset.brandColor);
    setUnit(preset.unit);
    setPointsPerYen(String(preset.pointsPerYen));
    setMinExchangePoints(String(preset.minExchangePoints));
    setSiteUrl(preset.siteUrl);
    setMode('form');
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      setIconUrl(dataUrl);
    } catch {
      setUploadError('画像の読み込みに失敗しました。PNG/JPG/WebP画像をお試しください。');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(
      {
        name: name.trim(),
        shortName: shortName.trim() || name.trim().slice(0, 6),
        category,
        iconUrl: iconUrl.trim(),
        brandColor,
        unit: unit.trim() || 'P',
        pointsPerYen: Math.max(0.01, Number(pointsPerYen) || 1),
        confirmedPoints: Math.max(0, Number(confirmedPoints) || 0),
        pendingPoints: Math.max(0, Number(pendingPoints) || 0),
        minExchangePoints: Math.max(1, Number(minExchangePoints) || 100),
        expiryDate: expiryDate || undefined,
        siteUrl: siteUrl.trim() || undefined,
        memo: memo.trim() || undefined,
      },
      editingApp?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 id="app-modal-title" className="text-base font-semibold text-slate-900">
            {editingApp ? `${editingApp.name} の設定・画像編集` : 'ポイ活アプリを追加'}
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

        {!editingApp && (
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('preset')}
                className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mode === 'preset'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                定番ポイ活アプリから選ぶ
              </button>
              <button
                type="button"
                onClick={() => setMode('form')}
                className={`py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mode === 'form'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                カスタム登録・画像アップロード
              </button>
            </div>
          </div>
        )}

        {mode === 'preset' && !editingApp ? (
          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-500">
              追加したいアプリを選ぶと、公式アイコン・換算レート・最低交換ポイントが自動入力されます（追加後にカスタマイズも可能です）。
            </p>
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={presetQuery}
                  onChange={(e) => setPresetQuery(e.target.value)}
                  placeholder="サイト・アプリ名で検索（例: Freecash, Mistplay, モッピー）"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'point_site', 'walk_move', 'common_point', 'receipt_survey', 'other'] as const).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPresetCategory(cat)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                        presetCategory === cat
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {cat === 'all' ? `すべて (${PRESET_APP_TEMPLATES.length})` : APP_CATEGORY_LABELS[cat]}
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
              {PRESET_APP_TEMPLATES.filter((preset) => {
                if (presetCategory !== 'all' && preset.category !== presetCategory) return false;
                const q = presetQuery.trim().toLowerCase();
                if (!q) return true;
                return (
                  preset.name.toLowerCase().includes(q) ||
                  preset.shortName.toLowerCase().includes(q) ||
                  preset.description.toLowerCase().includes(q)
                );
              }).map((preset) => {
                const alreadyAdded = existingNames.has(preset.name);
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-white text-left transition-colors cursor-pointer"
                  >
                    <AppIcon
                      src={preset.iconUrl}
                      name={preset.name}
                      brandColor={preset.brandColor}
                      size="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {preset.name}
                        </p>
                        {alreadyAdded && (
                          <span className="text-[10px] font-medium text-emerald-700 shrink-0">
                            登録済
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Icon Image Section */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <AppIcon
                  src={iconUrl}
                  name={name || 'アプリ'}
                  brandColor={brandColor}
                  size="xl"
                />
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-semibold text-slate-900">アプリアイコン画像</p>
                  <p className="text-[11px] text-slate-500">
                    端末から公式アイコン画像をアップロードするか、下のプリセット画像から選択できます。
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      画像をアップロード
                    </button>
                    {iconUrl && (
                      <button
                        type="button"
                        onClick={() => setIconUrl('')}
                        className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        画像をクリア
                      </button>
                    )}
                  </div>
                  {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                </div>
              </div>

              {/* Preset Icon Strip */}
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-2">
                  プリセットアイコンから選択
                </p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {PRESET_APP_TEMPLATES.map((p) => {
                    const selected = iconUrl === p.iconUrl;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                          setIconUrl(p.iconUrl);
                          setBrandColor(p.brandColor);
                        }}
                        title={p.name}
                        className={`relative p-0.5 rounded-[12px] border-2 transition-colors shrink-0 cursor-pointer ${
                          selected ? 'border-slate-900' : 'border-transparent hover:border-slate-300'
                        }`}
                      >
                        <AppIcon src={p.iconUrl} name={p.name} brandColor={p.brandColor} size="md" />
                        {selected && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Image URL */}
              <div>
                <label htmlFor="app-icon-url" className="block text-[11px] font-medium text-slate-600 mb-1">
                  または画像URLを直接指定
                </label>
                <input
                  id="app-icon-url"
                  type="text"
                  value={iconUrl.startsWith('data:') ? '' : iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  placeholder={
                    iconUrl.startsWith('data:')
                      ? 'アップロード済み画像が設定されています'
                      : 'https://example.com/icon.png'
                  }
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="app-name" className="block text-xs font-medium text-slate-700 mb-1">
                  アプリ名 *
                </label>
                <input
                  id="app-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例: モッピー"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="app-category" className="block text-xs font-medium text-slate-700 mb-1">
                  カテゴリ
                </label>
                <select
                  id="app-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AppCategory)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                >
                  {(Object.keys(APP_CATEGORY_LABELS) as AppCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {APP_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Point Rate & Units */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="app-unit" className="block text-xs font-medium text-slate-700 mb-1">
                  単位
                </label>
                <input
                  id="app-unit"
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="P / pt / マイル"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="app-rate" className="block text-xs font-medium text-slate-700 mb-1">
                  1円あたりのポイント数
                </label>
                <input
                  id="app-rate"
                  type="number"
                  min={0.01}
                  step="any"
                  required
                  value={pointsPerYen}
                  onChange={(e) => setPointsPerYen(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  例: モッピーは1、ポイインは10、トリマは100
                </p>
              </div>

              <div>
                <label htmlFor="app-min-ex" className="block text-xs font-medium text-slate-700 mb-1">
                  最低交換ポイント
                </label>
                <input
                  id="app-min-ex"
                  type="number"
                  min={1}
                  required
                  value={minExchangePoints}
                  onChange={(e) => setMinExchangePoints(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>

            {/* Current Balances */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="app-confirmed" className="block text-xs font-medium text-slate-700 mb-1">
                  現在の確定ポイント
                </label>
                <input
                  id="app-confirmed"
                  type="number"
                  min={0}
                  value={confirmedPoints}
                  placeholder="0"
                  onChange={(e) => setConfirmedPoints(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="app-pending" className="block text-xs font-medium text-slate-700 mb-1">
                  判定中ポイント
                </label>
                <input
                  id="app-pending"
                  type="number"
                  min={0}
                  value={pendingPoints}
                  placeholder="0"
                  onChange={(e) => setPendingPoints(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="app-expiry" className="block text-xs font-medium text-slate-700 mb-1">
                  有効期限（任意）
                </label>
                <input
                  id="app-expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>

            {/* Color & Site URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  テーマカラー（グラフ表示用）
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {BRAND_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setBrandColor(color)}
                      className={`w-6 h-6 rounded-md cursor-pointer transition-transform ${
                        brandColor === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`カラー ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="app-url" className="block text-xs font-medium text-slate-700 mb-1">
                  公式サイトURL（任意）
                </label>
                <input
                  id="app-url"
                  type="url"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://pc.moppy.jp/"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="app-memo" className="block text-xs font-medium text-slate-700 mb-1">
                メモ（交換ルート・会員ランク等）
              </label>
              <input
                id="app-memo"
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例: ドットマネー経由で銀行振込、毎月20日のウエル活に使用"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div>
                {editingApp && onDelete && (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(editingApp.id);
                          onClose();
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
                      >
                        本当に削除する
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      このアプリを削除
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  {editingApp ? '変更を保存' : 'アプリを登録'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
