/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * سرورهای واسط معمولاً حجم درخواست را محدود می‌کنند (مثلاً ۱ مگابایت).
 * این ابزار صوت را به قطعه‌های کوتاهِ تک‌کانالهٔ ۱۶ کیلوهرتز (WAV) تقسیم می‌کند
 * تا هر درخواست کوچک بماند.
 */

export interface WavChunk {
  base64: string;
  /** ثانیهٔ شروع صوتِ ارسالی (شامل حاشیهٔ زمینه) در کل صوت */
  start: number;
  /** مدت صوتِ ارسالی (ثانیه) */
  duration: number;
  /** بازهٔ اصلی این قطعه؛ فقط مصرع‌هایی که در این بازه شروع شوند از این قطعه پذیرفته می‌شوند */
  coreStart: number;
  coreEnd: number;
}

function createCtx(): AudioContext {
  const C = (window as any).AudioContext || (window as any).webkitAudioContext;
  return new C();
}

function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const p: any = ctx.decodeAudioData(data, resolve, reject);
    if (p && typeof p.catch === 'function') p.catch(reject);
  });
}

function toMono16k(buf: AudioBuffer, target: number): Int16Array {
  const ratio = buf.sampleRate / target;
  const outLen = Math.max(1, Math.floor(buf.length / ratio));
  const channels: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = Math.floor(i * ratio);
    const e = Math.min(buf.length, Math.max(s + 1, Math.floor((i + 1) * ratio)));
    let sum = 0;
    let n = 0;
    for (let c = 0; c < channels.length; c++) {
      const d = channels[c];
      for (let j = s; j < e; j++) {
        sum += d[j];
        n++;
      }
    }
    let v = n ? sum / n : 0;
    v = Math.max(-1, Math.min(1, v));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

function wavBase64(samples: Int16Array, sampleRate: number): string {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  new Int16Array(buffer, 44).set(samples);

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(binary);
}

/**
 * یکنواخت‌سازی بلندی: بلندی میانگین (RMS) بخش‌های دارای صدا به هدف می‌رسد (تا ۱۰ برابر)
 * و قله‌ها با soft-limiter نرم می‌شوند. به این ترتیب بخش‌های آرام هم قابل تشخیص می‌شوند
 * و بخش‌های بلند نمی‌شکنند.
 */
function normalize(pcm: Int16Array): Int16Array {
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i < pcm.length; i += 4) {
    const a = Math.abs(pcm[i]) / 32768;
    if (a > 0.004) {
      sum += a * a;
      cnt++;
    }
  }
  const rms = cnt > 0 ? Math.sqrt(sum / cnt) : 0;
  if (rms === 0) return pcm;
  const gain = Math.min(10, Math.max(1, 0.14 / rms));
  if (gain <= 1.05) return pcm;
  const out = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    out[i] = Math.round(Math.tanh((pcm[i] / 32768) * gain) * 32767);
  }
  return out;
}

/** انرژی هموارشدهٔ هر ۵۰ میلی‌ثانیه (برای پیدا کردن مکث‌ها). */
function frameEnergy(pcm: Int16Array, frame: number): Float32Array {
  const n = Math.floor(pcm.length / frame);
  const raw = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) sum += pcm[i] * pcm[i];
    raw[f] = sum / frame;
  }
  const sm = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let t = 0;
    let c = 0;
    for (let k = -2; k <= 2; k++) {
      if (f + k >= 0 && f + k < n) {
        t += raw[f + k];
        c++;
      }
    }
    sm[f] = t / c;
  }
  return sm;
}

/**
 * صوت را به قطعه‌های کوتاه تقسیم می‌کند، ولی برش‌ها را روی ساکت‌ترین نقطهٔ نزدیک (مکث بین مصرع‌ها)
 * می‌گذارد و کمی از صوتِ دو طرف را هم برای فهم بهتر مدل همراه قطعه می‌فرستد.
 */
export async function splitAudioToWavChunks(
  audioUrl: string,
  chunkSeconds = 15,
  sampleRate = 16000,
  padSeconds = 1.5
): Promise<WavChunk[]> {
  const res = await fetch(audioUrl);
  const arr = await res.arrayBuffer();
  const ctx = createCtx();
  try {
    const decoded = await decode(ctx, arr);
    const pcm = normalize(toMono16k(decoded, sampleRate));
    const total = pcm.length / sampleRate;

    const frame = Math.floor(sampleRate * 0.05);
    const energy = frameEnergy(pcm, frame);
    const searchRadius = 2.5; // ثانیه

    // نقاط برش
    const cuts: number[] = [0];
    let cur = 0;
    for (let guard = 0; guard < 500; guard++) {
      const remaining = total - cur;
      if (remaining <= chunkSeconds + 1.5) break;
      // اگر باقی‌مانده کمتر از دو قطعه است، آن را مساوی نصف کن
      const target = remaining < chunkSeconds * 2 ? cur + remaining / 2 : cur + chunkSeconds;
      const lo = Math.max(cur + 6, target - searchRadius);
      const hi = Math.min(total - 3, Math.min(cur + chunkSeconds + searchRadius, target + searchRadius));
      let bestF = Math.round(target / (frame / sampleRate));
      let bestE = Infinity;
      for (let f = Math.floor((lo * sampleRate) / frame); f <= Math.floor((hi * sampleRate) / frame); f++) {
        if (f >= 0 && f < energy.length && energy[f] < bestE) {
          bestE = energy[f];
          bestF = f;
        }
      }
      const cut = Math.min(hi, Math.max(lo, ((bestF + 0.5) * frame) / sampleRate));
      cuts.push(cut);
      cur = cut;
    }
    cuts.push(total);

    const chunks: WavChunk[] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const coreStart = cuts[i];
      const coreEnd = cuts[i + 1];
      const from = Math.max(0, coreStart - (i === 0 ? 0 : padSeconds));
      const to = Math.min(total, coreEnd + (i === cuts.length - 2 ? 0 : padSeconds));
      const part = pcm.subarray(Math.floor(from * sampleRate), Math.floor(to * sampleRate));
      chunks.push({
        base64: wavBase64(part, sampleRate),
        start: from,
        duration: part.length / sampleRate,
        coreStart: i === 0 ? 0 : coreStart,
        coreEnd: i === cuts.length - 2 ? Infinity : coreEnd,
      });
    }
    return chunks;
  } finally {
    try {
      ctx.close();
    } catch {
      // ignore
    }
  }
}
