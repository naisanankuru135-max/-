import { AiConcreteProviderId, AiRequestConfig } from '../types/poikatsu';

export interface AiModelOption {
  id: string;
  label: string;
}

export interface AiProviderMeta {
  id: AiConcreteProviderId;
  label: string;
  shortLabel: string;
  description: string;
  needsApiKey: boolean;
  apiKeyOptional?: boolean;
  needsProjectLocation?: boolean;
  needsBaseUrl?: boolean;
  optionalBaseUrl?: boolean;
  defaultModel: string;
  defaultLocation?: string;
  defaultBaseUrl?: string;
  apiKeyPlaceholder?: string;
  baseUrlPlaceholder?: string;
  note?: string;
  models: AiModelOption[];
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: 'gemini',
    label: 'Gemini Developer API（APIキー）',
    shortLabel: 'Gemini API',
    description: 'Google の標準 Gemini API キーで最新 Gemini 4 / 3.8 モデルに接続します。',
    needsApiKey: true,
    defaultModel: 'gemini-4-hydrogen',
    apiKeyPlaceholder: 'AIza...（または .env の GEMINI_API_KEY）',
    models: [
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen（最新・高速）' },
      { id: 'gemini-4-neon', label: 'Gemini 4 Neon（高性能）' },
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon（高度推論）' },
      { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon（最上位）' },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash（安定・軽量）' },
    ],
  },
  {
    id: 'vertex_project',
    label: 'Vertex AI（GCPプロジェクト / ADC認証）',
    shortLabel: 'Vertex AI (Project)',
    description:
      'Google Cloud プロジェクトID + ロケーション + ADC（gcloud auth / サービスアカウント）で接続します。',
    needsApiKey: false,
    needsProjectLocation: true,
    defaultModel: 'gemini-4-hydrogen',
    defaultLocation: 'global',
    note: 'Vertex AI で Gemini 4 Hydrogen 等を使う場合は、ここで GCP プロジェクトID と ロケーション（global 推奨）を指定してください。APIキーではなくサーバー側の Google Cloud 認証（ADC / GOOGLE_APPLICATION_CREDENTIALS）を使用します。',
    models: [
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen（要 global / us / eu）' },
      { id: 'gemini-4-neon', label: 'Gemini 4 Neon' },
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon' },
      { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon' },
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
    ],
  },
  {
    id: 'vertex_express',
    label: 'Vertex AI Express Mode（APIキーのみ）',
    shortLabel: 'Vertex Express',
    description:
      'GCP プロジェクト設定なしで Vertex AI の API キーだけで接続する軽量モードです。',
    needsApiKey: true,
    defaultModel: 'gemini-3.8-flash',
    apiKeyPlaceholder: 'Vertex Express APIキー（または .env の VERTEX_API_KEY）',
    note: 'Express Mode（プロジェクト無し）では Gemini 4 Hydrogen がまだ利用できない・制限される場合があるため、標準モデルは gemini-3.8-flash にしています。Hydrogen を使う場合は「Vertex AI（GCPプロジェクト）」を選択してください。',
    models: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash（Express推奨）' },
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen（利用可能な場合）' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI API（Responses API）',
    shortLabel: 'OpenAI',
    description: 'OpenAI の最新 Responses API（Structured Outputs + Vision）に接続します。',
    needsApiKey: true,
    optionalBaseUrl: true,
    defaultModel: 'gpt-6.2-sol',
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-...（または .env の OPENAI_API_KEY）',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-6.2-sol', label: 'GPT-6.2 Sol（最新・バランス）' },
      { id: 'gpt-6.2-astra', label: 'GPT-6.2 Astra（最新フラッグシップ）' },
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
      { id: 'gpt-6-luna', label: 'GPT-6 Luna（高速・低コスト）' },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
    ],
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude API（Messages API）',
    shortLabel: 'Claude',
    description: 'Anthropic の最新 Messages API（Structured Outputs + Vision）に接続します。',
    needsApiKey: true,
    optionalBaseUrl: true,
    defaultModel: 'claude-sonnet-5-5',
    defaultBaseUrl: 'https://api.anthropic.com',
    apiKeyPlaceholder: 'sk-ant-...（または .env の ANTHROPIC_API_KEY）',
    baseUrlPlaceholder: 'https://api.anthropic.com',
    models: [
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5（標準）' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5（高速・軽量）' },
      { id: 'claude-fable-5-2', label: 'Claude Fable 5.2（最新高度推論）' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5（最上位）' },
    ],
  },
  {
    id: 'opencode',
    label: 'OpenCode Zen API（無料枠＆マルチモデル統合ゲートウェイ）',
    shortLabel: 'OpenCode Zen',
    description:
      'OpenCode Zen（opencode.ai/zen/v1）経由で無料ビジョンモデルや GPT-6.2 / Claude 5.5 / Gemini 4 / Grok 等を統一APIキーで利用できます。',
    needsApiKey: true,
    apiKeyOptional: true,
    optionalBaseUrl: true,
    defaultModel: 'mimo-v2.6-flash-free',
    defaultBaseUrl: 'https://opencode.ai/zen/v1',
    apiKeyPlaceholder: 'OpenCode APIキー（無料モデルは空欄でも可）',
    baseUrlPlaceholder: 'https://opencode.ai/zen/v1',
    note: 'OpenCode Zen はモデルごとに最適なエンドポイント（chat/completions, responses, messages, generateContent）へ自動ルーティングします。「モデル一覧を取得」で最新の画像対応モデルを読み込めます。',
    models: [
      { id: 'mimo-v2.6-flash-free', label: 'MiMo-V2.6-Flash Free [無料・画像対応]' },
      { id: 'deepseek-v4.1-flash-free', label: 'DeepSeek V4.1 Flash Free [無料・画像対応]' },
      { id: 'nemotron-3.5-super-vl-free', label: 'Nemotron 3.5 Super VL Free [無料・画像対応]' },
      { id: 'hy4-flash-free', label: 'Hy4 Flash Free [無料・画像対応]' },
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen' },
      { id: 'gpt-6.2-sol', label: 'GPT-6.2 Sol' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
      { id: 'claude-fable-5-2', label: 'Claude Fable 5.2' },
      { id: 'grok-4.7', label: 'Grok 4.7' },
      { id: 'kimi-k3.1-pro', label: 'Kimi K3.1 Pro' },
    ],
  },
  {
    id: 'opencode_go',
    label: 'OpenCode Go API（定額プラン: opencode.ai/zen/go/v1）',
    shortLabel: 'OpenCode Go',
    description:
      'OpenCode Go サブスクリプション（opencode.ai/zen/go/v1）向けの統合ゲートウェイ。DeepSeek V4.1 / GPT-6 Luna / Claude Haiku 5.5 / Gemini 4 Argon / Qwen4 等に接続します。',
    needsApiKey: true,
    apiKeyOptional: true,
    optionalBaseUrl: true,
    defaultModel: 'deepseek-v4.1-flash',
    defaultBaseUrl: 'https://opencode.ai/zen/go/v1',
    apiKeyPlaceholder: 'OpenCode Go APIキー（または .env の OPENCODE_GO_API_KEY）',
    baseUrlPlaceholder: 'https://opencode.ai/zen/go/v1',
    note: 'OpenCode Go 対象の画像対応モデルへ自動ルーティングします。「モデル一覧を取得」で現在の Go プラン対応モデル一覧を読み込めます。',
    models: [
      { id: 'deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash（高速・画像対応）' },
      { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
      { id: 'gemini-4-argon', label: 'Gemini 4 Argon' },
      { id: 'grok-4.7', label: 'Grok 4.7' },
      { id: 'kimi-k3.1-pro', label: 'Kimi K3.1 Pro' },
      { id: 'mimo-v2.6-flash', label: 'MiMo-V2.6-Flash' },
      { id: 'qwen4-max', label: 'Qwen4 Max' },
      { id: 'glm-5.3-flash', label: 'GLM-5.3-Flash' },
      { id: 'hy4-flash-free', label: 'Hy4 Flash Free [無料]' },
    ],
  },
  {
    id: 'openai_compatible',
    label: 'OpenAI互換 API（OpenRouter / Groq / Ollama 等）',
    shortLabel: 'OpenAI互換',
    description:
      'OpenAI 互換の Chat Completions Vision エンドポイント（OpenRouter・ローカルLLM等）に接続します。',
    needsApiKey: true,
    apiKeyOptional: true,
    needsBaseUrl: true,
    defaultModel: 'google/gemini-4-hydrogen',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    apiKeyPlaceholder: 'APIキー（ローカルLLM等は空欄可）',
    baseUrlPlaceholder: 'https://openrouter.ai/api/v1 または http://localhost:11434/v1',
    models: [
      { id: 'google/gemini-4-hydrogen', label: 'OpenRouter: google/gemini-4-hydrogen' },
      { id: 'openai/gpt-6.1-sol', label: 'OpenRouter: openai/gpt-6.1-sol' },
      { id: 'anthropic/claude-sonnet-5.5', label: 'OpenRouter: anthropic/claude-sonnet-5.5' },
    ],
  },
];

export const AI_CONFIG_STORAGE_KEY = 'poicho_ai_config_v1';

export function getProviderMeta(id: AiConcreteProviderId): AiProviderMeta {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

export function loadAiConfig(): AiRequestConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return { provider: 'auto' };
    const parsed = JSON.parse(raw) as Partial<AiRequestConfig>;
    const validProviders = new Set<string>([
      'auto',
      'gemini',
      'vertex_project',
      'vertex_express',
      'openai',
      'anthropic',
      'opencode',
      'opencode_go',
      'openai_compatible',
    ]);
    const provider =
      parsed.provider && validProviders.has(parsed.provider)
        ? parsed.provider
        : 'auto';
    return {
      provider,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
      project: typeof parsed.project === 'string' ? parsed.project : '',
      location: typeof parsed.location === 'string' ? parsed.location : '',
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
    };
  } catch {
    return { provider: 'auto' };
  }
}

export function saveAiConfig(config: AiRequestConfig): void {
  try {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors gracefully
  }
}
