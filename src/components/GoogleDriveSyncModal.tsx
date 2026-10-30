/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MaddahiTrack } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import { saveAudio, loadAudio, isVolatileUrl, measureAudioDuration } from '../utils/audioStore';
import {
  GoogleDriveConfig,
  DRIVE_CONFIG_STORAGE_KEY,
  BACKUP_FILE_NAME,
  BACKUP_AUDIO_PREFIX,
  DriveFile,
  getGoogleDriveAccessToken,
  listDriveFolderFiles,
  isAudioDriveFile,
  downloadDriveFile,
  uploadDriveFile,
} from '../services/googleDriveService';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  ShieldCheck,
} from 'lucide-react';

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('خواندن فایل پشتیبان ممکن نشد.'));
    r.readAsText(blob);
  });
}

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTracksImported: (newTracks: MaddahiTrack[]) => void;
  /** همهٔ آثار فعلی (برای پشتیبان‌گیری) */
  tracks: MaddahiTrack[];
  /** جایگزینی کتابخانه با پشتیبان دانلودشده */
  onRestoreData: (restoredTracks: MaddahiTrack[]) => void;
  theme?: AppTheme;
}

export const DEFAULT_DRIVE_CONFIG: GoogleDriveConfig = {
  clientId: '',
  clientSecret: '',
  refreshToken: '',
  folderId: '',
  enabled: false,
};

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  onTracksImported,
  tracks,
  onRestoreData,
  theme = 'soft-green',
}) => {
  const isGreen = theme === 'soft-green';

  const [config, setConfig] = useState<GoogleDriveConfig>(() => {
    try {
      const saved = localStorage.getItem(DRIVE_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_DRIVE_CONFIG, ...parsed };
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_DRIVE_CONFIG;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [fetchedFiles, setFetchedFiles] = useState<DriveFile[]>([]);
  const [busy, setBusy] = useState<null | 'import' | 'backup' | 'restore'>(null);
  const [progress, setProgress] = useState<string>('');
  const [includeAudio, setIncludeAudio] = useState<boolean>(true);
  const [selectedFileIds, setSelectedFileIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      localStorage.setItem(DRIVE_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  if (!isOpen) return null;

  const handleTestAndFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFetchedFiles([]);

    try {
      if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.folderId) {
        throw new Error('لطفاً تمامی فیلدهای Client ID، Client Secret، Refresh Token و Folder ID را وارد کنید.');
      }

      const token = await getGoogleDriveAccessToken(
        config.clientId,
        config.clientSecret,
        config.refreshToken
      );
      const all = await listDriveFolderFiles(token, config.folderId);
      const audioFiles = all.filter(isAudioDriveFile);
      setFetchedFiles(audioFiles);
      const hasBackup = all.some((f) => f.name === BACKUP_FILE_NAME);
      setSuccessMsg(
        `ارتباط با گوگل درایو برقرار شد. ${audioFiles.length} فایل صوتی در پوشه یافت شد.` +
          (hasBackup ? ' یک فایل پشتیبان هم در این پوشه هست.' : '')
      );
      const sel: Record<string, boolean> = {};
      audioFiles.forEach((f) => {
        sel[f.id] = true;
      });
      setSelectedFileIds(sel);
    } catch (err: any) {
      setErrorMsg(err.message || 'خطای شبکه در ارتباط با گوگل درایو');
    } finally {
      setIsLoading(false);
    }
  };

  const detectCategory = (name: string): MaddahiTrack['category'] => {
    const n = name.toLowerCase();
    if (n.includes('شور') || n.includes('shoor')) return 'shoor';
    if (n.includes('واحد') || n.includes('vahed')) return 'vahed';
    if (n.includes('روضه') || n.includes('rozeh')) return 'rozeh';
    if (n.includes('دودمه') || n.includes('doodameh')) return 'doodameh';
    if (n.includes('مناجات') || n.includes('monajat')) return 'monajat';
    return 'zamineh';
  };

  const requireConfig = () => {
    if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.folderId) {
      throw new Error('لطفاً تمامی فیلدهای Client ID، Client Secret، Refresh Token و Folder ID را وارد کنید.');
    }
  };

  // دانلود فایل‌های انتخاب‌شده با توکن و ذخیرهٔ ماندگار آن‌ها در برنامه
  const handleImportSelected = async () => {
    const filesToImport = fetchedFiles.filter((f) => selectedFileIds[f.id]);
    if (filesToImport.length === 0) {
      setErrorMsg('هیچ فایلی برای ورود انتخاب نشده است.');
      return;
    }

    setBusy('import');
    setErrorMsg(null);
    setSuccessMsg(null);
    const newTracks: MaddahiTrack[] = [];
    let lastError = '';

    try {
      requireConfig();
      const token = await getGoogleDriveAccessToken(config.clientId, config.clientSecret, config.refreshToken);

      for (let idx = 0; idx < filesToImport.length; idx++) {
        const file = filesToImport[idx];
        setProgress(`در حال دانلود فایل ${idx + 1} از ${filesToImport.length}: ${file.name}`);
        try {
          const blob = await downloadDriveFile(token, file.id);
          const trackId = `drive_track_${file.id}_${Date.now()}_${idx}`;
          const saved = await saveAudio(trackId, blob);
          const url = URL.createObjectURL(blob);
          const dur = (await measureAudioDuration(url)) || 90;
          const cleanName = (file.name || `فایل گوگل درایو ${idx + 1}`)
            .replace(/\.[^/.]+$/, '')
            .replace(/[_]/g, ' ');

          newTracks.push({
            id: trackId,
            title: cleanName,
            maddah: 'مداح گوگل درایو',
            category: detectCategory(cleanName),
            duration: dur,
            audioUrl: url,
            hasLocalAudio: saved,
            audioFileName: file.name,
            lyricsLines: [
              { id: `line_1_${Date.now()}_${idx}`, startTime: 0, endTime: Math.min(10, dur), text: `[فایل وارد شده از گوگل درایو: ${cleanName}]`, type: 'verse' },
              { id: `line_2_${Date.now()}_${idx}`, startTime: Math.min(10, dur), endTime: Math.min(30, dur), text: 'جهت همگام‌سازی هوشمند متن، روی دکمه همگامی کلیک کنید.', type: 'verse' },
            ],
            isCustom: true,
            occasion: 'گوگل درایو',
            createdAt: Date.now(),
          });
        } catch (e: any) {
          lastError = e?.message || 'خطای نامشخص';
        }
      }
    } catch (e: any) {
      lastError = e?.message || 'خطای نامشخص';
    }

    setBusy(null);
    setProgress('');

    if (newTracks.length > 0) {
      onTracksImported(newTracks);
      setSuccessMsg(
        `${newTracks.length} فایل صوتی دانلود و به کتابخانه اضافه شد.` +
          (lastError ? ` (بعضی فایل‌ها ناموفق بودند: ${lastError})` : '')
      );
      setTimeout(() => onClose(), 1500);
    } else {
      setErrorMsg(lastError || 'دانلود فایل‌ها ناموفق بود.');
    }
  };

  // پشتیبان‌گیری: ارسال کتابخانه (و در صورت انتخاب، فایل‌های صوتی) به پوشهٔ درایو
  const handleBackupToDrive = async () => {
    setBusy('backup');
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      requireConfig();
      setProgress('در حال اتصال به گوگل درایو...');
      const token = await getGoogleDriveAccessToken(config.clientId, config.clientSecret, config.refreshToken);
      const files = await listDriveFolderFiles(token, config.folderId);

      const cleanTracks = tracks.map((t) => (isVolatileUrl(t.audioUrl) ? { ...t, audioUrl: undefined } : t));
      const json = JSON.stringify(
        {
          version: 2,
          appName: 'Tanin Maddahi Sync',
          exportTimestamp: Date.now(),
          tracksCount: cleanTracks.length,
          tracks: cleanTracks,
        },
        null,
        2
      );
      setProgress('در حال ارسال فایل پشتیبان آثار و متن‌ها...');
      const existingBackup = files.find((f) => f.name === BACKUP_FILE_NAME);
      await uploadDriveFile(
        token,
        config.folderId,
        BACKUP_FILE_NAME,
        'application/json',
        new Blob([json], { type: 'application/json' }),
        existingBackup?.id
      );

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      let lastError = '';
      if (includeAudio) {
        const withAudio = tracks.filter((t) => t.hasLocalAudio);
        for (let i = 0; i < withAudio.length; i++) {
          const t = withAudio[i];
          setProgress(`در حال ارسال صوت ${i + 1} از ${withAudio.length}: ${t.title}`);
          const blob = await loadAudio(t.id);
          if (!blob) continue;
          const prefix = `${BACKUP_AUDIO_PREFIX}${t.id}__`;
          const existing = files.find((f) => f.name.startsWith(prefix));
          if (existing && Number(existing.size) === blob.size) {
            skipped++;
            continue;
          }
          const safeName = (t.audioFileName || 'audio.mp3').replace(/[^\w.\- \u0600-\u06FF]/g, '_');
          try {
            await uploadDriveFile(
              token,
              config.folderId,
              `${prefix}${safeName}`,
              blob.type || 'audio/mpeg',
              blob,
              existing?.id
            );
            uploaded++;
          } catch (e: any) {
            failed++;
            lastError = e?.message || '';
          }
        }
      }

      let msg = `پشتیبان ${cleanTracks.length} اثر با موفقیت در گوگل درایو ذخیره شد.`;
      if (includeAudio) {
        msg += ` صوت‌ها: ${uploaded} ارسال‌شده، ${skipped} از قبل موجود`;
        if (failed) msg += `، ${failed} ناموفق`;
        msg += '.';
      }
      if (failed && lastError) {
        setErrorMsg(lastError);
      }
      setSuccessMsg(msg);
    } catch (e: any) {
      setErrorMsg(e?.message || 'پشتیبان‌گیری ناموفق بود.');
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  // بازیابی: دانلود آخرین پشتیبان (و صوت‌ها) از درایو
  const handleRestoreFromDrive = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      requireConfig();
    } catch (e: any) {
      setErrorMsg(e.message);
      return;
    }
    if (!window.confirm('کتابخانهٔ فعلی با پشتیبان گوگل درایو جایگزین می‌شود. ادامه می‌دهید؟')) {
      return;
    }

    setBusy('restore');
    try {
      setProgress('در حال اتصال به گوگل درایو...');
      const token = await getGoogleDriveAccessToken(config.clientId, config.clientSecret, config.refreshToken);
      const files = await listDriveFolderFiles(token, config.folderId);
      const backup = files.find((f) => f.name === BACKUP_FILE_NAME);
      if (!backup) {
        throw new Error('فایل پشتیبان در این پوشه پیدا نشد. ابتدا یک‌بار «ارسال پشتیبان» را بزنید.');
      }

      setProgress('در حال دانلود فایل پشتیبان...');
      const text = await readBlobText(await downloadDriveFile(token, backup.id));
      const parsed = JSON.parse(text);
      const restored: MaddahiTrack[] = Array.isArray(parsed) ? parsed : parsed?.tracks;
      if (!Array.isArray(restored) || restored.length === 0) {
        throw new Error('فایل پشتیبان معتبر نیست یا هیچ اثری ندارد.');
      }

      const needAudio = restored.filter((t) => t.hasLocalAudio);
      let gotAudio = 0;
      for (let i = 0; i < needAudio.length; i++) {
        const t = needAudio[i];
        const f = files.find((x) => x.name.startsWith(`${BACKUP_AUDIO_PREFIX}${t.id}__`));
        if (!f) continue;
        setProgress(`در حال دانلود صوت ${i + 1} از ${needAudio.length}: ${t.title}`);
        try {
          const blob = await downloadDriveFile(token, f.id);
          if (await saveAudio(t.id, blob)) gotAudio++;
        } catch {
          // ادامه با بقیه
        }
      }

      onRestoreData(restored);
      setSuccessMsg(
        `${restored.length} اثر از گوگل درایو بازیابی شد` +
          (needAudio.length ? ` (${gotAudio} از ${needAudio.length} فایل صوتی).` : '.')
      );
    } catch (e: any) {
      setErrorMsg(e?.message || 'بازیابی ناموفق بود.');
    } finally {
      setBusy(null);
      setProgress('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-drive-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
    >
      <div
        className={`w-full max-w-2xl rounded-2xl border p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col ${
          isGreen
            ? 'bg-[#101712] border-[#223826] text-stone-100'
            : 'bg-[#171010] border-[#382222] text-stone-100'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-xl border ${
                isGreen
                  ? 'bg-[#14301d] text-emerald-300 border-[#225732]'
                  : 'bg-[#301414] text-red-300 border-[#572222]'
              }`}
            >
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 id="google-drive-modal-title" className="font-bold text-lg">همگام‌سازی مستقیم با توکن گوگل درایو</h2>
              <p className="text-xs text-stone-400">
                وارد کردن فایل‌های صوتی منبر و مداحی به طور مستقیم از پوشه گوگل درایو با توکن اختصاصی شما
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-xl bg-stone-900 text-stone-400 hover:text-stone-100 flex items-center justify-center border border-stone-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div className="p-3.5 rounded-xl bg-stone-900/90 border border-stone-800 text-xs text-stone-300 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>امنیت و حریم خصوصی توکن‌ها</span>
            </div>
            <p className="leading-relaxed text-stone-400">
              توکن‌های شما فقط روی همین دستگاه ذخیره می‌شوند و مستقیماً (بدون هیچ سرور واسطه‌ای) برای دانلود، ارسال و پشتیبان‌گیری به Google OAuth و Google Drive فرستاده می‌شوند.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-stone-900/90 border border-stone-800 text-xs text-stone-300 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <FolderGit2 className="w-4 h-4" />
              <span>ساختار پیشنهادی نام‌گذاری و دسته‌بندی فایل‌ها در گوگل درایو</span>
            </div>
            <p className="leading-relaxed text-stone-400">
              برای اینکه برنامه به صورت خودکار سبک هر مداحی را تشخیص دهد، کافی است نام فایل‌های صوتی درایو شامل یکی از کلمات کلیدی زیر باشد:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="px-2 py-0.5 rounded bg-stone-800 text-emerald-300 font-mono text-[10px]">شور (shoor)</span>
              <span className="px-2 py-0.5 rounded bg-stone-800 text-amber-300 font-mono text-[10px]">واحد (vahed)</span>
              <span className="px-2 py-0.5 rounded bg-stone-800 text-purple-300 font-mono text-[10px]">روضه (rozeh)</span>
              <span className="px-2 py-0.5 rounded bg-stone-800 text-blue-300 font-mono text-[10px]">دودمه (doodameh)</span>
              <span className="px-2 py-0.5 rounded bg-stone-800 text-teal-300 font-mono text-[10px]">مناجات (monajat)</span>
              <span className="px-2 py-0.5 rounded bg-stone-800 text-emerald-300 font-mono text-[10px]">زمینه (zamineh)</span>
            </div>
          </div>

          <form onSubmit={handleTestAndFetch} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">
                آیدی پوشه گوگل درایو (Folder ID)
              </label>
              <input
                type="text"
                value={config.folderId}
                onChange={(e) => setConfig({ ...config, folderId: e.target.value })}
                placeholder="مثال: 1B2M2Y8AsgTpgSv8TZ..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-sm text-stone-100 focus:outline-none focus:border-emerald-500 font-mono text-left dir-ltr"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                آیدی موجود در انتهای لینک پوشه گوگل درایو خود را اینجا وارد کنید.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  شناسه مشتری (Client ID)
                </label>
                <input
                  type="text"
                  value={config.clientId}
                  onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                  placeholder="xxxxxxx.apps.googleusercontent.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-sm text-stone-100 focus:outline-none focus:border-emerald-500 font-mono text-left dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-300 mb-1">
                  کلید مخفی کلاینت (Client Secret)
                </label>
                <input
                  type="password"
                  value={config.clientSecret}
                  onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
                  placeholder="GOCSPX-..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-sm text-stone-100 focus:outline-none focus:border-emerald-500 font-mono text-left dir-ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-300 mb-1">
                توکن بازخوانی (Refresh Token)
              </label>
              <input
                type="password"
                value={config.refreshToken}
                onChange={(e) => setConfig({ ...config, refreshToken: e.target.value })}
                placeholder="1//04..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-sm text-stone-100 focus:outline-none focus:border-emerald-500 font-mono text-left dir-ltr"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg ${
                  isGreen
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black'
                    : 'bg-red-600 hover:bg-red-500 text-stone-100 font-black'
                } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>در حال اتصال و دریافت فایل‌ها از گوگل درایو...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-5 h-5" />
                    <span>اتصال و دریافت لیست فایل‌های صوتی</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-stone-900/90 border border-stone-800 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <CloudUpload className="w-4 h-4" />
              <span>پشتیبان‌گیری و بازیابی با گوگل درایو</span>
            </div>
            <p className="text-[11px] text-stone-400 leading-relaxed">
              آثار، متن‌ها، زمان‌بندی‌ها و یادداشت‌ها در فایل <span className="font-mono text-stone-300">{BACKUP_FILE_NAME}</span> داخل
              همین پوشه ذخیره می‌شوند و با «بازیابی» دوباره برمی‌گردند. توکن شما باید دسترسی نوشتن در درایو داشته باشد.
            </p>
            <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAudio}
                onChange={(e) => setIncludeAudio(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500"
              />
              <span>فایل‌های صوتی هم ذخیره شوند (حجم بیشتر)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleBackupToDrive}
                disabled={busy !== null}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                  isGreen
                    ? 'bg-[#14301d] text-emerald-300 border-[#225732]'
                    : 'bg-[#301414] text-red-300 border-[#572222]'
                } ${busy !== null ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {busy === 'backup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                <span>ارسال پشتیبان</span>
              </button>
              <button
                type="button"
                onClick={handleRestoreFromDrive}
                disabled={busy !== null}
                className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-stone-700 bg-stone-900 text-stone-200 transition-colors cursor-pointer ${
                  busy !== null ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {busy === 'restore' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                <span>بازیابی از درایو</span>
              </button>
            </div>
            {progress && <p className="text-[11px] text-amber-300 leading-relaxed">{progress}</p>}
          </div>

          {fetchedFiles.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-stone-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-200">
                  فایل‌های صوتی یافت شده ({fetchedFiles.length}):
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      fetchedFiles.forEach((f) => { all[f.id] = true; });
                      setSelectedFileIds(all);
                    }}
                    className="text-emerald-400 hover:underline"
                  >
                    انتخاب همه
                  </button>
                  <span className="text-stone-600">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFileIds({})}
                    className="text-stone-400 hover:underline"
                  >
                    لغو انتخاب
                  </button>
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {fetchedFiles.map((file) => {
                  const isChecked = Boolean(selectedFileIds[file.id]);
                  return (
                    <div
                      key={file.id}
                      onClick={() => setSelectedFileIds({ ...selectedFileIds, [file.id]: !isChecked })}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked
                          ? isGreen
                            ? 'bg-[#142618] border-emerald-500/80 text-stone-100'
                            : 'bg-[#261414] border-red-500/80 text-stone-100'
                          : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:bg-stone-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium truncate">{file.name}</span>
                      </div>
                      <span className="text-[10px] text-stone-500 font-mono shrink-0">
                        {file.size ? `${Math.round(Number(file.size) / (1024 * 1024))} MB` : 'صوت'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleImportSelected}
                disabled={busy !== null}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg ${
                  isGreen
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black'
                    : 'bg-red-600 hover:bg-red-500 text-stone-100 font-black'
                }`}
              >
                {busy === 'import' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                <span>{busy === 'import' ? 'در حال دانلود...' : 'دانلود و افزودن فایل‌های انتخاب‌شده به کتابخانه'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
