/**
 * کلاینت مستقیم سرور واسط (OpenAI-compatible)
 * وقتی «آدرس سرور برنامه» خالی است (نسخهٔ اندروید)، درخواست‌ها به جای /api/... مستقیماً
 * از داخل برنامه به سرور واسط ارسال می‌شود.
 */
import { ProxyConfig } from '../types/maddahi';

const norm = (u: string) => (u || '').trim().replace(/\/+$/, '');

function chatUrl(base: string): string {
  const b = norm(base);
  if (b.endsWith('/chat/completions')) return b;
  if (b.endsWith('/v1')) return `${b}/chat/completions`;
  return `${b}/v1/chat/completions`;
}
function modelsUrl(base: string): string {
  const b = norm(base).replace(/\/chat\/completions$/, '');
  if (b.endsWith('/v1')) return `${b}/models`;
  return `${b}/v1/models`;
}
function authHeaders(key?: string): Record<string, string> {
  return key && key.trim() ? { Authorization: `Bearer ${key.trim()}` } : {};
}

/** خواندن امن پاسخ: اگر HTML برگشت، پیام فارسی مشخص بدهد نه خطای JSON */
export async function readJsonSafe(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const looksHtml = /^\s*<(!doctype|html)/i.test(text);
    throw new Error(
      looksHtml
        ? `آدرس پاسخ JSON نداد و یک صفحهٔ HTML برگرداند (کد ${res.status}). آدرس Base URL اشتباه است یا استقرار (Deploy) سرور واسط غیرفعال/محافظت‌شده است.`
        : `پاسخ نامعتبر از سرور (کد ${res.status}): ${text.slice(0, 120)}`
    );
  }
}

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

export async function testProxyDirect(cfg: {
  baseUrl: string;
  apiKey?: string;
  modelName?: string;
}): Promise<{ success: boolean; message?: string; error?: string; latency?: number; modelsList?: string[] }> {
  const start = Date.now();
  const headers = { 'Content-Type': 'application/json', ...authHeaders(cfg.apiKey) };

  // 1) GET /models
  try {
    const r = await timedFetch(modelsUrl(cfg.baseUrl), { headers }, 8000);
    if (r.ok) {
      const d = await readJsonSafe(r);
      if (Array.isArray(d?.data)) {
        const list = d.data.map((m: any) => m.id || m.name).filter(Boolean).slice(0, 20);
        return {
          success: true,
          latency: Date.now() - start,
          modelsList: list,
          message: `ارتباط با سرور واسط برقرار شد (${list.length} مدل شناسایی شد).`,
        };
      }
    }
  } catch {
    /* ادامه با تست chat */
  }

  // 2) ping با chat/completions
  try {
    const r = await timedFetch(
      chatUrl(cfg.baseUrl),
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: cfg.modelName || 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'سلام' }],
          max_tokens: 5,
        }),
      },
      12000
    );
    const latency = Date.now() - start;
    if (r.ok) {
      await readJsonSafe(r);
      return { success: true, latency, message: `ارتباط برقرار شد. مدل ${cfg.modelName || ''} آماده است.` };
    }
    const d = await readJsonSafe(r).catch((e) => ({ error: { message: e.message } }));
    return {
      success: false,
      error: `کد ${r.status}: ${d?.error?.message || d?.message || 'خطای نامشخص'}`,
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'عدم دسترسی به سرور واسط' };
  }
}

/** تبدیل mime به نام فرمت که Gemini می‌شناسد (mp3, wav, ogg, flac, aac, aiff) */
function audioFormat(mime: string): string {
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg') || mime.includes('opus')) return 'ogg';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('aac') || mime.includes('mp4') || mime.includes('m4a')) return 'aac';
  if (mime.includes('aiff')) return 'aiff';
  return 'mp3';
}

/** خواندن پاسخ chat: هم JSON معمولی و هم جریان SSE (stream) */
async function readChatContent(res: Response): Promise<string> {
  const text = await res.text();
  if (/^\s*data:/m.test(text)) {
    let out = '';
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        out += j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? '';
      } catch {
        /* نادیده */
      }
    }
    return out;
  }
  try {
    return JSON.parse(text)?.choices?.[0]?.message?.content || '';
  } catch {
    const looksHtml = /^\s*<(!doctype|html)/i.test(text);
    throw new Error(
      looksHtml
        ? `سرور HTML برگرداند (کد ${res.status}) - احتمالاً تایم‌اوت Vercel یا آدرس اشتباه`
        : `پاسخ نامعتبر (کد ${res.status}): ${text.slice(0, 160)}`
    );
  }
}


/** ---------- تکه‌تکه کردن صوت (محدودیت ۴٫۵ مگابایتی Vercel) ---------- */
const CHUNK_SECONDS = 60; // هر تکه: WAV مونو ۱۶kHz ≈ ۱٫۹ مگابایت ≈ ۲٫۶ مگابایت base64
const MAX_DIRECT_B64 = 3_000_000;

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, str: string) => {
    for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + step)));
  }
  return btoa(bin);
}

export interface AudioChunk {
  base64: string;
  format: string;
  offset: number;
  duration: number;
}

/** صوت را به تکه‌های WAV مونو ۱۶kHz تبدیل می‌کند. اگر رمزگشایی نشد، null برمی‌گرداند. */
async function splitAudio(base64: string): Promise<AudioChunk[] | null> {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const decoded: AudioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
    ctx.close?.();

    const rate = 16000;
    // کمپرسور دینامیک: بخش‌های آرام (آرام‌خوانی، ذکر آهسته) نسبت به بخش‌های بلند قابل‌شنیدن می‌شوند
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    const comp = off.createDynamicsCompressor();
    comp.threshold.value = -42;
    comp.knee.value = 30;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    src.connect(comp);
    comp.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    const data = rendered.getChannelData(0);

    // یکنواخت‌سازی بلندی: بلندی میانگین (RMS) قسمت‌های دارای صدا را به هدف می‌رسانیم
    // (در عمل چند برابر کردن صدا) و قله‌ها را با soft-limiter نرم می‌کنیم تا نشکنند.
    let sum = 0;
    let cnt = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = Math.abs(data[i]);
      if (a > 0.004) {
        sum += a * a;
        cnt++;
      }
    }
    const rms = cnt > 0 ? Math.sqrt(sum / cnt) : 0;
    const TARGET_RMS = 0.14;
    const gain = rms > 0 ? Math.min(10, Math.max(1, TARGET_RMS / rms)) : 1;
    for (let i = 0; i < data.length; i++) data[i] = Math.tanh(data[i] * gain);

    // برش در سکوت: نزدیک مرز هر تکه (±۸ ثانیه) کم‌انرژی‌ترین نقطه را پیدا می‌کنیم
    // تا کلمه یا مصراع نصفه نشود
    const win = Math.round(0.05 * rate); // پنجرهٔ ۵۰ میلی‌ثانیه
    const findQuiet = (center: number): number => {
      const from = Math.max(0, center - 8 * rate);
      const to = Math.min(data.length - win, center + 8 * rate);
      let best = center;
      let bestE = Infinity;
      for (let i = from; i < to; i += win) {
        let e = 0;
        for (let j = i; j < i + win; j++) e += data[j] * data[j];
        if (e < bestE) {
          bestE = e;
          best = i + (win >> 1);
        }
      }
      return best;
    };

    const per = CHUNK_SECONDS * rate;
    const cuts: number[] = [0];
    while (data.length - cuts[cuts.length - 1] > per + 8 * rate) {
      cuts.push(findQuiet(cuts[cuts.length - 1] + per));
    }
    cuts.push(data.length);

    const chunks: AudioChunk[] = [];
    for (let k = 0; k < cuts.length - 1; k++) {
      const part = data.subarray(cuts[k], cuts[k + 1]);
      if (part.length < rate * 0.5) continue;
      chunks.push({
        base64: bytesToBase64(encodeWav(part, rate)),
        format: 'wav',
        offset: cuts[k] / rate,
        duration: part.length / rate,
      });
    }
    return chunks.length ? chunks : null;
  } catch {
    return null;
  }
}

const PROMPT = (o: { hasAudio: boolean; existingLyrics?: string; title?: string; audioDuration?: number }) => `
تو یک رونویس‌کنندهٔ دقیق (Transcriber) فارسی برای نوحه، روضه و مداحی اهل‌بیت هستی.

${
  o.hasAudio
    ? `وظیفه: دقیقاً همان چیزی را که در صوت خوانده می‌شود، کلمه‌به‌کلمه بنویس.
- هیچ کلمه‌ای را از خودت اضافه، حذف، «اصلاح» یا جایگزین نکن. شعر را از حافظه کامل نکن و حدس ادبی نزن.
- فقط آنچه واقعاً شنیده می‌شود را بنویس. اگر بخشی نامفهوم بود همان را با «…» مشخص کن و چیزی نساز.
- تکرارها (مثلاً تکرار یک مصراع یا ذکر «یا حسین») را همان‌قدر که خوانده شده بنویس؛ ادغام یا حذف نکن.
- اگر فقط موسیقی یا سکوت است، lines را خالی برگردان.
- املای فارسی صحیح (ی/ک فارسی، نیم‌فاصله) به کار ببر.
- هر مصراع یا جملهٔ خوانده‌شده یک خط جدا باشد؛ startTime و endTime آن را به ثانیه و با دقت بده (صعودی، بدون همپوشانی).`
    : 'متن شعر داده‌شده را بدون تغییر در کلمات، به مصراع‌ها تفکیک کن و زمان‌بندی تقریبی بده.'
}
${o.existingLyrics ? `\nمتن مرجع کاربر:\n"""${o.existingLyrics}"""\nاگر صوت با این متن می‌خواند، همان املای مرجع را به کار ببر؛ ولی اگر خواننده چیز دیگری می‌خواند، همان‌چه شنیده می‌شود را بنویس.` : ''}
${o.title ? `عنوان اثر: ${o.title}` : ''}
${o.audioDuration ? `مدت این صوت: حدود ${Math.round(o.audioDuration)} ثانیه` : ''}

خروجی فقط یک JSON معتبر و بدون هیچ توضیح اضافه:
{"detectedTitle":"...","category":"zamineh"|"shoor"|"vahed"|"rozeh"|"doodameh"|"monajat","lines":[{"startTime":0.0,"endTime":4.5,"text":"...","type":"verse"|"chorus"|"mention"}]}`;

export async function extractViaProxyDirect(opts: {
  proxyConfig: ProxyConfig;
  audioBase64?: string | null;
  mimeType?: string;
  existingLyrics?: string;
  title?: string;
  audioDuration?: number;
  onProgress?: (msg: string) => void;
}): Promise<{ success: boolean; source?: string; modelUsed?: string; data?: any; error?: string }> {
  const { proxyConfig: cfg, mimeType = 'audio/mp3' } = opts;
  const model = cfg.modelName || 'gemini-2.5-flash';
  const mime = mimeType.toLowerCase();
  const clean = opts.audioBase64 ? opts.audioBase64.replace(/^data:[^;]+;base64,/, '') : '';

  // بدون صوت (فقط متن)
  if (!clean) {
    const r = await runChatChunk(cfg, model, null, 'mp3', opts, 0, 0);
    return r.error ? { success: false, error: r.error } : wrap(model, opts.title, r.lines!, r.title, r.category);
  }

  // تکه‌تکه کردن صوت
  let chunks = await splitAudio(clean);
  if (!chunks) {
    if (clean.length > MAX_DIRECT_B64) {
      return {
        success: false,
        error:
          'فایل صوتی برای ارسال مستقیم بزرگ است (بیش از ۳ مگابایت) و در این دستگاه امکان تبدیل/برش آن نبود. فایل کوتاه‌تر یا با فرمت mp3/wav انتخاب کنید.',
      };
    }
    chunks = [{ base64: clean, format: audioFormat(mime), offset: 0, duration: opts.audioDuration || 0 }];
  }

  const useWhisper = cfg.endpointType === 'audio_transcriptions' || model.toLowerCase().includes('whisper');
  const allLines: any[] = [];
  let title = opts.title;
  let category: string | undefined;
  let lastErr = '';

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    opts.onProgress?.(`در حال پردازش بخش ${i + 1} از ${chunks.length} صوت...`);
    const r = useWhisper
      ? await runWhisperChunk(cfg, model, c)
      : await runChatChunk(cfg, model, c.base64, c.format, opts, c.offset, c.duration);
    if (r.error || !r.lines?.length) {
      lastErr = r.error || 'بدون ابیات';
      // اگر اولین بخش خطا داد، ادامه فایده ندارد
      if (i === 0) return { success: false, error: lastErr };
      continue;
    }
    for (const l of r.lines) {
      allLines.push({
        ...l,
        startTime: (Number(l.startTime) || 0) + c.offset,
        endTime: (Number(l.endTime) || 0) + c.offset,
      });
    }
    if (!title && r.title) title = r.title;
    if (!category && r.category) category = r.category;
  }

  if (!allLines.length) return { success: false, error: lastErr || 'ابیاتی استخراج نشد.' };
  return wrap(model, title, allLines, title, category);
}

function wrap(model: string, title: string | undefined, lines: any[], t?: string, category?: string) {
  return {
    success: true,
    source: 'custom_proxy',
    modelUsed: model,
    data: { detectedTitle: t || title, category: category || 'zamineh', lines },
  };
}

type ChunkResult = { lines?: any[]; title?: string; category?: string; error?: string };

async function runWhisperChunk(cfg: ProxyConfig, model: string, c: AudioChunk): Promise<ChunkResult> {
  try {
    const bytes = Uint8Array.from(atob(c.base64), (x) => x.charCodeAt(0));
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'chunk.wav');
    form.append('model', model);
    form.append('response_format', 'verbose_json');
    form.append('language', 'fa');
    const base = norm(cfg.baseUrl);
    const url = base.endsWith('/audio/transcriptions')
      ? base
      : base.endsWith('/v1')
        ? `${base}/audio/transcriptions`
        : `${base}/v1/audio/transcriptions`;
    const r = await timedFetch(url, { method: 'POST', headers: authHeaders(cfg.apiKey), body: form }, 90000);
    if (!r.ok) {
      const t = await r.text();
      return { error: `Whisper کد ${r.status}: ${t.replace(/\s+/g, ' ').slice(0, 200)}` };
    }
    const d = await readJsonSafe(r);
    const seg = d.segments || [];
    return {
      lines: seg.map((x: any) => ({
        startTime: Number(x.start) || 0,
        endTime: Number(x.end) || Number(x.start) + 3,
        text: (x.text || '').trim(),
        type: 'verse',
      })),
    };
  } catch (e: any) {
    return { error: `Whisper: ${e.message}` };
  }
}

async function runChatChunk(
  cfg: ProxyConfig,
  model: string,
  audioB64: string | null,
  format: string,
  opts: { existingLyrics?: string; title?: string; audioDuration?: number },
  offset: number,
  duration: number
): Promise<ChunkResult> {
  const partNote =
    audioB64 && (offset > 0 || (opts.audioDuration && duration && duration < opts.audioDuration - 1))
      ? `\nاین فایل فقط یک بخش از کل مداحی است (بخش از ثانیه ${Math.round(offset)} تا ${Math.round(offset + duration)} کل اثر). زمان‌ها را نسبت به شروع همین بخش (از صفر) بنویس و فقط ابیاتی را بیاور که در همین بخش خوانده می‌شود.`
      : '';
  const content: any[] = [
    {
      type: 'text',
      text:
        PROMPT({
          hasAudio: !!audioB64,
          existingLyrics: opts.existingLyrics,
          title: opts.title,
          audioDuration: duration || opts.audioDuration,
        }) + partNote,
    },
  ];
  if (audioB64) content.push({ type: 'input_audio', input_audio: { data: audioB64, format } });

  const send = (extra: Record<string, any>) =>
    timedFetch(
      chatUrl(cfg.baseUrl),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(cfg.apiKey) },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'خروجی را همیشه فقط به صورت JSON معتبر بده.' },
            { role: 'user', content },
          ],
          temperature: 0.1,
          ...extra,
        }),
      },
      180000
    );

  try {
    // stream=true: جلوگیری از تایم‌اوت Vercel هنگام پردازش صوت
    let r = await send({ stream: true, response_format: { type: 'json_object' } });
    if (r.status === 400 || r.status === 422) r = await send({ stream: true });
    if (!r.ok) {
      const t = await r.text();
      return { error: `پاسخ سرور واسط با کد ${r.status}: ${t.replace(/\s+/g, ' ').slice(0, 220)}` };
    }
    const text = await readChatContent(r);
    if (!text) return { error: 'سرور واسط پاسخ خالی داد.' };
    let parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
    if (Array.isArray(parsed)) parsed = parsed[0];
    if (parsed && Array.isArray(parsed.lines) && parsed.lines.length) {
      return { lines: parsed.lines, title: parsed.detectedTitle, category: parsed.category };
    }
    return { error: `مدل پاسخ داد اما ساختار lines نداشت: ${text.slice(0, 160)}` };
  } catch (e: any) {
    return { error: `خطا در ارتباط با سرور واسط: ${e.message || 'تایم‌اوت یا شبکه'}` };
  }
}
