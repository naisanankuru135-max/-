export type AppCategory = 'point_site' | 'walk_move' | 'common_point' | 'receipt_survey' | 'other';

export type TransactionType = 'earned' | 'pending' | 'exchanged';

export interface PoikatsuApp {
  id: string;
  name: string;
  shortName: string;
  category: AppCategory;
  iconUrl: string;
  brandColor: string;
  unit: string; // e.g., "P", "pt", "マイル"
  pointsPerYen: number; // e.g., 1 for 1P=1円, 10 for 10pt=1円, 100 for 100マイル=1円
  confirmedPoints: number;
  pendingPoints: number;
  minExchangePoints: number;
  expiryDate?: string; // YYYY-MM-DD
  siteUrl?: string;
  memo?: string;
}

export interface PointTransaction {
  id: string;
  appId: string;
  title: string;
  type: TransactionType;
  points: number; // Always positive; direction inferred by type
  date: string; // YYYY-MM-DD
  exchangeTarget?: string; // e.g., "PayPayポイント", "銀行振込", "Vポイント"
  expectedApprovalDate?: string; // YYYY-MM-DD for pending deals
  note?: string;
}

export interface DailyRoutine {
  id: string;
  appId: string;
  title: string;
  rewardPoints: number;
  completedDates: string[]; // Array of YYYY-MM-DD strings
}

export interface PresetAppTemplate {
  key: string;
  name: string;
  shortName: string;
  category: AppCategory;
  iconUrl: string;
  brandColor: string;
  unit: string;
  pointsPerYen: number;
  minExchangePoints: number;
  siteUrl: string;
  description: string;
}

export type ReminderKind = 'condition' | 'cancellation' | 'campaign';

export interface DealReminder {
  id: string;
  appId: string;
  title: string;
  kind: ReminderKind;
  dueDate: string; // YYYY-MM-DD
  actionDetail: string;
  riskOrRewardText?: string;
  completed: boolean;
}

export interface ParsedScreenshotTransaction {
  title: string;
  points: number;
  type: TransactionType;
  date: string;
  exchangeTarget?: string;
  note?: string;
}

export interface ParsedScreenshotReminder {
  title: string;
  kind: ReminderKind;
  dueDate: string; // YYYY-MM-DD
  actionDetail: string;
  riskOrRewardText?: string;
}

export interface ParsedScreenshotResult {
  detectedAppName: string;
  matchedAppId: string;
  screenshotType: 'balance_screen' | 'history_list' | 'mixed' | 'unknown';
  unit: string;
  confirmedBalance: number; // -1 if not found
  pendingBalance: number; // -1 if not found
  expiryDate?: string;
  summary: string;
  transactions: ParsedScreenshotTransaction[];
  reminders?: ParsedScreenshotReminder[];
}

export type ActiveTab = 'dashboard' | 'apps' | 'ledger' | 'reminders' | 'simulator' | 'routine';

export interface PoikatsuStoreData {
  apps: PoikatsuApp[];
  transactions: PointTransaction[];
  routines: DailyRoutine[];
  reminders: DealReminder[];
  monthlyGoalYen: number;
}

export type AiConcreteProviderId =
  | 'gemini'
  | 'vertex_project'
  | 'vertex_express'
  | 'openai'
  | 'anthropic'
  | 'opencode'
  | 'opencode_go'
  | 'openai_compatible';

export type AiProviderSelection = 'auto' | AiConcreteProviderId;

export interface AiRequestConfig {
  provider: AiProviderSelection;
  apiKey?: string;
  model?: string;
  project?: string;
  location?: string;
  baseUrl?: string;
}

export interface AiServerStatus {
  preferredProvider: AiConcreteProviderId | null;
  configuredProviders: AiConcreteProviderId[];
  defaults: Record<
    AiConcreteProviderId,
    {
      hasCredentials: boolean;
      model: string;
      project?: string;
      location?: string;
      baseUrl?: string;
    }
  >;
}
