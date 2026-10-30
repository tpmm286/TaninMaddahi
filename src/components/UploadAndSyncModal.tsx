/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { MaddahiTrack, LyricLine, ProxyConfig } from '../types/maddahi';
import { MicRecorder } from '../utils/audioSynth';
import { estimateTimestampsFromText, formatTime } from '../utils/syncUtils';
import {
  Upload,
  Mic,
  FileAudio,
  Sparkles,
  X,
  CheckCircle,
  AlertCircle,
  Play,
  Square,
  BookOpen,
  Edit3,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Server,
  Zap,
  Settings2,
  Clock,
  Music,
  Copy,
} from 'lucide-react';

import { AppTheme } from '../types/theme';
import { apiUrl, getApiBase } from '../utils/api';
import { splitAudioToWavChunks } from '../utils/audioChunks';
import { readJsonSafe, extractViaProxyDirect, extractChunkDirect } from '../utils/proxyClient';
import { copyText, lrcStamp } from '../utils/clipboard';

interface UploadAndSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrackCreated: (newTrack: MaddahiTrack) => void;
  proxyConfig: ProxyConfig;
  onOpenProxySettings: () => void;
  theme?: AppTheme;
}

export const UploadAndSyncModal: React.FC<UploadAndSyncModalProps> = ({
  isOpen,
  onClose,
  onTrackCreated,
  proxyConfig,
  onOpenProxySettings,
  theme = 'soft-green',
}) => {
  const isGreen = theme === 'soft-green';
  const [activeTab, setActiveTab] = useState<'upload' | 'record'>('upload');
  const [title, setTitle] = useState('');
  const [maddah, setMaddah] = useState('مداح (خودم)');
  const [category, setCategory] = useState<MaddahiTrack['category']>('zamineh');
  const [occasion, setOccasion] = useState('ایام محرم و صفر');
  const [existingPoemText, setExistingPoemText] = useState('');

  // Audio state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioBase64, setAudioBase64] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<number>(60);
  const [audioMime, setAudioMime] = useState<string>('audio/mp3');

  // Mic & Live Speech Recognition state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MicRecorder | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [usedModel, setUsedModel] = useState<string>('');
  const [usedSource, setUsedSource] = useState<'custom_proxy' | 'gemini_direct' | 'text_estimated' | null>(null);

  // Review & Confirmation step before final save
  const [previewStep, setPreviewStep] = useState<boolean>(false);
  const [copyNote, setCopyNote] = useState<string>('');
  const doCopy = async (text: string, label: string) => {
    const ok = await copyText(text);
    setCopyNote(ok ? `${label} کپی شد ✓` : 'کپی انجام نشد');
    setTimeout(() => setCopyNote(''), 1800);
  };
  const cleanLines = () => extractedLines.filter((l) => l.text.trim());
  const [extractedLines, setExtractedLines] = useState<LyricLine[]>([]);

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setPreviewStep(false);
      setExtractedLines([]);
      setErrorMsg('');
      setIsProcessing(false);
      setProcessStep('');
      setUsedSource(null);
      setUsedModel('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setAudioFile(file);
    setAudioMime(file.type || 'audio/mp3');

    // Title suggestion from filename
    const cleanFileName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .trim();
    if (!title) {
      setTitle(cleanFileName);
    }

    const objectUrl = URL.createObjectURL(file);
    setAudioUrl(objectUrl);

    // Read duration via temp Audio element
    const tempAudio = new Audio(objectUrl);
    tempAudio.addEventListener('loadedmetadata', () => {
      if (tempAudio.duration && isFinite(tempAudio.duration)) {
        setAudioDuration(Math.round(tempAudio.duration));
      }
    });

    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const b64 = res.split(',')[1] || '';
      setAudioBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleStartRecord = async () => {
    try {
      setErrorMsg('');
      const rec = new MicRecorder();
      recorderRef.current = rec;
      await rec.start();
      setIsRecording(true);
      setRecordSeconds(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      // Start live Persian speech recognition if available in browser
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'fa-IR';
          recognition.continuous = true;
          recognition.interimResults = true;

          recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + '\n';
              }
            }
            if (finalTranscript.trim()) {
              setExistingPoemText((prev) =>
                prev ? `${prev.trim()}\n${finalTranscript.trim()}` : finalTranscript.trim()
              );
            }
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn('Speech recognition start failed:', e);
        }
      }
    } catch (err: any) {
      setErrorMsg('امکان دسترسی به میکروفون میسر نشد: ' + (err.message || 'خطای دسترسی'));
    }
  };

  const handleStopRecord = async () => {
    if (!recorderRef.current) return;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }

    try {
      const { blob, url, base64, duration } = await recorderRef.current.stop();
      setIsRecording(false);
      setAudioUrl(url);
      setAudioBase64(base64);
      setAudioDuration(Math.round(duration) || Math.max(recordSeconds, 15));
      setAudioMime(blob.type || 'audio/webm');
      if (!title) {
        setTitle(`مداحی ضبط شده ${new Date().toLocaleDateString('fa-IR')}`);
      }
    } catch (err: any) {
      setIsRecording(false);
      setErrorMsg('خطا در ذخیره ضبط: ' + err.message);
    }
  };

  // Perform AI Sync & Extraction (supporting custom OpenAI-compatible proxy server)
  const handleProcessAndSync = async () => {
    if (!title.trim()) {
      setErrorMsg('لطفاً عنوان اثر را وارد نمایید.');
      return;
    }

    if (!audioUrl && !existingPoemText.trim()) {
      setErrorMsg('لطفاً یک فایل صوتی بارگذاری کنید یا با میکروفون بخوانید یا متن شعر را بنویسید.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    if (proxyConfig?.enabled && proxyConfig?.baseUrl) {
      setProcessStep(
        `در حال ارتباط با سرور واسط اختصاصی شما (${proxyConfig.modelName || 'OpenAI'})...`
      );
    } else {
      setProcessStep('در حال تحلیل صوت و استخراج هوشمند ابیات...');
    }

    try {
      let finalLines: LyricLine[] = [];
      let detectedCategory = category;
      let realError = '';

      // سرورهای واسط معمولاً حجم درخواست را محدود می‌کنند (خطای 413): صوت را روی گوشی
      // فشرده و به بخش‌های کوتاه تقسیم می‌کنیم و بخش‌ها را پشت سر هم می‌فرستیم.
      let skipSingleRequest = false;
      if (proxyConfig?.enabled && proxyConfig?.baseUrl && audioUrl) {
        let chunks: Awaited<ReturnType<typeof splitAudioToWavChunks>> | null = null;
        try {
          setProcessStep('در حال آماده‌سازی صوت (فشرده‌سازی و تقسیم به بخش‌های کوچک)...');
          chunks = await splitAudioToWavChunks(audioUrl, 15);
        } catch (e) {
          console.warn('Audio chunking failed, falling back to single request:', e);
        }

        if (chunks && chunks.length > 0) {
          skipSingleRequest = true;
          const collected: any[] = [];
          let lastError = '';
          let firstData: any = null;

          for (let ci = 0; ci < chunks.length; ci++) {
            const ch = chunks[ci];
            setProcessStep(`در حال استخراج متن بخش ${ci + 1} از ${chunks.length}...`);
            // هر بخش تا دو بار تلاش می‌شود تا مصرعی به‌خاطر خطای لحظه‌ای جا نیفتد
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                let d: any;
                if (!getApiBase()) {
                  // بدون سرور برنامه (نسخهٔ اندروید): ارسال مستقیم به سرور واسط
                  d = await extractChunkDirect({
                    proxyConfig,
                    audioBase64: ch.base64,
                    existingLyrics: chunks.length === 1 ? existingPoemText.trim() : '',
                    title: title.trim(),
                    audioDuration: Math.round(ch.duration),
                  });
                } else {
                  const response = await fetch(apiUrl('/api/gemini/transcribe-sync'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      audioBase64: ch.base64,
                      mimeType: 'audio/wav',
                      existingLyrics: chunks.length === 1 ? existingPoemText.trim() : '',
                      title: title.trim(),
                      audioDuration: Math.round(ch.duration),
                      proxyConfig,
                    }),
                  });
                  d = await readJsonSafe(response);
                }
                if (d.success && d.data?.lines?.length > 0) {
                  if (!firstData) firstData = d;
                  d.data.lines.forEach((l: any) => {
                    const st = (Number(l.startTime) || 0) + ch.start;
                    const en = (Number(l.endTime) || Number(l.startTime) + 3 || 3) + ch.start;
                    // مصرع فقط در قطعه‌ای پذیرفته می‌شود که شروعش در بازهٔ اصلی همان قطعه است
                    // (حاشیه‌های اضافه فقط برای فهم بهتر مدل است و نیمه‌مصرع‌ها دور ریخته می‌شوند)
                    if (st < ch.coreStart - 0.3 || st >= ch.coreEnd) return;
                    collected.push({ ...l, startTime: st, endTime: Math.max(en, st + 0.5) });
                  });
                  lastError = '';
                  break;
                } else {
                  lastError = d.error || 'پاسخ معتبری دریافت نشد.';
                }
              } catch (e: any) {
                lastError = e?.message || 'خطای شبکه';
              }
            }
          }

          if (collected.length > 0) {
            collected.sort((x, y) => x.startTime - y.startTime);
            finalLines = collected.map((l: any, i: number) => ({
              id: `line-${i}-${Date.now()}`,
              startTime: Math.round(l.startTime * 10) / 10,
              endTime: Math.round(l.endTime * 10) / 10,
              text: (l.text || '').trim(),
              type: l.type === 'chorus' ? 'chorus' : l.type === 'mention' ? 'mention' : 'verse',
              stanzaIndex: Math.floor(i / 4) + 1,
            })) as LyricLine[];

            if (firstData?.source === 'custom_proxy') {
              setUsedSource('custom_proxy');
              setUsedModel(firstData.modelUsed || proxyConfig.modelName);
            } else {
              setUsedSource('gemini_direct');
            }
            if (firstData?.data?.category) {
              detectedCategory = firstData.data.category;
              setCategory(detectedCategory);
            }
          } else if (lastError) {
            realError = lastError;
          }
        }
      }

      if (!skipSingleRequest) {
      // Call server endpoint with proxy config
      try {
        let data: any;
        if (!getApiBase() && proxyConfig?.enabled && proxyConfig?.baseUrl) {
          // بدون سرور برنامه: ارسال مستقیم به سرور واسط
          data = await extractViaProxyDirect({
            proxyConfig,
            audioBase64,
            mimeType: audioMime,
            existingLyrics: existingPoemText.trim(),
            title: title.trim(),
            audioDuration,
            onProgress: (msg: string) => setProcessStep(msg),
          });
        } else {
          const response = await fetch(apiUrl('/api/gemini/transcribe-sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: audioBase64 || null,
              mimeType: audioMime,
              existingLyrics: existingPoemText.trim(),
              title: title.trim(),
              audioDuration: audioDuration,
              proxyConfig: proxyConfig?.enabled ? proxyConfig : undefined,
            }),
          });
          data = await readJsonSafe(response);
        }

        if (data.success && data.data?.lines?.length > 0) {
          finalLines = data.data.lines.map((l: any, i: number) => ({
            id: `line-${i}-${Date.now()}`,
            startTime:
              Number(l.startTime) ||
              Math.round((i * (audioDuration / data.data.lines.length)) * 10) / 10,
            endTime:
              Number(l.endTime) ||
              Math.round(((i + 1) * (audioDuration / data.data.lines.length)) * 10) / 10,
            text: l.text?.trim() || '',
            type: l.type === 'chorus' ? 'chorus' : l.type === 'mention' ? 'mention' : 'verse',
            stanzaIndex: Math.floor(i / 4) + 1,
          }));

          if (data.source === 'custom_proxy') {
            setUsedSource('custom_proxy');
            setUsedModel(data.modelUsed || proxyConfig.modelName);
          } else {
            setUsedSource('gemini_direct');
          }

          if (data.data.category) {
            detectedCategory = data.data.category;
            setCategory(detectedCategory);
          }
          if (data.data.detectedTitle && !title) {
            setTitle(data.data.detectedTitle);
          }
        } else if (data.error) {
          console.warn('Transcribe notice:', data.error);
          realError = String(data.error);
        } else {
          realError = 'پاسخ سرور فاقد ابیات بود (lines خالی).';
        }
      } catch (e: any) {
        console.warn('API call exception:', e);
        realError = `${e?.name || 'Error'}: ${e?.message || e}`;
      }
      }

      // If user provided existing poem text and audio extraction didn't populate:
      if (finalLines.length === 0 && existingPoemText.trim()) {
        setProcessStep('هماهنگ‌سازی شعر وارد شده با ضرب‌آهنگ صوت...');
        finalLines = estimateTimestampsFromText(existingPoemText.trim(), audioDuration || 60);
        setUsedSource('text_estimated');
      }

      // If still empty:
      if (finalLines.length === 0) {
        setIsProcessing(false);
        setErrorMsg(
          'استخراج انجام نشد.' +
            (realError ? `\n\nعلت اصلی خطا:\n${realError}` : '') +
            '\n\nمی‌توانید متن شعر را در کادر پایین بنویسید.'
        );
        return;
      }

      // Show preview step for the Maddah
      setExtractedLines(finalLines);
      setPreviewStep(true);
      setIsProcessing(false);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg('خطا در استخراج متن: ' + (err.message || 'خطای شبکه یا سرور'));
    }
  };

  // Final confirmation and track creation
  const handleFinalSave = () => {
    if (extractedLines.length === 0) {
      setErrorMsg('حداقل یک بیت یا مصراع باید وجود داشته باشد.');
      return;
    }

    const newTrack: MaddahiTrack = {
      id: `track-custom-${Date.now()}`,
      title: title.trim(),
      maddah: maddah.trim() || 'مداح هیئت',
      category: category,
      occasion: occasion.trim(),
      audioUrl: audioUrl || undefined,
      duration: audioDuration || 60,
      lyricsLines: extractedLines,
      isCustom: true,
      createdAt: Date.now(),
      notes: `اثر ثبت شده توسط مداح. ${
        usedSource === 'custom_proxy'
          ? `استخراج شده با سرور واسط سریع (${usedModel || proxyConfig.modelName})`
          : 'همگام‌سازی هوشمند طنین مداحی'
      }`,
    };

    onTrackCreated(newTrack);
    onClose();
  };

  const handleUpdatePreviewLine = (id: string, text: string) => {
    setExtractedLines((prev) => prev.map((l) => (l.id === id ? { ...l, text } : l)));
  };

  const handleDeletePreviewLine = (id: string) => {
    setExtractedLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddPreviewLine = () => {
    const last = extractedLines[extractedLines.length - 1];
    const newStart = last ? last.endTime : 0;
    setExtractedLines([
      ...extractedLines,
      {
        id: `line-${Date.now()}`,
        startTime: newStart,
        endTime: newStart + 4,
        text: '',
        type: 'verse',
        stanzaIndex: 1,
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 select-none">
      <div
        className={`relative w-full max-w-2xl rounded-2xl border p-4 sm:p-6 text-stone-100 max-h-[92vh] flex flex-col ${
          isGreen
            ? 'bg-[#101813] border-[#223828]'
            : 'bg-[#181010] border-[#382222]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-stone-950 shadow-md">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-amber-200">
                {previewStep ? 'بررسی و تأیید ابیات استخراج‌شده' : 'افزودن و استخراج هوشمند صوت و متن'}
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-400">
                {previewStep
                  ? 'ابیات و زمان‌بندی استخراج‌شده را تأیید یا در صورت نیاز ویرایش کنید'
                  : 'فایل صوتی خود یا نوحه مداحان دیگر را بدهید تا متن و هماهنگی دقیق ایجاد شود'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {/* Custom OpenAI-Architecture Proxy Banner */}
          {!previewStep && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 border border-stone-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    proxyConfig?.enabled && proxyConfig?.baseUrl
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  <Server className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-stone-200">سرور واسط تبدیل سریع:</span>
                    {proxyConfig?.enabled && proxyConfig?.baseUrl ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        فعال ({proxyConfig.modelName || 'OpenAI'})
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-400">
                        پیش‌فرض سامانه
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-400 truncate mt-0.5">
                    {proxyConfig?.enabled && proxyConfig?.baseUrl
                      ? `آدرس: ${proxyConfig.baseUrl}`
                      : 'می‌توانید سرور شخصی خود با معماری OpenAI را جهت سرعت بیشتر متصل کنید.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenProxySettings}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 hover:border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                title="تغییر آدرس سرور واسط، کلید دسترسی یا مدل"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>تنظیم سرور واسط</span>
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-950/70 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span className="whitespace-pre-line break-words min-w-0">{errorMsg}</span>
            </div>
          )}

          {!previewStep ? (
            <>
              {/* Input Method Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-stone-950/80 p-1.5 rounded-2xl border border-stone-800">
                <button
                  onClick={() => setActiveTab('upload')}
                  type="button"
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    activeTab === 'upload'
                      ? 'bg-amber-500 text-stone-950 shadow-md'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>بارگذاری فایل صوتی</span>
                </button>

                <button
                  onClick={() => setActiveTab('record')}
                  type="button"
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    activeTab === 'record'
                      ? 'bg-amber-500 text-stone-950 shadow-md'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>ضبط زنده با میکروفون</span>
                </button>
              </div>

              {/* Audio Input Section */}
              <div>
                {activeTab === 'upload' ? (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-stone-700/80 hover:border-amber-500/70 rounded-2xl p-5 bg-stone-950/40 hover:bg-stone-950/70 transition-all cursor-pointer text-center">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <FileAudio className="w-8 h-8 text-amber-400 mb-1.5" />
                    <p className="text-xs sm:text-sm font-bold text-stone-200">
                      {audioFile ? audioFile.name : 'انتخاب یا کشیدن فایل صوتی (MP3, WAV, M4A)'}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {audioDuration ? `طول فایل: ${audioDuration} ثانیه` : 'پشتیبانی از فایل‌های نوحه و روضه تا ۶۰ مگابایت'}
                    </p>
                    {audioUrl && (
                      <div className="mt-2.5 flex items-center gap-2 text-xs text-emerald-400 font-semibold bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-800/50">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>فایل صوتی بارگذاری و آماده است</span>
                      </div>
                    )}
                  </label>
                ) : (
                  <div className="border border-stone-800 rounded-2xl p-5 bg-stone-950/60 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mb-2 bg-stone-900 border border-stone-700">
                      <Mic
                        className={`w-7 h-7 ${isRecording ? 'text-red-500 animate-pulse' : 'text-amber-400'}`}
                      />
                    </div>
                    {isRecording ? (
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-red-400 flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                          در حال ضبط نوحه یا شعر... ({formatTime(recordSeconds)})
                        </p>
                        <button
                          onClick={handleStopRecord}
                          type="button"
                          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-stone-100 font-bold text-xs flex items-center gap-1.5 mx-auto transition-colors"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>پایان ضبط صوت</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-stone-400">
                          با فشردن دکمه زیر، نوای نوحه یا روضه را با میکروفون گوشی بخوانید.
                        </p>
                        <button
                          onClick={handleStartRecord}
                          type="button"
                          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 mx-auto transition-colors shadow-md"
                        >
                          <Mic className="w-4 h-4" />
                          <span>شروع ضبط نوحه با میکروفون</span>
                        </button>
                        {audioUrl && (
                          <p className="text-xs text-emerald-400 font-semibold mt-2">
                            ✓ قطعه صوتی به مدت {audioDuration} ثانیه ضبط شد
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    عنوان نوحه یا اثر *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثلاً: ای اهل حرم میر و علمدار نیامد"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-xs sm:text-sm text-stone-100 placeholder-stone-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    نام مداح
                  </label>
                  <input
                    type="text"
                    value={maddah}
                    onChange={(e) => setMaddah(e.target.value)}
                    placeholder="نام مداح یا خودم"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-xs sm:text-sm text-stone-100 placeholder-stone-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    سبک و قالب مداحی
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-xs sm:text-sm text-stone-100"
                  >
                    <option value="zamineh">زمینه</option>
                    <option value="shoor">شور</option>
                    <option value="vahed">واحد</option>
                    <option value="rozeh">روضه و مقتل</option>
                    <option value="doodameh">دودمه</option>
                    <option value="monajat">مناجات و دعا</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    مناسبت یا شب
                  </label>
                  <input
                    type="text"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                    placeholder="مثلاً: شب تاسوعا، شب اول محرم، فاطمیه"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-xs sm:text-sm text-stone-100 placeholder-stone-600"
                  />
                </div>
              </div>

              {/* Optional Existing Lyrics Input */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>متن یا ابیات شعر نوحه (اختیاری)</span>
                  </span>
                  <span className="text-[10px] text-stone-500">
                    اگر شعر را دارید وارد کنید تا دقیقاً با صوت هماهنگ شود
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={existingPoemText}
                  onChange={(e) => setExistingPoemText(e.target.value)}
                  placeholder="اگر ابیات شعر را دارید در اینجا جای‌گذاری (Paste) کنید، در غیر این صورت هوش مصنوعی مستقیماً از صوت شما متن را استخراج خواهد کرد..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-xs sm:text-sm text-stone-100 placeholder-stone-600 font-sans leading-relaxed resize-none"
                />
              </div>

              {/* Processing Progress Indicator */}
              {isProcessing && (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/50 flex items-center gap-3 animate-pulse">
                  <RefreshCw className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-amber-200">{processStep}</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {proxyConfig?.enabled
                        ? `ارتباط با سرور واسط ${proxyConfig.modelName || 'OpenAI'} جهت تبدیل با حداکثر سرعت...`
                        : 'سیستم در حال استخراج و بخش‌بندی زمانی ابیات است...'}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Review & Edit Extracted Lines Step */
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-700/50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-amber-200">
                    تعداد {extractedLines.length} مصراع با زمان‌بندی استخراج شد
                  </span>
                </div>
                {usedSource === 'custom_proxy' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                    سرور واسط ({usedModel || proxyConfig.modelName})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => doCopy(cleanLines().map((l) => l.text.trim()).join('\n'), 'متن')}
                  className="py-2 rounded-xl bg-stone-900 border border-stone-700 hover:border-amber-500 text-xs font-bold text-amber-200 flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>کپی متن (بدون زمان)</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    doCopy(cleanLines().map((l) => `${lrcStamp(l.startTime)}${l.text.trim()}`).join('\n'), 'متن با زمان')
                  }
                  className="py-2 rounded-xl bg-stone-900 border border-stone-700 hover:border-amber-500 text-xs font-bold text-amber-200 flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>کپی با زمان (LRC)</span>
                </button>
              </div>
              {copyNote && (
                <div className="text-center text-[11px] font-bold text-emerald-300">{copyNote}</div>
              )}

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {extractedLines.map((line, idx) => (
                  <div
                    key={line.id}
                    className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 flex items-center gap-2.5"
                  >
                    <span className="text-[11px] font-mono text-amber-400 w-12 text-center shrink-0">
                      {formatTime(line.startTime)}
                    </span>
                    <input
                      type="text"
                      value={line.text}
                      onChange={(e) => handleUpdatePreviewLine(line.id, e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 focus:border-amber-500 text-xs font-semibold text-stone-100"
                    />
                    <button
                      onClick={() => doCopy(line.text.trim(), 'خط')}
                      type="button"
                      className="p-1 text-stone-500 hover:text-amber-300 rounded-lg hover:bg-stone-800"
                      title="کپی این خط"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeletePreviewLine(line.id)}
                      type="button"
                      className="p-1 text-stone-500 hover:text-red-400 rounded-lg hover:bg-stone-800"
                      title="حذف این خط"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddPreviewLine}
                type="button"
                className="w-full py-2 rounded-xl border border-dashed border-stone-800 hover:border-amber-500 text-xs text-stone-400 hover:text-amber-300 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن مصراع جدید</span>
              </button>
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-800 shrink-0">
          {previewStep ? (
            <>
              <button
                onClick={() => setPreviewStep(false)}
                type="button"
                className="px-3.5 py-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>بازگشت و استخراج مجدد</span>
              </button>

              <button
                onClick={handleFinalSave}
                type="button"
                className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-stone-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>تأیید و ذخیره در تلفن همراه</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isProcessing}
                type="button"
                className="px-3.5 py-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800 text-xs sm:text-sm font-semibold transition-colors"
              >
                انصراف
              </button>

              <button
                onClick={handleProcessAndSync}
                disabled={isProcessing}
                type="button"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                <span>استخراج و همگام‌سازی هوشمند</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
