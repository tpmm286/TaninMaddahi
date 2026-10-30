/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let globalAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    globalAudioCtx = new AudioContextClass();
  }
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume();
  }
  return globalAudioCtx;
}

export interface AudioEngineCallbacks {
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onEnded: () => void;
  onPlayStateChange: (isPlaying: boolean) => void;
}

export class MaddahiAudioEngine {
  private audioEl: HTMLAudioElement | null = null;
  private synthTimer: number | null = null;
  private synthStartTime: number = 0;
  private synthPausedAt: number = 0;
  private synthDuration: number = 60;
  private isSynthetic: boolean = false;
  private isPlaying: boolean = false;
  private playbackRate: number = 1.0;
  private loopRange: { start: number; end: number } | null = null;
  private callbacks: AudioEngineCallbacks;

  private isVocalBoost: boolean = false;
  private isEchoEnabled: boolean = false;
  private pitchSemis: number = 0;

  private intentionalPause = false;

  constructor(callbacks: AudioEngineCallbacks) {
    this.callbacks = callbacks;
  }

  public setPitchShift(semitones: number) {
    this.pitchSemis = semitones;
    const pitchRatio = Math.pow(2, semitones / 12);
    if (this.audioEl) {
      this.audioEl.preservesPitch = semitones === 0;
      this.audioEl.playbackRate = this.playbackRate * (semitones !== 0 ? pitchRatio : 1.0);
    }
  }

  public setTrack(audioUrl: string | undefined, duration: number) {
    this.stop();
    this.synthDuration = Math.max(10, duration || 60);

    if (audioUrl && (audioUrl.startsWith('data:') || audioUrl.startsWith('blob:') || audioUrl.startsWith('http'))) {
      this.isSynthetic = false;
      this.setupAudioElement(audioUrl);
    } else {
      this.isSynthetic = true;
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.src = '';
      }
    }
    this.synthPausedAt = 0;
    this.callbacks.onTimeUpdate(0, this.synthDuration);
  }

  private setupAudioElement(url: string) {
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.preload = 'auto';

      this.audioEl.addEventListener('timeupdate', () => {
        if (!this.audioEl) return;
        const cur = this.audioEl.currentTime;
        const dur = this.audioEl.duration || this.synthDuration;

        if (this.loopRange && cur >= this.loopRange.end) {
          this.audioEl.currentTime = this.loopRange.start;
          this.callbacks.onTimeUpdate(this.loopRange.start, dur);
          return;
        }

        this.callbacks.onTimeUpdate(cur, dur);
      });

      // وقتی سیستم (مثلاً با وصل شدن هدفون / تغییر مسیر صدا / از دست رفتن audio focus)
      // پخش را متوقف کند، موتور پخش باید با آن هماهنگ بماند یا خودش دوباره ادامه دهد.
      this.audioEl.addEventListener('pause', () => {
        if (!this.audioEl || this.intentionalPause || !this.isPlaying) return;
        if (this.audioEl.ended) return;
        const resumeAt = this.audioEl.currentTime;
        window.setTimeout(() => {
          if (!this.audioEl || !this.isPlaying || this.intentionalPause) return;
          if (!this.audioEl.paused) return; // خودش ادامه داده
          if (Math.abs(this.audioEl.currentTime - resumeAt) > 1.5) {
            this.audioEl.currentTime = resumeAt;
          }
          this.audioEl.play().catch(() => {
            // امکان ادامه نبود: وضعیت واقعی را به رابط کاربری برگردان
            this.isPlaying = false;
            this.callbacks.onPlayStateChange(false);
          });
        }, 350);
      });

      this.audioEl.addEventListener('error', () => {
        if (this.isPlaying) {
          this.isPlaying = false;
          this.callbacks.onPlayStateChange(false);
        }
      });

      this.audioEl.addEventListener('ended', () => {
        if (this.loopRange) {
          this.seek(this.loopRange.start);
          this.play();
        } else {
          this.isPlaying = false;
          this.callbacks.onPlayStateChange(false);
          this.callbacks.onEnded();
        }
      });
    }

    this.audioEl.src = url;
    this.audioEl.playbackRate = this.playbackRate;
  }

  public play() {
    if (this.isPlaying) return;

    if (this.isSynthetic) {
      this.playSynthetic();
    } else if (this.audioEl) {
      this.audioEl.playbackRate = this.playbackRate;
      this.intentionalPause = false;
      this.audioEl.play().catch((err: any) => {
        if (err && err.name === 'NotSupportedError') {
          // فرمت پشتیبانی نمی‌شود: حالت شبیه‌ساز
          this.isSynthetic = true;
          this.playSynthetic();
        } else if (err && err.name !== 'AbortError') {
          // خطای موقت (مثلاً تغییر مسیر صدا): وضعیت را درست گزارش کن
          this.isPlaying = false;
          this.callbacks.onPlayStateChange(false);
        }
      });
    }

    this.isPlaying = true;
    this.callbacks.onPlayStateChange(true);
  }

  public pause() {
    if (!this.isPlaying) return;

    if (this.isSynthetic) {
      if (this.synthTimer) {
        clearInterval(this.synthTimer);
        this.synthTimer = null;
      }
      this.synthPausedAt = this.getCurrentTime();
    } else if (this.audioEl) {
      this.intentionalPause = true;
      this.audioEl.pause();
    }

    this.isPlaying = false;
    this.callbacks.onPlayStateChange(false);
  }

  public stop() {
    this.pause();
    this.synthPausedAt = 0;
    if (this.audioEl) {
      this.audioEl.currentTime = 0;
    }
    this.callbacks.onTimeUpdate(0, this.synthDuration);
  }

  public seek(seconds: number) {
    const clamped = Math.max(0, Math.min(seconds, this.synthDuration));
    if (this.isSynthetic) {
      this.synthPausedAt = clamped;
      this.synthStartTime = Date.now() - (clamped / this.playbackRate) * 1000;
      this.callbacks.onTimeUpdate(clamped, this.synthDuration);
    } else if (this.audioEl) {
      this.audioEl.currentTime = clamped;
      this.callbacks.onTimeUpdate(clamped, this.audioEl.duration || this.synthDuration);
    }
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    const pitchRatio = Math.pow(2, this.pitchSemis / 12);
    if (this.audioEl) {
      this.audioEl.playbackRate = rate * (this.pitchSemis !== 0 ? pitchRatio : 1.0);
    }
    if (this.isSynthetic && this.isPlaying) {
      const cur = this.getCurrentTime();
      this.synthPausedAt = cur;
      this.synthStartTime = Date.now() - (cur / this.playbackRate) * 1000;
    }
  }

  public setLoopRange(range: { start: number; end: number } | null) {
    this.loopRange = range;
    if (range && this.getCurrentTime() < range.start) {
      this.seek(range.start);
    }
  }

  public getCurrentTime(): number {
    if (this.isSynthetic) {
      if (!this.isPlaying) return this.synthPausedAt;
      const elapsed = (Date.now() - this.synthStartTime) / 1000;
      return Math.min(this.synthDuration, elapsed * this.playbackRate);
    }
    return this.audioEl?.currentTime || 0;
  }

  public setVocalBoost(enable: boolean) {
    this.isVocalBoost = enable;
  }

  public setEcho(enable: boolean) {
    this.isEchoEnabled = enable;
  }

  private playSynthetic() {
    const audioCtx = getAudioContext();
    this.synthStartTime = Date.now() - (this.synthPausedAt / this.playbackRate) * 1000;

    let lastBeat = -1;

    this.synthTimer = window.setInterval(() => {
      const cur = this.getCurrentTime();

      if (this.loopRange && cur >= this.loopRange.end) {
        this.seek(this.loopRange.start);
        return;
      }

      if (cur >= this.synthDuration) {
        this.pause();
        this.callbacks.onEnded();
        return;
      }

      this.callbacks.onTimeUpdate(cur, this.synthDuration);

      const beatIndex = Math.floor(cur / 1.5);
      if (beatIndex !== lastBeat && audioCtx.state === 'running') {
        lastBeat = beatIndex;
        this.triggerAcousticBeat(audioCtx, beatIndex);
      }
    }, 50);
  }

  private triggerAcousticBeat(ctx: AudioContext, beatIdx: number) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freqs = [146.83, 174.61, 196.0, 220.0];
      const pitchRatio = Math.pow(2, this.pitchSemis / 12);
      const freq = freqs[beatIdx % freqs.length] * pitchRatio;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // AudioCtx silent tolerance
    }
  }

  public destroy() {
    this.stop();
    if (this.audioEl) {
      this.audioEl.src = '';
      this.audioEl = null;
    }
  }
}

export class MicRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  public async start(): Promise<void> {
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250);
  }

  public async stop(): Promise<{ blob: Blob; url: string; base64: string; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('ضبط‌کننده فعال نیست.'));
      }

      this.mediaRecorder.onstop = async () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || '';

          const tempAudio = new Audio(url);
          tempAudio.addEventListener('loadedmetadata', () => {
            const dur = tempAudio.duration && isFinite(tempAudio.duration) ? tempAudio.duration : 15;
            resolve({ blob, url, base64, duration: dur });
          });
          tempAudio.addEventListener('error', () => {
            resolve({ blob, url, base64, duration: 15 });
          });
        };
        reader.readAsDataURL(blob);

        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }
      };

      this.mediaRecorder.stop();
    });
  }

  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}
