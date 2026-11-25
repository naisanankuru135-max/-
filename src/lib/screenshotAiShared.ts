export interface RegisteredAppSummary {
  id: string;
  name: string;
  unit: string;
  pointsPerYen: number;
}

export const STRICT_SCREENSHOT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    detectedAppName: {
      type: 'string',
      description: '検出されたポイ活アプリ・サービス名（例: モッピー）',
    },
    matchedAppId: {
      type: 'string',
      description: '登録済みアプリ一覧で一致したid。一致しない場合は空文字',
    },
    screenshotType: {
      type: 'string',
      enum: ['balance_screen', 'history_list', 'mixed', 'unknown'],
      description: 'balance_screen | history_list | mixed | unknown',
    },
    unit: {
      type: 'string',
      description: 'ポイントの単位（P, pt, マイル等）',
    },
    confirmedBalance: {
      type: 'integer',
      description: '読み取れた確定保有ポイント。画面に無ければ -1',
    },
    pendingBalance: {
      type: 'integer',
      description: '読み取れた判定中・予定ポイント。画面に無ければ -1',
    },
    expiryDate: {
      type: 'string',
      description: '有効期限（YYYY-MM-DD）。無ければ空文字',
    },
    summary: {
      type: 'string',
      description: '読み取った内容の簡潔な日本語要約（1文）',
    },
    transactions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          points: { type: 'integer' },
          type: {
            type: 'string',
            enum: ['earned', 'pending', 'exchanged'],
            description: 'earned | pending | exchanged',
          },
          date: {
            type: 'string',
            description: 'YYYY-MM-DD',
          },
          exchangeTarget: {
            type: 'string',
            description: '交換先名（交換履歴の場合のみ。該当なしは空文字）',
          },
          note: {
            type: 'string',
            description: '補足メモ（なければ空文字）',
          },
        },
        required: ['title', 'points', 'type', 'date', 'exchangeTarget', 'note'],
      },
    },
    reminders: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          kind: {
            type: 'string',
            enum: ['condition', 'cancellation', 'campaign'],
          },
          dueDate: {
            type: 'string',
            description: 'YYYY-MM-DD',
          },
          actionDetail: { type: 'string' },
          riskOrRewardText: { type: 'string' },
        },
        required: ['title', 'kind', 'dueDate', 'actionDetail', 'riskOrRewardText'],
      },
    },
  },
  required: [
    'detectedAppName',
    'matchedAppId',
    'screenshotType',
    'unit',
    'confirmedBalance',
    'pendingBalance',
    'expiryDate',
    'summary',
    'transactions',
    'reminders',
  ],
};

export function buildScreenshotPrompt(registeredApps: RegisteredAppSummary[]): string {
  const appListText =
    registeredApps.length > 0
      ? registeredApps
          .map((a) => `- id: "${a.id}", 名前: "${a.name}", 単位: "${a.unit}", レート: ${a.pointsPerYen}${a.unit}=1円`)
          .join('\n')
      : '（未登録）';

  const todayStr = new Date().toISOString().slice(0, 10);

  return [
    'あなたは日本のポイ活アプリ・リワードサイト（モッピー、ハピタス、ポイントインカム、トリマ、ワラウ、ちょびリッチ、楽天ポイント、Vポイント、PayPay、dポイント、Ponta、ECナビ、メルカリ、Freecash、Mistplay、Powl、クラシルリワード、ONE、TikTok Lite、プラリー、マクロミル、CODE、アメフリ、ポイントタウン、PUI、ニフティポイントクラブ、げん玉、Cashwalk等）のスクリーンショットを読み取る専門アシスタントです。',
    '添付されたスクリーンショットから、アプリ名・保有ポイント残高・判定中（予定）ポイント・有効期限・案件や獲得/交換履歴・達成条件や解約期限リマインダーを正確に抽出してください。',
    '',
    `今日の日付: ${todayStr}`,
    'ユーザーが登録済みのポイ活アプリ一覧:',
    appListText,
    '',
    '抽出ルール:',
    '1. スクリーンショットに表示されているアプリ・サービスを特定し、登録済みアプリと一致すれば matchedAppId にその id を入れてください（一致しない場合は空文字）。',
    '2. 残高画面（マイページ・ホーム等）なら confirmedBalance（確定・保有ポイント数値）と pendingBalance（判定中・予定ポイント数値）を整数で抽出してください。表示されていない項目は -1 にしてください。',
    '3. 履歴・通帳画面であれば、読み取れる各案件を transactions 配列に入れてください。date は YYYY-MM-DD 形式（年が省略されている場合は直近の適切な年を補完）。type は "earned"（確定・承認済）、"pending"（判定中・予定・承認待ち）、"exchanged"（交換・利用・出金）のいずれか。points は正の整数にしてください。exchangeTarget や note が無い場合は空文字 "" にしてください。',
    '4. 案件詳細やキャンペーン画面に「無料期間終了・解約期限」「○日以内に条件達成」「キャンペーン締切」等の期限情報が含まれている場合は reminders 配列に入れてください。kind は "cancellation"（解約期限）| "condition"（達成条件）| "campaign"（キャンペーン）、dueDate は YYYY-MM-DD 形式にしてください。該当が無ければ空配列 [] にしてください。',
    '5. 有効期限が画面内に明記されていれば expiryDate に YYYY-MM-DD 形式で入れてください（不明なら空文字 ""）。',
    '6. 読み取れない数値を推測で捏造しないでください。',
    '7. 出力は指定された JSON スキーマに厳密に従った JSON オブジェクトのみを返してください。',
  ].join('\n');
}

export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return fenced[1].trim();
  }
  return trimmed;
}

export type OpenCodeEndpointKind = 'chat-completions' | 'responses' | 'messages' | 'google-rest';

export function resolveOpenCodeRoute(model: string): OpenCodeEndpointKind {
  const m = model.trim().toLowerCase();
  if (m.startsWith('gpt-') || m.startsWith('grok-') || m.startsWith('muse-')) {
    return 'responses';
  }
  if (
    m.startsWith('claude-') ||
    m.startsWith('qwen3.5') ||
    m.startsWith('qwen3.6') ||
    m.startsWith('qwen3.7') ||
    m.startsWith('qwen3.8') ||
    m.startsWith('qwen4') ||
    m === 'minimax-m3'
  ) {
    return 'messages';
  }
  if (m.startsWith('gemini-')) {
    return 'google-rest';
  }
  return 'chat-completions';
}

export interface DiscoveredModelOption {
  id: string;
  label: string;
}

export async function fetchProviderModelsList(params: {
  provider: string;
  baseUrl?: string;
  apiKey?: string;
}): Promise<DiscoveredModelOption[]> {
  const provider = params.provider;
  const apiKey = (params.apiKey || '').trim();

  if (provider === 'gemini') {
    if (!apiKey) {
      throw new Error('Gemini API のモデル一覧を取得するには API キーを入力してください。');
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) throw new Error(`モデル一覧の取得に失敗しました (HTTP ${res.status})`);
    const data = (await res.json()) as {
      models?: Array<{
        name?: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    return (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => {
        const id = (m.name || '').replace(/^models\//, '');
        return { id, label: m.displayName ? `${m.displayName}` : id };
      })
      .filter((m) => Boolean(m.id));
  }

  if (provider === 'opencode' || provider === 'opencode_go') {
    const defaultUrl =
      provider === 'opencode_go' ? 'https://opencode.ai/zen/go/v1' : 'https://opencode.ai/zen/v1';
    const base = (params.baseUrl || defaultUrl).replace(/\/+$/, '');
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(`${base}/models`, { headers });
    if (!res.ok) throw new Error(`OpenCode モデル一覧の取得に失敗しました (HTTP ${res.status})`);
    const data = (await res.json()) as {
      data?: Array<{
        id?: string;
        name?: string;
        modalities?: { input?: string[] };
        cost?: { text?: { input?: { price?: number } } };
      }>;
    };
    const items = (data.data || []).filter((m) => {
      const inputs = m.modalities?.input;
      if (!Array.isArray(inputs)) return true;
      return inputs.some((i) => i.startsWith('image'));
    });
    return items
      .map((m) => {
        const id = m.id || '';
        const isFree = m.cost?.text?.input?.price === 0 || id.endsWith('-free');
        const name = m.name || id;
        return {
          id,
          label: isFree ? `${name} [無料]` : name,
        };
      })
      .filter((m) => Boolean(m.id));
  }

  if (provider === 'openai' || provider === 'openai_compatible') {
    const base = (
      params.baseUrl || (provider === 'openai' ? 'https://api.openai.com/v1' : '')
    ).replace(/\/+$/, '');
    if (!base) throw new Error('Base URL を入力してください。');
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(`${base}/models`, { headers });
    if (!res.ok) throw new Error(`モデル一覧の取得に失敗しました (HTTP ${res.status})`);
    const data = (await res.json()) as { data?: Array<{ id?: string; name?: string }> };
    return (data.data || [])
      .map((m) => ({ id: m.id || '', label: m.name || m.id || '' }))
      .filter((m) => Boolean(m.id))
      .slice(0, 120);
  }

  return [];
}
