import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// CORS: نسخهٔ اندروید (Capacitor) از مبدأ https://localhost درخواست می‌فرستد
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Server-side Gemini client with User-Agent header
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    timestamp: Date.now(),
  });
});

function normalizeBaseUrl(url: string): string {
  let cleaned = (url || '').trim().replace(/\/+$/, '');
  return cleaned;
}

// Test OpenAI-compatible proxy connection
app.post('/api/proxy/test', async (req, res) => {
  try {
    const { baseUrl, apiKey: userKey, modelName, endpointType } = req.body;
    if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
      return res.status(400).json({ success: false, error: 'آدرس سرور واسط وارد نشده است.' });
    }

    const cleanedBaseUrl = normalizeBaseUrl(baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'aistudio-tanin-maddahi',
    };
    if (userKey && userKey.trim()) {
      headers['Authorization'] = `Bearer ${userKey.trim()}`;
    }

    const startTime = Date.now();
    let success = false;
    let message = '';
    let modelsList: string[] = [];

    // Attempt 1: Check GET /models
    try {
      const modelsUrl = cleanedBaseUrl.endsWith('/v1')
        ? `${cleanedBaseUrl}/models`
        : cleanedBaseUrl.includes('/v1/')
          ? cleanedBaseUrl
          : `${cleanedBaseUrl}/v1/models`;

      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 7000);
      const mRes = await fetch(modelsUrl, { headers, signal: ctrl.signal });
      clearTimeout(tid);

      if (mRes.ok) {
        const mData: any = await mRes.json();
        if (mData && Array.isArray(mData.data)) {
          modelsList = mData.data.map((m: any) => m.id || m.name).filter(Boolean).slice(0, 20);
          success = true;
          message = `ارتباط با سرور واسط با موفقیت برقرار شد (${modelsList.length} مدل شناسایی گردید).`;
        }
      }
    } catch {
      // Continue to test completion
    }

    // Attempt 2: If /models wasn't supported, test with /chat/completions minimal ping
    if (!success) {
      const chatUrl = cleanedBaseUrl.endsWith('/chat/completions')
        ? cleanedBaseUrl
        : cleanedBaseUrl.endsWith('/v1')
          ? `${cleanedBaseUrl}/chat/completions`
          : `${cleanedBaseUrl}/v1/chat/completions`;

      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 9000);
      const cRes = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelName || 'gemini-3.5-flash-lite',
          messages: [{ role: 'user', content: 'سلام' }],
          max_tokens: 5,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);

      const latency = Date.now() - startTime;
      if (cRes.ok) {
        success = true;
        message = `ارتباط با سرور واسط با موفقیت برقرار شد. مدل ${modelName || 'پیش‌فرض'} آماده پردازش است.`;
        return res.json({ success: true, latency, message, modelsList });
      } else {
        const errText = await cRes.text();
        let parsedErrMsg = '';
        try {
          const errJson = JSON.parse(errText);
          parsedErrMsg = errJson.error?.message || errJson.message || errText;
        } catch {
          parsedErrMsg = errText;
        }
        return res.json({
          success: false,
          error: `سرور واسط با خطای HTTP ${cRes.status} پاسخ داد: ${parsedErrMsg.slice(0, 200)}`,
        });
      }
    }

    const latency = Date.now() - startTime;
    return res.json({ success: true, latency, message, modelsList });
  } catch (err: any) {
    return res.json({
      success: false,
      error: `عدم امکان برقراری ارتباط با سرور واسط: ${err.message || 'خطای شبکه یا اتصال'}`,
    });
  }
});

// Google Drive Token-based sync endpoint
app.post('/api/drive/sync', async (req, res) => {
  try {
    const { clientId, clientSecret, refreshToken, folderId } = req.body;
    if (!clientId || !clientSecret || !refreshToken || !folderId) {
      return res.status(400).json({
        success: false,
        error: 'لطفاً Client ID، Client Secret، Refresh Token و Folder ID را کامل وارد کنید.',
      });
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        refresh_token: refreshToken.trim(),
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      let errorMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        errorMsg = errJson.error_description || errJson.error || errText;
      } catch {
        // ignore
      }
      return res.json({
        success: false,
        error: `خطا در احراز هویت توکن گوگل (HTTP ${tokenRes.status}): ${errorMsg}`,
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.json({
        success: false,
        error: 'پاسخ سرور گوگل حاوی access_token نبود.',
      });
    }

    const cleanFolderId = folderId.trim();
    const query = encodeURIComponent(`'${cleanFolderId}' in parents and (mimeType contains 'audio/' or mimeType = 'application/vnd.google-apps.folder' or name contains '.mp3' or name contains '.m4a')`);
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,webContentLink,webViewLink)&pageSize=100`;

    const driveRes = await fetch(driveUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      return res.json({
        success: false,
        error: `خطا در دریافت لیست فایل‌ها از گوگل درایو (HTTP ${driveRes.status}): ${errText.slice(0, 200)}`,
      });
    }

    const driveJson = await driveRes.json();
    const files = (driveJson.files || []).filter((f: any) => {
      const mime = f.mimeType || '';
      const name = (f.name || '').toLowerCase();
      return mime.includes('audio') || name.endsWith('.mp3') || name.endsWith('.m4a') || name.endsWith('.wav') || name.endsWith('.aac');
    });

    return res.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (err: any) {
    return res.json({
      success: false,
      error: `خطای سرور در همگام‌سازی گوگل درایو: ${err.message || 'خطای شبکه'}`,
    });
  }
});

// Google Drive Token-based upload endpoint
app.post('/api/drive/upload', async (req, res) => {
  try {
    const { clientId, clientSecret, refreshToken, folderId, fileName, mimeType, fileData } = req.body;
    if (!clientId || !clientSecret || !refreshToken || !folderId || !fileName || !fileData) {
      return res.status(400).json({
        success: false,
        error: 'لطفاً اطلاعات لازم برای آپلود را تکمیل کنید.',
      });
    }

    // 1. Get access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        refresh_token: refreshToken.trim(),
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenRes.ok) {
      return res.status(500).json({ success: false, error: 'خطا در احراز هویت توکن گوگل' });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Upload file
    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const metadata = {
      name: fileName,
      parents: [folderId.trim()],
    };
    
    // Create multipart form data
    const boundary = 'foo_bar_baz';
    const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${fileData}\r\n--${boundary}--\r\n`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return res.status(500).json({ success: false, error: `خطا در آپلود به درایو: ${errText.slice(0, 100)}` });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Helper for OpenAI-compatible extraction
async function handleOpenAIProxyExtraction(opts: {
  baseUrl: string;
  apiKey?: string;
  modelName: string;
  endpointType: string;
  audioBase64?: string;
  cleanMime: string;
  existingLyrics?: string;
  title?: string;
  audioDuration?: number;
}): Promise<{
  success: boolean;
  detectedTitle?: string;
  category?: string;
  lines?: any[];
  error?: string;
}> {
  const {
    baseUrl,
    apiKey: userKey,
    modelName,
    endpointType,
    audioBase64,
    cleanMime,
    existingLyrics,
    title,
    audioDuration,
  } = opts;

  const cleanedBaseUrl = normalizeBaseUrl(baseUrl);
  const headers: Record<string, string> = {
    'User-Agent': 'aistudio-tanin-maddahi',
  };
  if (userKey && userKey.trim()) {
    headers['Authorization'] = `Bearer ${userKey.trim()}`;
  }

  const promptText = `
شما متخصص برجسته ادبیات مذهبی، شعر آئینی، سبک‌های مداحی اهل‌بیت و همگام‌سازی صوت و متن نوحه، روضه، زمینه، شور و واحد هستید.

وظیفه:
${
  audioBase64
    ? 'این فایل صوتی مداحی یا روضه را با دقت استماع کن. تمام اشعار، ابیات، بندها و ذکرهایی که خوانده می‌شود را استخراج نما و زمان شروع و پایان هر خط را به ثانیه تعیین کن.'
    : 'متن شعر داده شده را تفکیک و زمان‌بندی کن.'
}
${existingLyrics ? `متن مرجع که کاربر ارائه داده است:\n"""${existingLyrics}"""\nصوت را با دقت با این متن تطبیق بده و زمان‌بندی آن را تنظیم کن.` : ''}
${title ? `عنوان اثر: ${title}` : ''}
${audioDuration ? `مدت کل صوت: حدود ${audioDuration} ثانیه` : ''}

قوانین استخراج:
۱. خروجی باید حتماً یک شیء JSON با ساختار زیر باشد:
{
  "detectedTitle": "عنوان نوحه یا اثر",
  "category": "zamineh" | "shoor" | "vahed" | "rozeh" | "doodameh" | "monajat",
  "lines": [
    {
      "startTime": 0.0,
      "endTime": 4.5,
      "text": "متن مصراع یا بیت به زبان فارسی با رسم‌الخط صحیح",
      "type": "verse" | "chorus" | "mention"
    }
  ]
}
۲. هر مصراع یا بند را در یک شیء جداگانه در آرایه lines قرار بده.
۳. زمان‌ها (startTime و endTime) باید اعدادی صعودی و متناسب با خواندن قطعه باشند.
۴. اگر کلمه‌ای واضح نبود فقط ابیات خوانده شده را استخراج کن.
`;

  // Branch 1: Audio Transcriptions endpoint (e.g. Whisper)
  if (
    audioBase64 &&
    (endpointType === 'audio_transcriptions' || modelName.toLowerCase().includes('whisper'))
  ) {
    try {
      const transcribeUrl = cleanedBaseUrl.endsWith('/audio/transcriptions')
        ? cleanedBaseUrl
        : cleanedBaseUrl.endsWith('/v1')
          ? `${cleanedBaseUrl}/audio/transcriptions`
          : `${cleanedBaseUrl}/v1/audio/transcriptions`;

      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const audioBlob = new Blob([audioBuffer], { type: cleanMime });
      const form = new FormData();
      form.append('file', audioBlob, 'maddahi_audio.mp3');
      form.append('model', modelName || 'whisper-1');
      form.append('response_format', 'verbose_json');
      form.append('language', 'fa');
      if (promptText) {
        form.append('prompt', 'نوحه و روضه اهل‌بیت علیهم‌السلام');
      }

      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 60000);
      const res = await fetch(transcribeUrl, {
        method: 'POST',
        headers: {
          ...(userKey ? { Authorization: `Bearer ${userKey.trim()}` } : {}),
        },
        body: form,
        signal: ctrl.signal,
      });
      clearTimeout(tid);

      if (res.ok) {
        const data: any = await res.json();
        const segments = data.segments || [];
        if (segments.length > 0) {
          const lines = segments.map((s: any, idx: number) => ({
            startTime: Number(s.start) || 0,
            endTime: Number(s.end) || Number(s.start) + 3,
            text: (s.text || '').trim(),
            type: 'verse',
            stanzaIndex: Math.floor(idx / 4) + 1,
          }));
          return {
            success: true,
            detectedTitle: title || 'مداحی استخراج‌شده با Whisper',
            category: 'zamineh',
            lines,
          };
        }
      }
    } catch (e: any) {
      console.warn('Whisper transcribe attempt failed:', e.message);
    }
  }

  // Branch 2: Chat completions (Standard OpenAI architecture with Google models / multimodal)
  const chatUrl = cleanedBaseUrl.endsWith('/chat/completions')
    ? cleanedBaseUrl
    : cleanedBaseUrl.endsWith('/v1')
      ? `${cleanedBaseUrl}/chat/completions`
      : `${cleanedBaseUrl}/v1/chat/completions`;

  const messages: any[] = [
    {
      role: 'system',
      content:
        'شما دستیار تخصصی استخراج متن و همگام‌سازی صوت و اشعار مذهبی و مداحی هستید. شما همواره خروجی را دقیقاً و صرفاً به صورت JSON طبق دستورات داده‌شده تحویل می‌دهید.',
    },
  ];

  const userContent: any[] = [{ type: 'text', text: promptText }];

  if (audioBase64) {
    // OpenAI standard input_audio format
    userContent.push({
      type: 'input_audio',
      input_audio: {
        data: audioBase64,
        format: cleanMime.includes('wav') ? 'wav' : 'mp3',
      },
    });
  }

  messages.push({
    role: 'user',
    content: userContent,
  });

  const bodyPayload: any = {
    model: modelName || 'gemini-3.5-flash-lite',
    messages,
    response_format: { type: 'json_object' },
  };

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 75000); // 75s timeout for audio processing

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `پاسخ سرور واسط با کد ${response.status}: ${errText.slice(0, 180)}`,
      };
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const cleanJson = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      let parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed = parsed[0];
      }

      if (parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
        return {
          success: true,
          detectedTitle: parsed.detectedTitle || title,
          category: parsed.category || 'zamineh',
          lines: parsed.lines,
        };
      }
    }

    return {
      success: false,
      error: 'سرور واسط پاسخی داد اما قالب ابیات و زمان‌بندی در آن یافت نشد.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: `خطا در ارتباط با سرور واسط: ${err.message || 'خطای تایم‌اوت یا شبکه'}`,
    };
  }
}

app.post('/api/gemini/transcribe-sync', async (req, res) => {
  try {
    const {
      audioBase64,
      mimeType = 'audio/mp3',
      existingLyrics = '',
      title = '',
      audioDuration = 0,
      proxyConfig,
    } = req.body;

    // Clean MIME type
    let cleanMime = mimeType ? mimeType.split(';')[0].trim() : 'audio/mp3';
    if (cleanMime === 'audio/mpeg') cleanMime = 'audio/mp3';
    if (cleanMime === 'audio/x-m4a') cleanMime = 'audio/mp4';

    // 1. Check if user configured and enabled their own OpenAI-compatible proxy server
    if (proxyConfig && proxyConfig.enabled && proxyConfig.baseUrl) {
      console.log(`در حال ارسال درخواست به سرور واسط اختصاصی کاربر: ${proxyConfig.baseUrl} (مدل: ${proxyConfig.modelName})`);
      const proxyResult = await handleOpenAIProxyExtraction({
        baseUrl: proxyConfig.baseUrl,
        apiKey: proxyConfig.apiKey,
        modelName: proxyConfig.modelName || 'gemini-2.5-flash',
        endpointType: proxyConfig.endpointType || 'auto',
        audioBase64: audioBase64 || undefined,
        cleanMime,
        existingLyrics,
        title,
        audioDuration,
      });

      if (proxyResult.success && proxyResult.lines && proxyResult.lines.length > 0) {
        console.log(`استخراج موفق از طریق سرور واسط اختصاصی: ${proxyResult.lines.length} خط شعر`);
        return res.json({
          success: true,
          source: 'custom_proxy',
          modelUsed: proxyConfig.modelName || 'gemini-2.5-flash',
          data: proxyResult,
        });
      }

      console.warn('پاسخ سرور واسط ناموفق بود:', proxyResult.error);
      // If user had proxy enabled and it failed, we inform them but try fallback if API key exists
    }

    // 2. Direct server-side Gemini client fallback
    if (!ai) {
      return res.status(200).json({
        fallback: true,
        message: 'کلید وب‌سرویس تنظیم نشده است؛ در صورت داشتن سرور واسط، آن را در بخش تنظیمات سرور فعال کنید.',
        lines: null,
      });
    }

    const parts: any[] = [];

    if (audioBase64) {
      parts.push({
        inlineData: {
          mimeType: cleanMime,
          data: audioBase64,
        },
      });
    }

    const promptText = `
شما متخصص برجسته ادبیات مذهبی، شعر آئینی، سبک‌های مداحی اهل‌بیت و همگام‌سازی صوت و متن نوحه، روضه، زمینه، شور و واحد هستید.

وظیفه:
${
  audioBase64
    ? 'این فایل صوتی مداحی یا روضه را با دقت استماع کن. تمام اشعار، ابیات، بندها و ذکرهایی که خوانده می‌شود را استخراج نما و زمان شروع و پایان هر خط را به ثانیه تعیین کن.'
    : 'متن شعر داده شده را تفکیک و زمان‌بندی کن.'
}
${existingLyrics ? `متن مرجع که کاربر ارائه داده است:\n"""${existingLyrics}"""\nصوت را دقیقاً با این متن تطبیق بده و زمان‌بندی آن را تنظیم کن.` : ''}
${title ? `عنوان اثر: ${title}` : ''}
${audioDuration ? `مدت کل صوت: حدود ${audioDuration} ثانیه` : ''}

قوانین استخراج:
۱. خروجی باید حتماً یک شیء JSON با ساختار زیر باشد:
{
  "detectedTitle": "عنوان نوحه یا اثر",
  "category": "zamineh" | "shoor" | "vahed" | "rozeh" | "doodameh" | "monajat",
  "lines": [
    {
      "startTime": 0.0,
      "endTime": 4.5,
      "text": "متن مصراع یا بیت به زبان فارسی با رسم‌الخط صحیح",
      "type": "verse" | "chorus" | "mention"
    }
  ]
}
۲. هر مصراع یا بند را در یک شیء جداگانه در آرایه lines قرار بده.
۳. زمان‌ها (startTime و endTime) باید اعدادی صعودی و متناسب با خواندن قطعه باشند.
۴. اگر کلمه‌ای واضح نبود فقط ابیات خوانده شده را استخراج کن.
`;

    parts.push({ text: promptText });

    // Models to try in order of speed, quota stability, and multimodal capabilities
    const modelsToTry = [
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ];
    let lastError: any = null;
    let parsedData: any = null;

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 0; attempt < 2; attempt++) {
      for (const modelName of modelsToTry) {
        try {
          console.log(`در حال پردازش صوت با مدل ${modelName} (تلاش ${attempt + 1})...`);
          const reqConfig =
            modelName === 'gemini-3.5-transcribe'
              ? {}
              : { responseMimeType: 'application/json' };

          const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts },
            config: reqConfig,
          });

          const rawText = response.text?.trim();
          if (rawText) {
            // If model is raw transcribe, split lines
            if (modelName === 'gemini-3.5-transcribe') {
              const linesRaw = rawText.split('\n').map((l: string) => l.trim()).filter(Boolean);
              if (linesRaw.length > 0) {
                const totalDur = audioDuration || 60;
                const perLine = totalDur / linesRaw.length;
                parsedData = {
                  detectedTitle: title || 'نوحه استخراج‌شده',
                  category: 'zamineh',
                  lines: linesRaw.map((txt: string, idx: number) => ({
                    startTime: Math.round(idx * perLine * 10) / 10,
                    endTime: Math.round((idx + 1) * perLine * 10) / 10,
                    text: txt,
                    type: 'verse',
                    stanzaIndex: Math.floor(idx / 4) + 1,
                  })),
                };
                console.log(`استخراج متنی با مدل ${modelName}: ${parsedData.lines.length} خط شعر`);
                break;
              }
            } else {
              const jsonStr = rawText
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```$/i, '')
                .trim();
              parsedData = JSON.parse(jsonStr);

              if (Array.isArray(parsedData) && parsedData.length > 0) {
                parsedData = parsedData[0];
              }

              if (parsedData && Array.isArray(parsedData.lines) && parsedData.lines.length > 0) {
                console.log(`استخراج موفق با مدل ${modelName}: ${parsedData.lines.length} خط شعر`);
                break;
              }
            }
          }
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || '';
          console.warn(`تلاش با مدل ${modelName} ناموفق بود:`, msg.slice(0, 100));
        }
      }

      if (parsedData && Array.isArray(parsedData.lines) && parsedData.lines.length > 0) {
        break;
      }

      if (attempt === 0) {
        await sleep(800);
      }
    }

    if (parsedData && Array.isArray(parsedData.lines) && parsedData.lines.length > 0) {
      return res.json({
        success: true,
        source: 'gemini_direct',
        data: parsedData,
      });
    }

    return res.json({
      success: false,
      error: lastError?.message || 'هوش مصنوعی نتوانست کلام واضحی از این فایل صوتی استخراج کند.',
      lines: null,
    });
  } catch (err: any) {
    console.error('Transcribe-sync critical error:', err);
    return res.status(200).json({
      success: false,
      error: err?.message || 'خطا در ارتباط با سرور پردازش صوت',
      lines: null,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`طنین مداحی سرور آماده اجرا روی پورت ${port}`);
  });
}

startServer();
