import 'dotenv/config';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  STRICT_SCREENSHOT_JSON_SCHEMA,
  buildScreenshotPrompt,
  extractJsonText,
  fetchProviderModelsList,
  resolveOpenCodeRoute,
  type RegisteredAppSummary,
} from './src/lib/screenshotAiShared.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ConcreteProvider =
  | 'gemini'
  | 'vertex_project'
  | 'vertex_express'
  | 'openai'
  | 'anthropic'
  | 'opencode'
  | 'opencode_go'
  | 'openai_compatible';

type ProviderSelection = 'auto' | ConcreteProvider;

interface AiRequestConfig {
  provider?: ProviderSelection;
  apiKey?: string;
  model?: string;
  project?: string;
  location?: string;
  baseUrl?: string;
}

interface ResolvedProviderConfig {
  provider: ConcreteProvider;
  model: string;
  apiKey?: string;
  project?: string;
  location?: string;
  baseUrl?: string;
}

class HttpApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const CONCRETE_PROVIDERS: ConcreteProvider[] = [
  'gemini',
  'vertex_project',
  'vertex_express',
  'openai',
  'anthropic',
  'opencode',
  'opencode_go',
  'openai_compatible',
];

const DEFAULT_MODELS: Record<ConcreteProvider, string> = {
  gemini: 'gemini-4-hydrogen',
  vertex_project: 'gemini-4-hydrogen',
  vertex_express: 'gemini-3.8-flash',
  openai: 'gpt-6.2-sol',
  anthropic: 'claude-sonnet-5-5',
  opencode: 'mimo-v2.6-flash-free',
  opencode_go: 'deepseek-v4.1-flash',
  openai_compatible: 'google/gemini-4-hydrogen',
};

const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const ENV_FILE = path.resolve(__dirname, '.env');

function isLoopbackAddress(addr?: string): boolean {
  if (!addr) return false;
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

async function upsertEnvVars(updates: Record<string, string>): Promise<void> {
  let content = '';
  try {
    content = await fs.readFile(ENV_FILE, 'utf8');
  } catch {
    content = '';
  }

  const lines = content ? content.split(/\r?\n/) : [];
  const remaining = new Map(Object.entries(updates));

  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match) return line;
    const key = match[1];
    if (!remaining.has(key)) return line;
    const val = remaining.get(key) ?? '';
    remaining.delete(key);
    const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `${key}="${escaped}"`;
  });

  for (const [key, val] of remaining.entries()) {
    const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    nextLines.push(`${key}="${escaped}"`);
  }

  await fs.writeFile(ENV_FILE, nextLines.join('\n').replace(/\n*$/, '\n'), 'utf8');
  for (const [key, val] of Object.entries(updates)) {
    process.env[key] = val;
  }
}

function isTruthyEnv(val?: string): boolean {
  return val === 'true' || val === '1' || val === 'TRUE';
}

function cleanStr(val?: string): string {
  return typeof val === 'string' ? val.trim() : '';
}

function isVertexEnvFlag(): boolean {
  return (
    isTruthyEnv(process.env.GOOGLE_GENAI_USE_ENTERPRISE) ||
    isTruthyEnv(process.env.GOOGLE_GENAI_USE_VERTEXAI)
  );
}

function getEnvDefaults() {
  const vertexEnvFlag = isVertexEnvFlag();
  const googleApiKey = cleanStr(process.env.GOOGLE_API_KEY);
  const geminiKey = cleanStr(process.env.GEMINI_API_KEY) || (!vertexEnvFlag ? googleApiKey : '');
  const vertexProject =
    cleanStr(process.env.GOOGLE_CLOUD_PROJECT) || cleanStr(process.env.GCLOUD_PROJECT);
  const vertexLocation = cleanStr(process.env.GOOGLE_CLOUD_LOCATION) || 'global';
  const vertexExpressKey =
    cleanStr(process.env.VERTEX_API_KEY) || (vertexEnvFlag ? googleApiKey : '');
  const openaiKey = cleanStr(process.env.OPENAI_API_KEY);
  const openaiBaseUrl = cleanStr(process.env.OPENAI_BASE_URL) || 'https://api.openai.com/v1';
  const anthropicKey = cleanStr(process.env.ANTHROPIC_API_KEY);
  const anthropicBaseUrl = cleanStr(process.env.ANTHROPIC_BASE_URL) || 'https://api.anthropic.com';
  const opencodeKey = cleanStr(process.env.OPENCODE_API_KEY);
  const opencodeBaseUrl = cleanStr(process.env.OPENCODE_BASE_URL) || 'https://opencode.ai/zen/v1';
  const opencodeGoKey = cleanStr(process.env.OPENCODE_GO_API_KEY);
  const opencodeGoBaseUrl =
    cleanStr(process.env.OPENCODE_GO_BASE_URL) || 'https://opencode.ai/zen/go/v1';
  const compatBaseUrl = cleanStr(process.env.OPENAI_COMPATIBLE_BASE_URL);
  const compatKey = cleanStr(process.env.OPENAI_COMPATIBLE_API_KEY);

  const defaults = {
    gemini: {
      hasCredentials: Boolean(geminiKey),
      model: cleanStr(process.env.GEMINI_MODEL) || DEFAULT_MODELS.gemini,
    },
    vertex_project: {
      hasCredentials: Boolean(vertexProject),
      model: cleanStr(process.env.VERTEX_MODEL) || DEFAULT_MODELS.vertex_project,
      project: vertexProject,
      location: vertexLocation,
    },
    vertex_express: {
      hasCredentials: Boolean(vertexExpressKey),
      model: cleanStr(process.env.VERTEX_EXPRESS_MODEL) || DEFAULT_MODELS.vertex_express,
    },
    openai: {
      hasCredentials: Boolean(openaiKey),
      model: cleanStr(process.env.OPENAI_MODEL) || DEFAULT_MODELS.openai,
      baseUrl: openaiBaseUrl,
    },
    anthropic: {
      hasCredentials: Boolean(anthropicKey),
      model: cleanStr(process.env.ANTHROPIC_MODEL) || DEFAULT_MODELS.anthropic,
      baseUrl: anthropicBaseUrl,
    },
    opencode: {
      hasCredentials: Boolean(opencodeKey),
      model: cleanStr(process.env.OPENCODE_MODEL) || DEFAULT_MODELS.opencode,
      baseUrl: opencodeBaseUrl,
    },
    opencode_go: {
      hasCredentials: Boolean(opencodeGoKey),
      model: cleanStr(process.env.OPENCODE_GO_MODEL) || DEFAULT_MODELS.opencode_go,
      baseUrl: opencodeGoBaseUrl,
    },
    openai_compatible: {
      hasCredentials: Boolean(compatBaseUrl),
      model: cleanStr(process.env.OPENAI_COMPATIBLE_MODEL) || DEFAULT_MODELS.openai_compatible,
      baseUrl: compatBaseUrl,
    },
  };

  const configuredProviders = CONCRETE_PROVIDERS.filter((id) => defaults[id].hasCredentials);

  const rawEnvProvider = cleanStr(process.env.AI_PROVIDER).toLowerCase() as ProviderSelection;
  let preferredProvider: ConcreteProvider | null = null;

  if (
    rawEnvProvider &&
    rawEnvProvider !== 'auto' &&
    CONCRETE_PROVIDERS.includes(rawEnvProvider as ConcreteProvider) &&
    (defaults[rawEnvProvider as ConcreteProvider].hasCredentials ||
      rawEnvProvider === 'opencode' ||
      rawEnvProvider === 'opencode_go')
  ) {
    preferredProvider = rawEnvProvider as ConcreteProvider;
  } else if (vertexEnvFlag && defaults.vertex_project.hasCredentials) {
    preferredProvider = 'vertex_project';
  } else if (vertexEnvFlag && defaults.vertex_express.hasCredentials) {
    preferredProvider = 'vertex_express';
  } else {
    const autoOrder: ConcreteProvider[] = [
      'gemini',
      'vertex_project',
      'vertex_express',
      'openai',
      'anthropic',
      'opencode_go',
      'opencode',
      'openai_compatible',
    ];
    preferredProvider = autoOrder.find((p) => defaults[p].hasCredentials) ?? null;
  }

  return {
    preferredProvider,
    configuredProviders,
    defaults,
    secrets: {
      geminiKey,
      vertexExpressKey,
      openaiKey,
      anthropicKey,
      opencodeKey,
      opencodeGoKey,
      compatKey,
    },
  };
}

function resolveProviderConfig(reqConfig?: AiRequestConfig): ResolvedProviderConfig {
  const env = getEnvDefaults();
  const requested = cleanStr(reqConfig?.provider) as ProviderSelection;

  let provider: ConcreteProvider | null = null;
  if (requested && requested !== 'auto' && CONCRETE_PROVIDERS.includes(requested)) {
    provider = requested;
  } else {
    provider = env.preferredProvider;
  }

  if (!provider) {
    throw new HttpApiError(
      'AI プロバイダーが未設定です。モーダル右上の「AI設定」から API キー（Gemini / Vertex AI / OpenAI / Claude 等）を入力するか、サーバー側の .env を設定してください。',
      400
    );
  }

  const reqApiKey = cleanStr(reqConfig?.apiKey);
  const reqModel = cleanStr(reqConfig?.model);
  const reqProject = cleanStr(reqConfig?.project);
  const reqLocation = cleanStr(reqConfig?.location);
  const reqBaseUrl = cleanStr(reqConfig?.baseUrl);

  switch (provider) {
    case 'gemini': {
      const apiKey = reqApiKey || env.secrets.geminiKey;
      if (!apiKey) {
        throw new HttpApiError(
          'Gemini API キーが未設定です。「AI設定」で API キーを入力するか、.env の GEMINI_API_KEY を設定してください。',
          400
        );
      }
      return {
        provider,
        apiKey,
        model: reqModel || env.defaults.gemini.model,
      };
    }

    case 'vertex_project': {
      const project = reqProject || env.defaults.vertex_project.project;
      const location = reqLocation || env.defaults.vertex_project.location || 'global';
      if (!project) {
        throw new HttpApiError(
          'Vertex AI（GCPプロジェクト）を使うにはプロジェクトIDが必要です。「AI設定」でプロジェクトIDを入力するか、.env の GOOGLE_CLOUD_PROJECT を設定してください。',
          400
        );
      }
      return {
        provider,
        project,
        location,
        model: reqModel || env.defaults.vertex_project.model,
      };
    }

    case 'vertex_express': {
      const apiKey = reqApiKey || env.secrets.vertexExpressKey;
      if (!apiKey) {
        throw new HttpApiError(
          'Vertex AI Express Mode の API キーが未設定です。「AI設定」で API キーを入力するか、.env の VERTEX_API_KEY を設定してください。',
          400
        );
      }
      return {
        provider,
        apiKey,
        model: reqModel || env.defaults.vertex_express.model,
      };
    }

    case 'openai': {
      const apiKey = reqApiKey || env.secrets.openaiKey;
      if (!apiKey) {
        throw new HttpApiError(
          'OpenAI API キーが未設定です。「AI設定」で API キーを入力するか、.env の OPENAI_API_KEY を設定してください。',
          400
        );
      }
      return {
        provider,
        apiKey,
        baseUrl: (reqBaseUrl || env.defaults.openai.baseUrl).replace(/\/+$/, ''),
        model: reqModel || env.defaults.openai.model,
      };
    }

    case 'anthropic': {
      const apiKey = reqApiKey || env.secrets.anthropicKey;
      if (!apiKey) {
        throw new HttpApiError(
          'Anthropic API キーが未設定です。「AI設定」で API キーを入力するか、.env の ANTHROPIC_API_KEY を設定してください。',
          400
        );
      }
      return {
        provider,
        apiKey,
        baseUrl: (reqBaseUrl || env.defaults.anthropic.baseUrl).replace(/\/+$/, ''),
        model: reqModel || env.defaults.anthropic.model,
      };
    }

    case 'opencode': {
      return {
        provider,
        baseUrl: (reqBaseUrl || env.defaults.opencode.baseUrl).replace(/\/+$/, ''),
        apiKey: reqApiKey || env.secrets.opencodeKey || 'public',
        model: reqModel || env.defaults.opencode.model,
      };
    }

    case 'opencode_go': {
      return {
        provider,
        baseUrl: (reqBaseUrl || env.defaults.opencode_go.baseUrl).replace(/\/+$/, ''),
        apiKey: reqApiKey || env.secrets.opencodeGoKey || env.secrets.opencodeKey || 'public',
        model: reqModel || env.defaults.opencode_go.model,
      };
    }

    case 'openai_compatible': {
      const baseUrl = (reqBaseUrl || env.defaults.openai_compatible.baseUrl).replace(/\/+$/, '');
      if (!baseUrl) {
        throw new HttpApiError(
          'OpenAI互換 API の Base URL が未設定です。「AI設定」で Base URL（例: https://openrouter.ai/api/v1）を入力してください。',
          400
        );
      }
      return {
        provider,
        baseUrl,
        apiKey: reqApiKey || env.secrets.compatKey,
        model: reqModel || env.defaults.openai_compatible.model,
      };
    }
  }
}

async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }
  throw lastError;
}

function createGoogleGenAIClient(cfg: ResolvedProviderConfig): GoogleGenAI {
  if (cfg.provider === 'gemini') {
    return new GoogleGenAI({ apiKey: cfg.apiKey });
  }
  if (cfg.provider === 'vertex_express') {
    return new GoogleGenAI({
      vertexai: true,
      apiKey: cfg.apiKey,
    });
  }
  return new GoogleGenAI({
    vertexai: true,
    project: cfg.project,
    location: cfg.location || 'global',
  });
}

async function analyzeWithGoogleGenAI(
  cfg: ResolvedProviderConfig,
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const ai = createGoogleGenAIClient(cfg);
  const response = await callWithRetry(() =>
    ai.models.generateContent({
      model: cfg.model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedAppName: { type: Type.STRING },
            matchedAppId: { type: Type.STRING },
            screenshotType: { type: Type.STRING },
            unit: { type: Type.STRING },
            confirmedBalance: { type: Type.INTEGER },
            pendingBalance: { type: Type.INTEGER },
            expiryDate: { type: Type.STRING },
            summary: { type: Type.STRING },
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  points: { type: Type.INTEGER },
                  type: { type: Type.STRING },
                  date: { type: Type.STRING },
                  exchangeTarget: { type: Type.STRING },
                  note: { type: Type.STRING },
                },
                required: ['title', 'points', 'type', 'date'],
              },
            },
            reminders: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  kind: { type: Type.STRING },
                  dueDate: { type: Type.STRING },
                  actionDetail: { type: Type.STRING },
                  riskOrRewardText: { type: Type.STRING },
                },
                required: ['title', 'kind', 'dueDate', 'actionDetail'],
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
            'summary',
            'transactions',
            'reminders',
          ],
        },
      },
    })
  );
  return response.text ?? '';
}

async function fetchJsonWithError(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, init);
  const rawText = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    // Non-JSON response
  }
  if (!res.ok) {
    const errObj = data?.error as { message?: string } | undefined;
    const msg = errObj?.message || rawText || `HTTP ${res.status}`;
    throw new HttpApiError(msg, res.status);
  }
  return data;
}

async function analyzeWithOpenAI(
  cfg: ResolvedProviderConfig,
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const data = await callWithRetry(() =>
    fetchJsonWithError(`${cfg.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        instructions: '日本のポイ活アプリのスクリーンショット解析を行い、JSONのみを返してください。',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: `data:${mimeType};base64,${base64}` },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'PoikatsuScreenshotExtraction',
            strict: true,
            schema: STRICT_SCREENSHOT_JSON_SCHEMA,
          },
        },
      }),
    })
  );

  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text;
  }
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? ((item as { content: unknown[] }).content)
      : [];
    for (const part of content) {
      const p = part as { type?: string; text?: string };
      if ((p.type === 'output_text' || p.type === 'text') && typeof p.text === 'string') {
        return p.text;
      }
    }
  }
  return '';
}

async function analyzeWithAnthropic(
  cfg: ResolvedProviderConfig,
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const data = await callWithRetry(() =>
    fetchJsonWithError(`${cfg.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: STRICT_SCREENSHOT_JSON_SCHEMA,
          },
        },
      }),
    })
  );

  const content = Array.isArray(data.content) ? data.content : [];
  const textBlock = content.find((b) => (b as { type?: string }).type === 'text') as
    | { text?: string }
    | undefined;
  return textBlock?.text ?? '';
}

async function analyzeWithOpenAICompatible(
  cfg: ResolvedProviderConfig,
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cfg.apiKey) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  }

  const schemaGuide = JSON.stringify(STRICT_SCREENSHOT_JSON_SCHEMA);
  const data = await callWithRetry(() =>
    fetchJsonWithError(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `次の JSON Schema に完全一致する JSON オブジェクトのみを出力してください:\n${schemaGuide}`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
    })
  );

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const first = choices[0] as { message?: { content?: string } } | undefined;
  return first?.message?.content ?? '';
}

async function analyzeWithOpenCode(
  cfg: ResolvedProviderConfig,
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const route = resolveOpenCodeRoute(cfg.model);
  if (route === 'responses') {
    return analyzeWithOpenAI(cfg, base64, mimeType, prompt);
  }
  if (route === 'messages') {
    const data = await callWithRetry(() =>
      fetchJsonWithError(`${cfg.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey || '',
          Authorization: `Bearer ${cfg.apiKey || ''}`,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mimeType, data: base64 },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
          output_config: {
            format: { type: 'json_schema', schema: STRICT_SCREENSHOT_JSON_SCHEMA },
          },
        }),
      })
    );
    const content = Array.isArray(data.content) ? data.content : [];
    const textBlock = content.find((b) => (b as { type?: string }).type === 'text') as
      | { text?: string }
      | undefined;
    return textBlock?.text ?? '';
  }
  if (route === 'google-rest') {
    const googleBase = cfg.baseUrl?.includes('opencode.ai/zen')
      ? 'https://opencode.ai/inference/google/v1beta'
      : cfg.baseUrl;
    const data = await callWithRetry(() =>
      fetchJsonWithError(`${googleBase}/models/${encodeURIComponent(cfg.model)}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cfg.apiKey || '',
          Authorization: `Bearer ${cfg.apiKey || ''}`,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: STRICT_SCREENSHOT_JSON_SCHEMA,
          },
        }),
      })
    );
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    const parts = (candidates[0] as { content?: { parts?: Array<{ text?: string }> } } | undefined)
      ?.content?.parts;
    return parts?.[0]?.text ?? '';
  }
  return analyzeWithOpenAICompatible(cfg, base64, mimeType, prompt);
}

async function testProviderConnection(cfg: ResolvedProviderConfig): Promise<string> {
  if (cfg.provider === 'gemini' || cfg.provider === 'vertex_project' || cfg.provider === 'vertex_express') {
    const ai = createGoogleGenAIClient(cfg);
    const response = await ai.models.generateContent({
      model: cfg.model,
      contents: 'Reply with OK only.',
    });
    return (response.text ?? 'OK').trim();
  }

  if (cfg.provider === 'opencode' || cfg.provider === 'opencode_go') {
    const route = resolveOpenCodeRoute(cfg.model);
    if (route === 'responses') {
      await fetchJsonWithError(`${cfg.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({ model: cfg.model, input: 'Reply with OK only.', max_output_tokens: 16 }),
      });
      return 'OK';
    }
    if (route === 'messages') {
      await fetchJsonWithError(`${cfg.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey || '',
          Authorization: `Bearer ${cfg.apiKey || ''}`,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'Reply with OK only.' }],
        }),
      });
      return 'OK';
    }
    if (route === 'google-rest') {
      const googleBase = cfg.baseUrl?.includes('opencode.ai/zen')
        ? 'https://opencode.ai/inference/google/v1beta'
        : cfg.baseUrl;
      await fetchJsonWithError(`${googleBase}/models/${encodeURIComponent(cfg.model)}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cfg.apiKey || '',
          Authorization: `Bearer ${cfg.apiKey || ''}`,
        },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with OK only.' }] }] }),
      });
      return 'OK';
    }
  }

  if (cfg.provider === 'openai') {
    const data = await fetchJsonWithError(`${cfg.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        input: 'Reply with OK only.',
        max_output_tokens: 16,
      }),
    });
    return typeof data.output_text === 'string' ? data.output_text.trim() : 'OK';
  }

  if (cfg.provider === 'anthropic') {
    const data = await fetchJsonWithError(`${cfg.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
      }),
    });
    const content = Array.isArray(data.content) ? data.content : [];
    const textBlock = content.find((b) => (b as { type?: string }).type === 'text') as
      | { text?: string }
      | undefined;
    return (textBlock?.text ?? 'OK').trim();
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  await fetchJsonWithError(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with OK only.' }],
    }),
  });
  return 'OK';
}

function formatProviderError(err: unknown, cfg?: ResolvedProviderConfig): { status: number; error: string } {
  if (err instanceof HttpApiError) {
    if (err.status === 400 && !cfg) {
      return { status: 400, error: err.message };
    }
  }

  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status || 500;

  if (
    cfg?.provider === 'vertex_express' &&
    cfg.model.includes('gemini-4') &&
    (status === 404 ||
      status === 403 ||
      message.includes('NOT_FOUND') ||
      message.includes('PERMISSION_DENIED') ||
      message.includes('not found') ||
      message.includes('unsupported'))
  ) {
    return {
      status,
      error: `Vertex AI Express Mode（APIキーのみ）では「${cfg.model}」が利用できないか未開放の可能性があります。Hydrogen 等を使う場合は「Vertex AI（GCPプロジェクト / ADC認証）」でプロジェクトIDを設定するか、モデルを「gemini-3.8-flash」または「Gemini Developer API」に切り替えてください。`,
    };
  }

  if (
    cfg?.provider === 'vertex_project' &&
    (status === 401 ||
      status === 403 ||
      message.includes('Could not load the default credentials') ||
      message.includes('PERMISSION_DENIED') ||
      message.includes('UNAUTHENTICATED'))
  ) {
    return {
      status: status >= 400 ? status : 403,
      error: `Vertex AI（プロジェクト: ${cfg.project} / ロケーション: ${cfg.location}）の認証に失敗しました。サーバー側で「gcloud auth application-default login」または GOOGLE_APPLICATION_CREDENTIALS、および Vertex AI API の有効化を確認してください。`,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    message.includes('API_KEY_INVALID') ||
    message.includes('invalid_api_key') ||
    message.includes('authentication_error') ||
    message.includes('PERMISSION_DENIED')
  ) {
    return {
      status: status >= 400 && status < 500 ? status : 403,
      error: `${cfg?.provider ?? 'AI'} の API キー認証に失敗しました。「AI設定」または .env の API キーを確認してください。`,
    };
  }

  if (status === 404 || message.includes('NOT_FOUND') || message.includes('model_not_found')) {
    return {
      status: 404,
      error: `指定されたモデル「${cfg?.model ?? ''}」が見つからないか、このアカウント／リージョンでは利用できません。別のモデルを選択してください。`,
    };
  }

  if (status === 429 || message.includes('RESOURCE_EXHAUSTED') || message.includes('rate_limit')) {
    return {
      status: 429,
      error: 'API のリクエスト上限（レート制限／クォータ）に達しました。時間をおいて再試行するか、別のモデル／APIキーをお試しください。',
    };
  }

  if (err instanceof HttpApiError) {
    return {
      status: err.status >= 400 ? err.status : 500,
      error: `AI API エラー (${err.status}): ${err.message}`,
    };
  }

  console.error('AI request error:', err);
  return {
    status: 500,
    error: `AI 処理中にエラーが発生しました: ${message}`,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/store', async (_req, res) => {
    try {
      const raw = await fs.readFile(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!Array.isArray(parsed.apps) || !Array.isArray(parsed.transactions)) {
        res.json({ exists: false, data: null });
        return;
      }
      res.json({ exists: true, data: parsed });
    } catch {
      res.json({ exists: false, data: null });
    }
  });

  app.put('/api/store', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      if (!body || !Array.isArray(body.apps) || !Array.isArray(body.transactions)) {
        res.status(400).json({ error: 'ストアデータの形式が不正です。' });
        return;
      }
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmpFile = `${STORE_FILE}.tmp`;
      await fs.writeFile(tmpFile, JSON.stringify(body, null, 2), 'utf8');
      await fs.rename(tmpFile, STORE_FILE);
      res.json({ ok: true });
    } catch (err) {
      console.error('Store write error:', err);
      res.status(500).json({ error: 'データのファイル保存に失敗しました。' });
    }
  });

  app.get('/api/ai-status', (_req, res) => {
    const env = getEnvDefaults();
    res.json({
      preferredProvider: env.preferredProvider,
      configuredProviders: env.configuredProviders,
      defaults: env.defaults,
    });
  });

  app.post('/api/ai-env', async (req, res) => {
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      res.status(403).json({ error: '.env の書き換えはローカル端末（localhost）からのみ許可されています。' });
      return;
    }

    try {
      const body = req.body as { aiConfig?: AiRequestConfig; clear?: boolean };
      const cfg = body?.aiConfig;
      const provider = cleanStr(cfg?.provider) as ProviderSelection;
      if (!provider || provider === 'auto' || !CONCRETE_PROVIDERS.includes(provider)) {
        res.status(400).json({ error: '保存するプロバイダーを具体的に選択してください。' });
        return;
      }

      const updates: Record<string, string> = {};
      const clear = Boolean(body?.clear);

      if (clear) {
        updates.AI_PROVIDER = 'auto';
        if (provider === 'gemini') updates.GEMINI_API_KEY = '';
        if (provider === 'vertex_project') {
          updates.GOOGLE_CLOUD_PROJECT = '';
          updates.GOOGLE_CLOUD_LOCATION = 'global';
        }
        if (provider === 'vertex_express') updates.VERTEX_API_KEY = '';
        if (provider === 'openai') updates.OPENAI_API_KEY = '';
        if (provider === 'anthropic') updates.ANTHROPIC_API_KEY = '';
        if (provider === 'opencode') updates.OPENCODE_API_KEY = '';
        if (provider === 'opencode_go') updates.OPENCODE_GO_API_KEY = '';
        if (provider === 'openai_compatible') {
          updates.OPENAI_COMPATIBLE_BASE_URL = '';
          updates.OPENAI_COMPATIBLE_API_KEY = '';
        }
      } else {
        updates.AI_PROVIDER = provider;
        const apiKey = cleanStr(cfg?.apiKey);
        const model = cleanStr(cfg?.model);
        const project = cleanStr(cfg?.project);
        const location = cleanStr(cfg?.location);
        const baseUrl = cleanStr(cfg?.baseUrl);

        if (provider === 'gemini') {
          if (apiKey) updates.GEMINI_API_KEY = apiKey;
          if (model) updates.GEMINI_MODEL = model;
        } else if (provider === 'vertex_project') {
          if (project) updates.GOOGLE_CLOUD_PROJECT = project;
          if (location) updates.GOOGLE_CLOUD_LOCATION = location;
          if (model) updates.VERTEX_MODEL = model;
        } else if (provider === 'vertex_express') {
          if (apiKey) updates.VERTEX_API_KEY = apiKey;
          if (model) updates.VERTEX_EXPRESS_MODEL = model;
        } else if (provider === 'openai') {
          if (apiKey) updates.OPENAI_API_KEY = apiKey;
          if (model) updates.OPENAI_MODEL = model;
          if (baseUrl) updates.OPENAI_BASE_URL = baseUrl;
        } else if (provider === 'anthropic') {
          if (apiKey) updates.ANTHROPIC_API_KEY = apiKey;
          if (model) updates.ANTHROPIC_MODEL = model;
          if (baseUrl) updates.ANTHROPIC_BASE_URL = baseUrl;
        } else if (provider === 'opencode') {
          if (apiKey) updates.OPENCODE_API_KEY = apiKey;
          if (model) updates.OPENCODE_MODEL = model;
          if (baseUrl) updates.OPENCODE_BASE_URL = baseUrl;
        } else if (provider === 'opencode_go') {
          if (apiKey) updates.OPENCODE_GO_API_KEY = apiKey;
          if (model) updates.OPENCODE_GO_MODEL = model;
          if (baseUrl) updates.OPENCODE_GO_BASE_URL = baseUrl;
        } else if (provider === 'openai_compatible') {
          if (baseUrl) updates.OPENAI_COMPATIBLE_BASE_URL = baseUrl;
          if (apiKey) updates.OPENAI_COMPATIBLE_API_KEY = apiKey;
          if (model) updates.OPENAI_COMPATIBLE_MODEL = model;
        }
      }

      await upsertEnvVars(updates);
      const env = getEnvDefaults();
      res.json({
        ok: true,
        status: {
          preferredProvider: env.preferredProvider,
          configuredProviders: env.configuredProviders,
          defaults: env.defaults,
        },
      });
    } catch (err) {
      console.error('Env update error:', err);
      res.status(500).json({ error: '.env の保存に失敗しました。' });
    }
  });

  app.post('/api/ai-models', async (req, res) => {
    try {
      const body = req.body as { aiConfig?: AiRequestConfig };
      const env = getEnvDefaults();
      const provider = cleanStr(body?.aiConfig?.provider) as ConcreteProvider;
      const reqKey = cleanStr(body?.aiConfig?.apiKey);
      const reqBaseUrl = cleanStr(body?.aiConfig?.baseUrl);
      const apiKey =
        reqKey ||
        (provider === 'gemini'
          ? env.secrets.geminiKey
          : provider === 'openai'
            ? env.secrets.openaiKey
            : provider === 'opencode'
              ? env.secrets.opencodeKey
              : provider === 'opencode_go'
                ? (env.secrets.opencodeGoKey || env.secrets.opencodeKey)
                : provider === 'openai_compatible'
                  ? env.secrets.compatKey
                  : '');
      const baseUrl =
        reqBaseUrl ||
        (provider === 'openai'
          ? env.defaults.openai.baseUrl
          : provider === 'opencode'
            ? env.defaults.opencode.baseUrl
            : provider === 'opencode_go'
              ? env.defaults.opencode_go.baseUrl
              : provider === 'openai_compatible'
                ? env.defaults.openai_compatible.baseUrl
                : '');
      const models = await fetchProviderModelsList({ provider, baseUrl, apiKey });
      res.json({ ok: true, models });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました。',
      });
    }
  });

  app.post('/api/ai-test', async (req, res) => {
    let resolved: ResolvedProviderConfig | undefined;
    try {
      const body = req.body as { aiConfig?: AiRequestConfig };
      resolved = resolveProviderConfig(body?.aiConfig);
      const reply = await testProviderConnection(resolved);
      res.json({
        ok: true,
        provider: resolved.provider,
        model: resolved.model,
        reply,
      });
    } catch (err) {
      const formatted = formatProviderError(err, resolved);
      res.status(formatted.status).json({ ok: false, error: formatted.error });
    }
  });

  app.post('/api/parse-screenshot', async (req, res) => {
    let resolved: ResolvedProviderConfig | undefined;
    try {
      const body = req.body as {
        imageBase64?: string;
        mimeType?: string;
        registeredApps?: RegisteredAppSummary[];
        aiConfig?: AiRequestConfig;
      };

      const rawBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64.trim() : '';
      const rawMime = typeof body?.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
      const normalizedMime = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;

      if (!rawBase64 || !ALLOWED_MIME_TYPES.has(normalizedMime)) {
        res.status(400).json({
          error: '画像データが正しくありません。PNG / JPG / WebP 形式のスクリーンショットを選択してください。',
        });
        return;
      }

      if (rawBase64.length > 14 * 1024 * 1024) {
        res.status(400).json({
          error: '画像サイズが大きすぎます。10MB以下のスクリーンショットをお試しください。',
        });
        return;
      }

      resolved = resolveProviderConfig(body?.aiConfig);
      const registeredApps = Array.isArray(body.registeredApps) ? body.registeredApps.slice(0, 40) : [];
      const prompt = buildScreenshotPrompt(registeredApps);

      let rawText = '';
      switch (resolved.provider) {
        case 'gemini':
        case 'vertex_project':
        case 'vertex_express':
          rawText = await analyzeWithGoogleGenAI(resolved, rawBase64, normalizedMime, prompt);
          break;
        case 'openai':
          rawText = await analyzeWithOpenAI(resolved, rawBase64, normalizedMime, prompt);
          break;
        case 'anthropic':
          rawText = await analyzeWithAnthropic(resolved, rawBase64, normalizedMime, prompt);
          break;
        case 'opencode':
        case 'opencode_go':
          rawText = await analyzeWithOpenCode(resolved, rawBase64, normalizedMime, prompt);
          break;
        case 'openai_compatible':
          rawText = await analyzeWithOpenAICompatible(resolved, rawBase64, normalizedMime, prompt);
          break;
      }

      const jsonText = extractJsonText(rawText);
      if (!jsonText) {
        res.status(502).json({ error: 'AI からの解析結果が空でした。別の画像でもう一度お試しください。' });
        return;
      }

      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      res.json({
        ...parsed,
        _meta: {
          provider: resolved.provider,
          model: resolved.model,
        },
      });
    } catch (err) {
      const formatted = formatProviderError(err, resolved);
      res.status(formatted.status).json({ error: formatted.error });
    }
  });

  if (isProd) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Poicho server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
