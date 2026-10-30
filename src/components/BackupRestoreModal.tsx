/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { MaddahiTrack, ProxyConfig } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import { isVolatileUrl } from '../utils/audioStore';
import { Download, Upload, Database, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: MaddahiTrack[];
  proxyConfig: ProxyConfig;
  onRestoreData: (restoredTracks: MaddahiTrack[]) => void;
  theme?: AppTheme;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  tracks,
  proxyConfig,
  onRestoreData,
  theme = 'soft-green',
}) => {
  const isGreen = theme === 'soft-green';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMsg, setStatusMsg] = useState<{ success: boolean; text: string } | null>(null);

  if (!isOpen) return null;

  const handleExportBackup = () => {
    try {
      const backupData = {
        version: 2,
        appName: 'Tanin Maddahi Sync',
        exportTimestamp: Date.now(),
        exportDateFormatted: new Date().toLocaleString('fa-IR'),
        tracksCount: tracks.length,
        tracks: tracks.map((t) =>
          isVolatileUrl(t.audioUrl) ? { ...t, audioUrl: undefined } : t
        ),
        proxyConfig,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tanin_maddahi_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMsg({
        success: true,
        text: `پشتیبان کامل شامل ${tracks.length} اثر و یادداشت‌های مداح با موفقیت دانلود شد.`,
      });
    } catch (err: any) {
      setStatusMsg({
        success: false,
        text: `خطا در ایجاد فایل پشتیبان: ${err.message || 'خطای ناشناخته'}`,
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let importedTracks: MaddahiTrack[] = [];
        if (Array.isArray(parsed)) {
          importedTracks = parsed;
        } else if (parsed && Array.isArray(parsed.tracks)) {
          importedTracks = parsed.tracks;
        }

        if (importedTracks.length === 0) {
          throw new Error('فایل پشتیبان معتبر نیست یا حاوی هیچ قطعه‌ای نمی‌باشد.');
        }

        onRestoreData(importedTracks);
        setStatusMsg({
          success: true,
          text: `بازیابی موفقیت‌آمیز! تعداد ${importedTracks.length} قطعه و یادداشت به کتابخانه اضافه شد.`,
        });
      } catch (err: any) {
        setStatusMsg({
          success: false,
          text: `خطا در خواندن فایل پشتیبان: ${err.message || 'ساختار JSON نامعتبر است'}`,
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none"
    >
      <div
        className={`w-full max-w-lg rounded-2xl border p-5 sm:p-6 shadow-2xl flex flex-col ${
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
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 id="backup-modal-title" className="font-bold text-base sm:text-lg">پشتیبان‌گیری و بازیابی اطلاعات</h2>
              <p className="text-xs text-stone-400">
                خروجی گرفتن از تمام آثار، همگامی‌ها و یادداشت‌های منبر به صورت فایل JSON
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-xl bg-stone-900 text-stone-400 hover:text-stone-100 flex items-center justify-center border border-stone-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-stone-900/90 border border-stone-800 text-xs text-stone-300 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>حفظ امنیت و مالکیت داده‌های هیئت</span>
            </div>
            <p className="leading-relaxed text-stone-400">
              تمامی قطعات، متن‌های زمان‌بندی‌شده LRC و یادداشت‌های شخصی شما در این فایل ذخیره می‌شوند تا بتوانید در هر زمان یا روی دستگاه دیگر آن‌ها را بازیابی کنید.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Export Backup Button */}
            <button
              onClick={handleExportBackup}
              type="button"
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer ${
                isGreen
                  ? 'bg-[#122417] hover:bg-[#183321] border-[#225732] text-emerald-300'
                  : 'bg-[#241212] hover:bg-[#331818] border-[#572222] text-red-300'
              }`}
            >
              <Download className="w-6 h-6" />
              <div>
                <p className="font-bold text-sm">دانلود فایل پشتیبان (JSON)</p>
                <p className="text-[11px] text-stone-400 mt-0.5">({tracks.length} اثر ذخیره‌شده)</p>
              </div>
            </button>

            {/* Import / Restore Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              type="button"
              className="p-4 rounded-xl border bg-stone-900 hover:bg-stone-800 border-stone-800 text-stone-200 flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer"
            >
              <Upload className="w-6 h-6 text-stone-400" />
              <div>
                <p className="font-bold text-sm">بازیابی از فایل پشتیبان</p>
                <p className="text-[11px] text-stone-500 mt-0.5">بارگذاری فایل JSON قبلی</p>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2 ${
                statusMsg.success
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-red-950/60 border-red-800 text-red-300'
              }`}
            >
              {statusMsg.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">{statusMsg.text}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
