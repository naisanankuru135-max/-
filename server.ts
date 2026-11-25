import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '15mb' }));

  app.post('/api/parse-screenshot', async (req, res) => {
    try {
      const body = req.body as {
        imageBase64?: string;
        mimeType?: string;
        registeredApps?: Array<{ id: string; name: string; unit: string; pointsPerYen: number }>;
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

      const registeredApps = Array.isArray(body.registeredApps) ? body.registeredApps.slice(0, 40) : [];
      const appListText =
        registeredApps.length > 0
          ? registeredApps
              .map((a) => `- id: "${a.id}", 名前: "${a.name}", 単位: "${a.unit}", レート: ${a.pointsPerYen}${a.unit}=1円`)
              .join('\n')
          : '（未登録）';

      const todayStr = new Date().toISOString().slice(0, 10);

      const prompt = [
        'あなたは日本のポイ活アプリ（モッピー、ハピタス、ポイントインカム、トリマ、ワラウ、ちょびリッチ、楽天ポイント、Vポイント、PayPay、dポイント、Ponta、ECナビ等）のスクリーンショットを読み取る専門アシスタントです。',
        '添付されたスクリーンショットから、アプリ名・保有ポイント残高・判定中（予定）ポイント・有効期限・案件や獲得/交換履歴を正確に抽出してください。',
        '',
        `今日の日付: ${todayStr}`,
        'ユーザーが登録済みのポイ活アプリ一覧:',
        appListText,
        '',
        '抽出ルール:',
        '1. スクリーンショットに表示されているアプリ・サービスを特定し、登録済みアプリと一致すれば matchedAppId にその id を入れてください（一致しない場合は空文字）。',
        '2. 残高画面（マイページ・ホーム等）なら confirmedBalance（確定・保有ポイント数値）と pendingBalance（判定中・予定ポイント数値）を整数で抽出してください。表示されていない項目は -1 にしてください。',
        '3. 履歴・通帳画面であれば、読み取れる各案件を transactions 配列に入れてください。date は YYYY-MM-DD 形式（年が省略されている場合は直近の適切な年を補完）。type は "earned"（確定・承認済）、"pending"（判定中・予定・承認待ち）、"exchanged"（交換・利用・出金）のいずれか。points は正の整数にしてください。',
        '4. 有効期限が画面内に明記されていれば expiryDate に YYYY-MM-DD 形式で入れてください（不明なら空文字）。',
        '5. 読み取れない数値を推測で捏造しないでください。',
      ].join('\n');

      const ai = getGeminiClient();

      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: rawBase64,
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
                detectedAppName: {
                  type: Type.STRING,
                  description: '検出されたポイ活アプリ・サービス名（例: モッピー）',
                },
                matchedAppId: {
                  type: Type.STRING,
                  description: '登録済みアプリ一覧で一致したid。一致しない場合は空文字',
                },
                screenshotType: {
                  type: Type.STRING,
                  description: 'balance_screen | history_list | mixed | unknown',
                },
                unit: {
                  type: Type.STRING,
                  description: 'ポイントの単位（P, pt, マイル等）',
                },
                confirmedBalance: {
                  type: Type.INTEGER,
                  description: '読み取れた確定保有ポイント。画面に無ければ -1',
                },
                pendingBalance: {
                  type: Type.INTEGER,
                  description: '読み取れた判定中・予定ポイント。画面に無ければ -1',
                },
                expiryDate: {
                  type: Type.STRING,
                  description: '有効期限（YYYY-MM-DD）。無ければ空文字',
                },
                summary: {
                  type: Type.STRING,
                  description: '読み取った内容の簡潔な日本語要約（1文）',
                },
                transactions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      points: { type: Type.INTEGER },
                      type: {
                        type: Type.STRING,
                        description: 'earned | pending | exchanged',
                      },
                      date: {
                        type: Type.STRING,
                        description: 'YYYY-MM-DD',
                      },
                      exchangeTarget: {
                        type: Type.STRING,
                        description: '交換先名（交換履歴の場合のみ）',
                      },
                      note: { type: Type.STRING },
                    },
                    required: ['title', 'points', 'type', 'date'],
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
              ],
            },
          },
        })
      );

      const text = (response.text ?? '').trim();
      if (!text) {
        res.status(502).json({ error: 'AIからの解析結果が空でした。別の画像でもう一度お試しください。' });
        return;
      }

      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number })?.status;

      if (message === 'MISSING_API_KEY') {
        res.status(500).json({
          error:
            'サーバー側の GEMINI_API_KEY が未設定です。AI Studio の「Settings > Secrets」パネルで設定を確認してください。',
        });
        return;
      }

      if (status === 400 || status === 403 || message.includes('API_KEY_INVALID') || message.includes('PERMISSION_DENIED')) {
        res.status(status || 403).json({
          error:
            'Gemini APIキーの認証に失敗しました。AI Studio の「Settings > Secrets」パネルでAPIキーを確認してください。',
        });
        return;
      }

      if (status === 429 || message.includes('RESOURCE_EXHAUSTED')) {
        res.status(429).json({
          error:
            'APIのリクエスト上限に達しました。しばらく時間を置いてから再試行するか、Settings > Secrets で課金有効なAPIキーを設定してください。',
        });
        return;
      }

      console.error('Screenshot parse error:', err);
      res.status(500).json({
        error: 'スクリーンショットの解析中にエラーが発生しました。時間をおいて再度お試しください。',
      });
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
