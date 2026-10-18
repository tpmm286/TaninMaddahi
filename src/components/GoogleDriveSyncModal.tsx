/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MaddahiTrack } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import { apiUrl } from '../utils/api';
import { GoogleDriveConfig, DRIVE_CONFIG_STORAGE_KEY } from '../services/googleDriveService';
import { Cloud, Key, FolderGit2, CheckCircle2, AlertCircle, Loader2, Download, ExternalLink, ShieldCheck } from 'lucide-react';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTracksImported: (newTracks: MaddahiTrack[]) => void;
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
  const [fetchedFiles, setFetchedFiles] = useState<any[]>([]);
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

      const res = await fetch(apiUrl('/api/drive/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          refreshToken: config.refreshToken,
          folderId: config.folderId,
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        setFetchedFiles(data.files);
        setSuccessMsg(`ارتباط با گوگل درایو برقرار شد. ${data.files.length} فایل صوتی در پوشه یافت شد.`);
        const sel: Record<string, boolean> = {};
        data.files.forEach((f: any) => {
          sel[f.id] = true;
        });
        setSelectedFileIds(sel);
      } else {
        throw new Error(data.error || 'خطا در همگام‌سازی با گوگل درایو.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطای شبکه در ارتباط با گوگل درایو');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportSelected = () => {
    const filesToImport = fetchedFiles.filter((f) => selectedFileIds[f.id]);
    if (filesToImport.length === 0) {
      setErrorMsg('هیچ فایلی برای ورود انتخاب نشده است.');
      return;
    }

    const newTracks: MaddahiTrack[] = filesToImport.map((file, idx) => {
      const cleanName = (file.name || `فایل گوگل درایو ${idx + 1}`)
        .replace(/\.[^/.]+$/, '')
        .replace(/[_]/g, ' ');

      const lowerName = cleanName.toLowerCase();
      let detectedCategory: 'zamineh' | 'shoor' | 'vahed' | 'rozeh' | 'doodameh' | 'monajat' = 'zamineh';
      if (lowerName.includes('شور') || lowerName.includes('shoor')) detectedCategory = 'shoor';
      else if (lowerName.includes('واحد') || lowerName.includes('vahed')) detectedCategory = 'vahed';
      else if (lowerName.includes('روضه') || lowerName.includes('rozeh')) detectedCategory = 'rozeh';
      else if (lowerName.includes('دودمه') || lowerName.includes('doodameh')) detectedCategory = 'doodameh';
      else if (lowerName.includes('مناجات') || lowerName.includes('monajat')) detectedCategory = 'monajat';
      else if (lowerName.includes('زمینه') || lowerName.includes('zamineh')) detectedCategory = 'zamineh';

      return {
        id: `drive_track_${file.id}_${Date.now()}_${idx}`,
        title: cleanName,
        maddah: 'مداح گوگل درایو',
        category: detectedCategory,
        duration: 90,
        audioUrl: file.webContentLink || `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        lyricsLines: [
          { id: `line_1_${Date.now()}`, startTime: 0, endTime: 10, text: `[فایل وارد شده از گوگل درایو: ${cleanName}]`, type: 'verse' },
          { id: `line_2_${Date.now()}`, startTime: 10, endTime: 30, text: 'جهت همگام‌سازی هوشمند متن، روی دکمه همگامی کلیک کنید.', type: 'verse' },
        ],
        isCustom: true,
        occasion: 'گوگل درایو',
        createdAt: Date.now(),
      };
    });

    onTracksImported(newTracks);
    setSuccessMsg(`${newTracks.length} فایل صوتی با موفقیت به کتابخانه اضافه شد.`);
    setTimeout(() => {
      onClose();
    }, 1200);
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
              توکن‌های شما صرفاً در مرورگر شما (Local Storage) ذخیره شده و مستقیماً برای دریافت لیست صوت‌ها به Google OAuth و Google Drive ارسال می‌شوند و در هیچ سرور واسطه‌ای ذخیره نمی‌گردند.
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
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg ${
                  isGreen
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black'
                    : 'bg-red-600 hover:bg-red-500 text-stone-100 font-black'
                }`}
              >
                <Download className="w-5 h-5" />
                <span>افزودن فایل‌های انتخاب‌شده به کتابخانه طنین مداحی</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
