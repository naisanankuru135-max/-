import { Capacitor } from '@capacitor/core';
import { GoogleGenAI, Type } from '@google/genai';
import {
  AiConcreteProviderId,
  AiRequestConfig,
  ParsedScreenshotResult,
} from '../types/poikatsu';
import { getProviderMeta } from '../data/aiProviders';
import {
  STRICT_SCREENSHOT_JSON_SCHEMA,
  buildScreenshotPrompt,
  extractJsonText,
  resolveOpenCodeRoute,
  type RegisteredAppSummary,
} from './screenshotAiShared';

export type ParsedScreenshotWithMeta = ParsedScreenshotResult & {
  _meta?: { provider: AiConcreteProviderId; model: string };
};

export function isNativeMobileRuntime(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function resolveDirectConfig(aiConfig: AiRequestConfig): {
  provider: AiConcreteProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
} {
  if (aiConfig.provider === 'auto') {
    throw new Error(
      'スマホ単体（または静的ビルド）で実行中のため「自動（.env）」は使えません。「AI設定」からプロバイダーと API キーを選択してください。'
    );
  }

  const provider = aiConfig.provider;
  if (provider === 'vertex_project') {
    throw new Error(
      'Vertex AI（GCPプロジェクト / ADC認証）は PC サーバー（server.ts）接続時のみ利用できます。スマホ単体では「Gemini Developer API」「Vertex AI Express Mode」「OpenAI」「Claude」等を選択してください。'
    );
  }

  const meta = getProviderMeta(provider);
  const apiKey =
    aiConfig.apiKey?.trim() ||
    (provider === 'opencode' || provider === 'opencode_go' ? 'public' : '');
  const model = aiConfig.model?.trim() || meta.defaultModel;
  const baseUrl = (aiConfig.baseUrl?.trim() || meta.defaultBaseUrl || '').replace(/\/+$/, '');

  if (meta.needsApiKey && !meta.apiKeyOptional && !apiKey) {
    throw new Error(`${meta.shortLabel} の API キーが未設定です。「AI設定」で入力してください。`);
  }
  if (meta.needsBaseUrl && !baseUrl) {
    throw new Error('OpenAI互換 API の Base URL を「AI設定」で入力してください。');
  }

  return { provider, model, apiKey, baseUrl };
}

async function fetchJsonDirect(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, init);
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    // Non-JSON
  }
  if (!res.ok) {
    const errObj = data?.error as { message?: string } | undefined;
    throw new Error(errObj?.message || raw || `HTTP ${res.status}`);
  }
  return data;
}

function createDirectGoogleGenAI(
  provider: 'gemini' | 'vertex_express',
  apiKey: string
): GoogleGenAI {
  // Note: @google/genai's browser bundle checks `options.vertexai` (not `enterprise`).
  return provider === 'vertex_express'
    ? new GoogleGenAI({ vertexai: true, apiKey })
    : new GoogleGenAI({ apiKey });
}

export async function testAiDirect(aiConfig: AiRequestConfig): Promise<{
  provider: AiConcreteProviderId;
  model: string;
}> {
  const cfg = resolveDirectConfig(aiConfig);

  if (cfg.provider === 'gemini' || cfg.provider === 'vertex_express') {
    const ai = createDirectGoogleGenAI(cfg.provider, cfg.apiKey);
    await ai.models.generateContent({
      model: cfg.model,
      contents: 'Reply with OK only.',
    });
    return { provider: cfg.provider, model: cfg.model };
  }

  if (cfg.provider === 'openai') {
    await fetchJsonDirect(`${cfg.baseUrl}/responses`, {
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
    return { provider: cfg.provider, model: cfg.model };
  }

  if (cfg.provider === 'anthropic') {
    await fetchJsonDirect(`${cfg.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
      }),
    });
    return { provider: cfg.provider, model: cfg.model };
  }

  if (cfg.provider === 'opencode' || cfg.provider === 'opencode_go') {
    const route = resolveOpenCodeRoute(cfg.model);
    if (route === 'responses') {
      await fetchJsonDirect(`${cfg.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({ model: cfg.model, input: 'Reply with OK only.', max_output_tokens: 16 }),
      });
      return { provider: cfg.provider, model: cfg.model };
    }
    if (route === 'messages') {
      await fetchJsonDirect(`${cfg.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          Authorization: `Bearer ${cfg.apiKey}`,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'Reply with OK only.' }],
        }),
      });
      return { provider: cfg.provider, model: cfg.model };
    }
    if (route === 'google-rest') {
      const googleBase = cfg.baseUrl.includes('opencode.ai/zen')
        ? 'https://opencode.ai/inference/google/v1beta'
        : cfg.baseUrl;
      await fetchJsonDirect(`${googleBase}/models/${encodeURIComponent(cfg.model)}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cfg.apiKey,
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with OK only.' }] }] }),
      });
      return { provider: cfg.provider, model: cfg.model };
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  await fetchJsonDirect(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with OK only.' }],
    }),
  });
  return { provider: cfg.provider, model: cfg.model };
}

export async function parseScreenshotDirect(params: {
  imageBase64: string;
  mimeType: string;
  registeredApps: RegisteredAppSummary[];
  aiConfig: AiRequestConfig;
}): Promise<ParsedScreenshotWithMeta> {
  const cfg = resolveDirectConfig(params.aiConfig);
  const prompt = buildScreenshotPrompt(params.registeredApps);
  const mimeType = params.mimeType === 'image/jpg' ? 'image/jpeg' : params.mimeType;

  let rawText = '';

  if (cfg.provider === 'gemini' || cfg.provider === 'vertex_express') {
    const ai = createDirectGoogleGenAI(cfg.provider, cfg.apiKey);

    const response = await ai.models.generateContent({
      model: cfg.model,
      contents: {
        parts: [
          { inlineData: { mimeType, data: params.imageBase64 } },
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
    });
    rawText = response.text ?? '';
  } else if (cfg.provider === 'openai') {
    const data = await fetchJsonDirect(`${cfg.baseUrl}/responses`, {
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
              { type: 'input_image', image_url: `data:${mimeType};base64,${params.imageBase64}` },
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
    });

    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      rawText = data.output_text;
    } else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        const content = (item as { content?: Array<{ type?: string; text?: string }> }).content;
        const found = content?.find((c) => (c.type === 'output_text' || c.type === 'text') && c.text);
        if (found?.text) {
          rawText = found.text;
          break;
        }
      }
    }
  } else if (cfg.provider === 'anthropic') {
    const data = await fetchJsonDirect(`${cfg.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
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
                  data: params.imageBase64,
                },
              },
              { type: 'text', text: prompt },
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
    });
    const content = Array.isArray(data.content) ? data.content : [];
    const block = content.find((b) => (b as { type?: string }).type === 'text') as
      | { text?: string }
      | undefined;
    rawText = block?.text ?? '';
  } else if (cfg.provider === 'opencode' || cfg.provider === 'opencode_go') {
    const route = resolveOpenCodeRoute(cfg.model);
    if (route === 'responses') {
      const data = await fetchJsonDirect(`${cfg.baseUrl}/responses`, {
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
                { type: 'input_image', image_url: `data:${mimeType};base64,${params.imageBase64}` },
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
      });
      if (typeof data.output_text === 'string' && data.output_text.trim()) {
        rawText = data.output_text;
      }
    } else if (route === 'messages') {
      const data = await fetchJsonDirect(`${cfg.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          Authorization: `Bearer ${cfg.apiKey}`,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
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
                  source: { type: 'base64', media_type: mimeType, data: params.imageBase64 },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
          output_config: {
            format: { type: 'json_schema', schema: STRICT_SCREENSHOT_JSON_SCHEMA },
          },
        }),
      });
      const content = Array.isArray(data.content) ? data.content : [];
      const block = content.find((b) => (b as { type?: string }).type === 'text') as
        | { text?: string }
        | undefined;
      rawText = block?.text ?? '';
    } else if (route === 'google-rest') {
      const googleBase = cfg.baseUrl.includes('opencode.ai/zen')
        ? 'https://opencode.ai/inference/google/v1beta'
        : cfg.baseUrl;
      const data = await fetchJsonDirect(
        `${googleBase}/models/${encodeURIComponent(cfg.model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cfg.apiKey,
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType, data: params.imageBase64 } },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: STRICT_SCREENSHOT_JSON_SCHEMA,
            },
          }),
        }
      );
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const parts = (candidates[0] as { content?: { parts?: Array<{ text?: string }> } } | undefined)
        ?.content?.parts;
      rawText = parts?.[0]?.text ?? '';
    } else {
      const data = await fetchJsonDirect(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `次の JSON Schema に一致する JSON オブジェクトのみを出力してください:\n${JSON.stringify(
                STRICT_SCREENSHOT_JSON_SCHEMA
              )}`,
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${params.imageBase64}` } },
              ],
            },
          ],
        }),
      });
      const choices = Array.isArray(data.choices) ? data.choices : [];
      const first = choices[0] as { message?: { content?: string } } | undefined;
      rawText = first?.message?.content ?? '';
    }
  } else {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    const data = await fetchJsonDirect(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `次の JSON Schema に一致する JSON オブジェクトのみを出力してください:\n${JSON.stringify(
              STRICT_SCREENSHOT_JSON_SCHEMA
            )}`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${params.imageBase64}` } },
            ],
          },
        ],
      }),
    });
    const choices = Array.isArray(data.choices) ? data.choices : [];
    const first = choices[0] as { message?: { content?: string } } | undefined;
    rawText = first?.message?.content ?? '';
  }

  const jsonText = extractJsonText(rawText);
  if (!jsonText) {
    throw new Error('AI からの解析結果が空でした。別の画像でもう一度お試しください。');
  }
  const parsed = JSON.parse(jsonText) as ParsedScreenshotResult;
  return {
    ...parsed,
    _meta: {
      provider: cfg.provider,
      model: cfg.model,
    },
  };
}
