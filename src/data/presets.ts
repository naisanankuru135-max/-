import { AppCategory, PoikatsuStoreData, PresetAppTemplate, ReminderKind } from '../types/poikatsu';

export const APP_CATEGORY_LABELS: Record<AppCategory, string> = {
  point_site: 'ポイントサイト',
  walk_move: '移動・歩数',
  common_point: '共通ポイント',
  receipt_survey: 'レシート・アンケート',
  other: 'その他',
};

export const REMINDER_KIND_LABELS: Record<ReminderKind, string> = {
  cancellation: '解約期限',
  condition: '獲得条件',
  campaign: 'キャンペーン・交換期限',
};

// Generated high-fidelity app icon assets
export const GENERATED_ICONS = {
  moppy: '/src/assets/images/icon_moppy_1795597785040.jpg',
  hapitas: '/src/assets/images/icon_hapitas_1795597786938.jpg',
  pointincome: '/src/assets/images/icon_pointincome_1795597788654.jpg',
  trima: '/src/assets/images/icon_trima_1795597788540.jpg',
  warau: '/src/assets/images/icon_warau_1795597789550.jpg',
  chobirich: '/src/assets/images/icon_chobirich_1795597790440.jpg',
  rakuten: '/src/assets/images/icon_rakuten_1795597790871.jpg',
  vpoint: '/src/assets/images/icon_vpoint_1795597794563.jpg',
} as const;

// Clean vector data-URI icons for additional popular Japanese point apps
function makeSvgIcon(bg: string, accent: string, symbolPath: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
    <rect width="128" height="128" fill="${bg}"/>
    <circle cx="64" cy="64" r="44" fill="${accent}" fill-opacity="0.16"/>
    ${symbolPath}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const EXTRA_VECTOR_ICONS = {
  paypay: makeSvgIcon(
    '#FF0033',
    '#FFFFFF',
    `<path d="M44 32h24c14.4 0 24 8.6 24 21.5S82.4 75 68 75H57v21H44V32zm13 31h10.5c7.2 0 11.5-3.6 11.5-9.5S74.7 44 67.5 44H57v19z" fill="#FFFFFF"/><circle cx="88" cy="86" r="10" fill="#FFE600"/>`
  ),
  dpoint: makeSvgIcon(
    '#CC0033',
    '#FFFFFF',
    `<circle cx="64" cy="64" r="36" fill="#FFFFFF"/><path d="M74 39v48h-10v-5c-3 4-7.5 6-13 6-11.5 0-19.5-8.5-19.5-20s8-20 19.5-20c5.5 0 10 2 13 6V39h10zm-21 19c-6 0-10.5 4.2-10.5 10s4.5 10 10.5 10 10.5-4.2 10.5-10-4.5-10-10.5-10z" fill="#CC0033"/>`
  ),
  ponta: makeSvgIcon(
    '#F07D00',
    '#1D2088',
    `<circle cx="64" cy="64" r="38" fill="#1D2088"/><path d="M48 38h19c12.5 0 21 7.2 21 18.5S79.5 75 67 75H59v17H48V38zm11 27h7.5c6 0 10-3 10-8.5s-4-8.5-10-8.5H59v17z" fill="#FFFFFF"/><circle cx="85" cy="84" r="8" fill="#FFD400"/>`
  ),
  ecnavi: makeSvgIcon(
    '#0068B7',
    '#FFFFFF',
    `<circle cx="64" cy="64" r="36" fill="none" stroke="#FFFFFF" stroke-width="7"/><polygon points="64,34 74,64 64,94 54,64" fill="#FFCC00"/><circle cx="64" cy="64" r="6" fill="#0068B7"/>`
  ),
};

export const PRESET_APP_TEMPLATES: PresetAppTemplate[] = [
  {
    key: 'moppy',
    name: 'モッピー',
    shortName: 'モッピー',
    category: 'point_site',
    iconUrl: GENERATED_ICONS.moppy,
    brandColor: '#E6005C',
    unit: 'P',
    pointsPerYen: 1,
    minExchangePoints: 300,
    siteUrl: 'https://pc.moppy.jp/',
    description: '1P = 1円 · 定番の高還元ポイントサイト',
  },
  {
    key: 'hapitas',
    name: 'ハピタス',
    shortName: 'ハピタス',
    category: 'point_site',
    iconUrl: GENERATED_ICONS.hapitas,
    brandColor: '#F5A623',
    unit: 'pt',
    pointsPerYen: 1,
    minExchangePoints: 300,
    siteUrl: 'https://hapitas.jp/',
    description: '1pt = 1円 · ショッピング・金融案件に強い',
  },
  {
    key: 'pointincome',
    name: 'ポイントインカム',
    shortName: 'ポイイン',
    category: 'point_site',
    iconUrl: GENERATED_ICONS.pointincome,
    brandColor: '#00A98F',
    unit: 'pt',
    pointsPerYen: 10,
    minExchangePoints: 5000,
    siteUrl: 'https://pointi.jp/',
    description: '10pt = 1円 · 会員ランク・イベントが豊富',
  },
  {
    key: 'trima',
    name: 'トリマ',
    shortName: 'トリマ',
    category: 'walk_move',
    iconUrl: GENERATED_ICONS.trima,
    brandColor: '#00B8D9',
    unit: 'マイル',
    pointsPerYen: 100,
    minExchangePoints: 36000,
    siteUrl: 'https://www.trip-mile.com/',
    description: '100マイル = 1円 · 移動と歩数で貯まる',
  },
  {
    key: 'warau',
    name: 'ワラウ',
    shortName: 'ワラウ',
    category: 'point_site',
    iconUrl: GENERATED_ICONS.warau,
    brandColor: '#1B9DF0',
    unit: 'pt',
    pointsPerYen: 1,
    minExchangePoints: 300,
    siteUrl: 'https://www.warau.jp/',
    description: '1pt = 1円 · Vポイント即時交換・ウエル活向け',
  },
  {
    key: 'chobirich',
    name: 'ちょびリッチ',
    shortName: 'ちょびリッチ',
    category: 'point_site',
    iconUrl: GENERATED_ICONS.chobirich,
    brandColor: '#FF6B00',
    unit: 'pt',
    pointsPerYen: 2,
    minExchangePoints: 1000,
    siteUrl: 'https://www.chobirich.com/',
    description: '2pt = 1円 · モニター・外食案件も充実',
  },
  {
    key: 'rakuten',
    name: '楽天ポイント',
    shortName: '楽天',
    category: 'common_point',
    iconUrl: GENERATED_ICONS.rakuten,
    brandColor: '#BF0000',
    unit: 'P',
    pointsPerYen: 1,
    minExchangePoints: 100,
    siteUrl: 'https://point.rakuten.co.jp/',
    description: '1P = 1円 · 楽天市場・楽天ペイで幅広く利用',
  },
  {
    key: 'vpoint',
    name: 'Vポイント',
    shortName: 'Vポイント',
    category: 'common_point',
    iconUrl: GENERATED_ICONS.vpoint,
    brandColor: '#005BAC',
    unit: 'pt',
    pointsPerYen: 1,
    minExchangePoints: 100,
    siteUrl: 'https://tsite.jp/',
    description: '1pt = 1円 · 三井住友カード・WAON交換対応',
  },
  {
    key: 'paypay',
    name: 'PayPayポイント',
    shortName: 'PayPay',
    category: 'common_point',
    iconUrl: EXTRA_VECTOR_ICONS.paypay,
    brandColor: '#FF0033',
    unit: 'pt',
    pointsPerYen: 1,
    minExchangePoints: 1,
    siteUrl: 'https://paypay.ne.jp/',
    description: '1pt = 1円 · そのまま街の決済・運用に使える',
  },
  {
    key: 'dpoint',
    name: 'dポイント',
    shortName: 'dポイント',
    category: 'common_point',
    iconUrl: EXTRA_VECTOR_ICONS.dpoint,
    brandColor: '#CC0033',
    unit: 'P',
    pointsPerYen: 1,
    minExchangePoints: 100,
    siteUrl: 'https://dpoint.docomo.ne.jp/',
    description: '1P = 1円 · 増量キャンペーン時の交換先として人気',
  },
  {
    key: 'ponta',
    name: 'Pontaポイント',
    shortName: 'Ponta',
    category: 'common_point',
    iconUrl: EXTRA_VECTOR_ICONS.ponta,
    brandColor: '#F07D00',
    unit: 'P',
    pointsPerYen: 1,
    minExchangePoints: 100,
    siteUrl: 'https://www.ponta.jp/',
    description: '1P = 1円 · お試し引換券やau PAY充当に便利',
  },
  {
    key: 'ecnavi',
    name: 'ECナビ',
    shortName: 'ECナビ',
    category: 'point_site',
    iconUrl: EXTRA_VECTOR_ICONS.ecnavi,
    brandColor: '#0068B7',
    unit: 'pts',
    pointsPerYen: 10,
    minExchangePoints: 3000,
    siteUrl: 'https://ecnavi.jp/',
    description: '10pts = 1円 · PeX経由で多彩な交換先に対応',
  },
];

// Helper to get relative YYYY-MM-DD dates from today
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthsAgoDate(monthsAgo: number, day = 15): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, maxDay));
  return d.toISOString().slice(0, 10);
}

export function createInitialData(): PoikatsuStoreData {
  const today = daysAgo(0);
  const yesterday = daysAgo(1);

  return {
    monthlyGoalYen: 15000,
    apps: [
      {
        id: 'app-moppy',
        name: 'モッピー',
        shortName: 'モッピー',
        category: 'point_site',
        iconUrl: GENERATED_ICONS.moppy,
        brandColor: '#E6005C',
        unit: 'P',
        pointsPerYen: 1,
        confirmedPoints: 14820,
        pendingPoints: 12000,
        minExchangePoints: 300,
        expiryDate: daysFromNow(145),
        siteUrl: 'https://pc.moppy.jp/',
        memo: 'クレカ・証券案件のメインサイト。JALマイル/ドットマネー経由で交換。',
      },
      {
        id: 'app-hapitas',
        name: 'ハピタス',
        shortName: 'ハピタス',
        category: 'point_site',
        iconUrl: GENERATED_ICONS.hapitas,
        brandColor: '#F5A623',
        unit: 'pt',
        pointsPerYen: 1,
        confirmedPoints: 8640,
        pendingPoints: 6500,
        minExchangePoints: 300,
        expiryDate: daysFromNow(210),
        siteUrl: 'https://hapitas.jp/',
        memo: '楽天市場や旅行予約の経由用。ゴールド会員維持中。',
      },
      {
        id: 'app-pointincome',
        name: 'ポイントインカム',
        shortName: 'ポイイン',
        category: 'point_site',
        iconUrl: GENERATED_ICONS.pointincome,
        brandColor: '#00A98F',
        unit: 'pt',
        pointsPerYen: 10,
        confirmedPoints: 54200, // 5,420円
        pendingPoints: 30000, // 3,000円
        minExchangePoints: 5000,
        expiryDate: daysFromNow(120),
        siteUrl: 'https://pointi.jp/',
        memo: '毎月15日〜25日の全国ランキング特別企画を活用。',
      },
      {
        id: 'app-trima',
        name: 'トリマ',
        shortName: 'トリマ',
        category: 'walk_move',
        iconUrl: GENERATED_ICONS.trima,
        brandColor: '#00B8D9',
        unit: 'マイル',
        pointsPerYen: 100,
        confirmedPoints: 48500, // 485円
        pendingPoints: 0,
        minExchangePoints: 36000,
        expiryDate: daysFromNow(18),
        siteUrl: 'https://www.trip-mile.com/',
        memo: '通勤の移動タンク回収。36,000マイルごとにドットマネーへ交換。',
      },
      {
        id: 'app-warau',
        name: 'ワラウ',
        shortName: 'ワラウ',
        category: 'point_site',
        iconUrl: GENERATED_ICONS.warau,
        brandColor: '#1B9DF0',
        unit: 'pt',
        pointsPerYen: 1,
        confirmedPoints: 3250,
        pendingPoints: 1800,
        minExchangePoints: 300,
        expiryDate: daysFromNow(290),
        siteUrl: 'https://www.warau.jp/',
        memo: 'WAON POINT即時交換で20日のウエル活に使用。',
      },
      {
        id: 'app-chobirich',
        name: 'ちょびリッチ',
        shortName: 'ちょびリッチ',
        category: 'point_site',
        iconUrl: GENERATED_ICONS.chobirich,
        brandColor: '#FF6B00',
        unit: 'pt',
        pointsPerYen: 2,
        confirmedPoints: 4680, // 2,340円
        pendingPoints: 0,
        minExchangePoints: 1000,
        expiryDate: daysFromNow(95),
        siteUrl: 'https://www.chobirich.com/',
        memo: 'テンタメ・モニター案件のチェック用。',
      },
      {
        id: 'app-rakuten',
        name: '楽天ポイント',
        shortName: '楽天',
        category: 'common_point',
        iconUrl: GENERATED_ICONS.rakuten,
        brandColor: '#BF0000',
        unit: 'P',
        pointsPerYen: 1,
        confirmedPoints: 6180,
        pendingPoints: 1450,
        minExchangePoints: 100,
        expiryDate: daysFromNow(11),
        siteUrl: 'https://point.rakuten.co.jp/',
        memo: '期間限定ポイント1,200Pあり（今月末失効に注意）。',
      },
      {
        id: 'app-vpoint',
        name: 'Vポイント',
        shortName: 'Vポイント',
        category: 'common_point',
        iconUrl: GENERATED_ICONS.vpoint,
        brandColor: '#005BAC',
        unit: 'pt',
        pointsPerYen: 1,
        confirmedPoints: 4120,
        pendingPoints: 0,
        minExchangePoints: 100,
        expiryDate: daysFromNow(320),
        siteUrl: 'https://tsite.jp/',
        memo: 'SBI証券クレカ積立とコンビニ7%還元分を集約。',
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        appId: 'app-moppy',
        title: '三井住友カード ゴールド(NL) 新規発行',
        type: 'pending',
        points: 12000,
        date: daysAgo(3),
        expectedApprovalDate: daysFromNow(40),
        note: '翌月末までに1万円利用条件クリア済み',
      },
      {
        id: 'tx-2',
        appId: 'app-hapitas',
        title: 'SBI証券 口座開設＋5万円入金',
        type: 'pending',
        points: 6500,
        date: daysAgo(6),
        expectedApprovalDate: daysFromNow(28),
        note: '住信SBIネット銀行ハイブリッド預金へ振替完了',
      },
      {
        id: 'tx-3',
        appId: 'app-pointincome',
        title: 'U-NEXT 31日間無料トライアル',
        type: 'earned',
        points: 22000, // 2,200円
        date: daysAgo(4),
        note: 'ネズ吉捕獲ボーナス対象案件',
      },
      {
        id: 'tx-4',
        appId: 'app-moppy',
        title: 'ふるさと納税（さとふる）経由購入',
        type: 'earned',
        points: 2400,
        date: daysAgo(8),
      },
      {
        id: 'tx-5',
        appId: 'app-rakuten',
        title: 'お買い物マラソン 買い回り特典',
        type: 'earned',
        points: 3150,
        date: daysAgo(5),
      },
      {
        id: 'tx-6',
        appId: 'app-pointincome',
        title: 'スマホアプリゲーム StepUp達成（城レベル18）',
        type: 'pending',
        points: 30000, // 3,000円
        date: daysAgo(2),
        expectedApprovalDate: daysFromNow(14),
      },
      {
        id: 'tx-7',
        appId: 'app-warau',
        title: 'WAON POINTへ即時交換（ウエル活準備）',
        type: 'exchanged',
        points: 4000,
        date: daysAgo(9),
        exchangeTarget: 'WAON POINT',
      },
      {
        id: 'tx-8',
        appId: 'app-trima',
        title: '今週の移動・歩数タンク回収まとめ',
        type: 'earned',
        points: 14500, // 145円
        date: daysAgo(1),
      },
      {
        id: 'tx-9',
        appId: 'app-warau',
        title: '宅配食材お試しセット注文',
        type: 'pending',
        points: 1800,
        date: daysAgo(4),
        expectedApprovalDate: daysFromNow(25),
      },
      {
        id: 'tx-10',
        appId: 'app-vpoint',
        title: '対象コンビニ・飲食店 スマホタッチ決済還元',
        type: 'earned',
        points: 1280,
        date: daysAgo(7),
      },
      {
        id: 'tx-11',
        appId: 'app-hapitas',
        title: 'Yahoo!ショッピング 日用品まとめ買い経由',
        type: 'earned',
        points: 920,
        date: daysAgo(12),
      },
      {
        id: 'tx-12',
        appId: 'app-chobirich',
        title: 'コンビニスイーツ モニター還元',
        type: 'earned',
        points: 1600, // 800円
        date: daysAgo(15),
      },
      {
        id: 'tx-13',
        appId: 'app-moppy',
        title: '動画配信サービス 無料トライアル登録',
        type: 'earned',
        points: 1800,
        date: daysAgo(18),
      },
      {
        id: 'tx-14',
        appId: 'app-trima',
        title: '移動タンク・歩数マイルまとめ回収',
        type: 'earned',
        points: 22000, // 220円
        date: daysAgo(21),
      },
      {
        id: 'tx-15',
        appId: 'app-rakuten',
        title: '楽天ブックス＆楽天ペイ利用特典',
        type: 'earned',
        points: 1650,
        date: daysAgo(24),
      },
      {
        id: 'tx-16',
        appId: 'app-warau',
        title: 'クレジットカード資料請求・アンケート完了',
        type: 'earned',
        points: 1100,
        date: daysAgo(27),
      },
      // Previous months history for 6-month trend chart
      {
        id: 'tx-h1',
        appId: 'app-moppy',
        title: '楽天カード 新規作成キャンペーン',
        type: 'earned',
        points: 11000,
        date: monthsAgoDate(1, 14),
      },
      {
        id: 'tx-h2',
        appId: 'app-hapitas',
        title: 'じゃらん 国内ホテル予約',
        type: 'earned',
        points: 3200,
        date: monthsAgoDate(1, 21),
      },
      {
        id: 'tx-h3',
        appId: 'app-moppy',
        title: '銀行振込（ドットマネー経由）',
        type: 'exchanged',
        points: 10000,
        date: monthsAgoDate(1, 26),
        exchangeTarget: '住信SBIネット銀行',
      },
      {
        id: 'tx-h4',
        appId: 'app-pointincome',
        title: 'ネット銀行 口座開設案件',
        type: 'earned',
        points: 45000, // 4,500円
        date: monthsAgoDate(2, 10),
      },
      {
        id: 'tx-h5',
        appId: 'app-hapitas',
        title: '光回線 乗り換えキャッシュバック経由',
        type: 'earned',
        points: 8500,
        date: monthsAgoDate(2, 19),
      },
      {
        id: 'tx-h6',
        appId: 'app-chobirich',
        title: '新商品ドリンク 100%還元モニター',
        type: 'earned',
        points: 3600, // 1,800円
        date: monthsAgoDate(3, 8),
      },
      {
        id: 'tx-h7',
        appId: 'app-moppy',
        title: '証券口座 新規開設＆取引',
        type: 'earned',
        points: 9500,
        date: monthsAgoDate(3, 18),
      },
      {
        id: 'tx-h8',
        appId: 'app-rakuten',
        title: '楽天スーパーSALE ポイント還元',
        type: 'earned',
        points: 5400,
        date: monthsAgoDate(4, 12),
      },
      {
        id: 'tx-h9',
        appId: 'app-warau',
        title: '電子書籍サブスク 初月登録',
        type: 'earned',
        points: 2600,
        date: monthsAgoDate(4, 22),
      },
      {
        id: 'tx-h10',
        appId: 'app-hapitas',
        title: 'クレジットカード 発行案件',
        type: 'earned',
        points: 10500,
        date: monthsAgoDate(5, 16),
      },
    ],
    routines: [
      {
        id: 'rt-1',
        appId: 'app-moppy',
        title: 'モッピーガチャ＆毎日アンケート回答',
        rewardPoints: 5,
        completedDates: [yesterday, today],
      },
      {
        id: 'rt-2',
        appId: 'app-trima',
        title: '移動タンク＆歩数ガチャ回収（動画視聴）',
        rewardPoints: 300, // 3円相当
        completedDates: [yesterday],
      },
      {
        id: 'rt-3',
        appId: 'app-pointincome',
        title: 'トロフィー制度 ログインスタンプ獲得',
        rewardPoints: 10,
        completedDates: [yesterday, today],
      },
      {
        id: 'rt-4',
        appId: 'app-warau',
        title: 'ログインボーナス＆じゃんけんちゃん',
        rewardPoints: 3,
        completedDates: [yesterday],
      },
      {
        id: 'rt-5',
        appId: 'app-rakuten',
        title: '楽天ポイントスクリーン 広告タップ',
        rewardPoints: 5,
        completedDates: [yesterday],
      },
    ],
    reminders: [
      {
        id: 'rem-1',
        appId: 'app-pointincome',
        title: 'U-NEXT 31日間無料トライアル 解約判断',
        kind: 'cancellation',
        dueDate: daysFromNow(4),
        actionDetail: '継続しない場合は無料期間終了日の前日までに解約手続き',
        riskOrRewardText: '忘れると月額 ¥2,189 が自動課金',
        completed: false,
      },
      {
        id: 'rem-2',
        appId: 'app-moppy',
        title: '三井住友カード ゴールド(NL) 1万円決済条件',
        kind: 'condition',
        dueDate: daysFromNow(9),
        actionDetail: 'カード到着後、翌月末までに合計10,000円以上のショッピング利用',
        riskOrRewardText: '達成で 12,000 P 確定対象',
        completed: false,
      },
      {
        id: 'rem-3',
        appId: 'app-warau',
        title: 'ウエル活準備（WAON POINT交換）',
        kind: 'campaign',
        dueDate: daysFromNow(14),
        actionDetail: '毎月20日のお客様感謝デーに向けて必要分をWAON POINTへ即時交換',
        riskOrRewardText: '1.5倍価値（実質33%OFF）で利用可能',
        completed: false,
      },
      {
        id: 'rem-4',
        appId: 'app-hapitas',
        title: 'SBI証券 5万円入金・ハイブリッド預金振替',
        kind: 'condition',
        dueDate: daysAgo(1),
        actionDetail: '口座開設から30日以内に5万円を一括入金して振替完了させる',
        riskOrRewardText: '達成済 · 6,500 pt 承認待ち',
        completed: true,
      },
    ],
  };
}

export function pointsToYen(points: number, pointsPerYen: number): number {
  if (!pointsPerYen || pointsPerYen <= 0) return points;
  return Math.floor(points / pointsPerYen);
}

export function formatYen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString('ja-JP')}`;
}

export function formatPoints(points: number, unit: string): string {
  return `${Math.round(points).toLocaleString('ja-JP')} ${unit}`;
}

export function formatRate(unit: string, pointsPerYen: number): string {
  return `${pointsPerYen}${unit} = 1円`;
}

export function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
