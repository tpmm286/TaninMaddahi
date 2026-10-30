/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Radio,
  BookOpen,
  Plus,
  Server,
  UserPlus,
  Palette,
  Cloud,
  Database,
} from 'lucide-react';
import { AppTheme } from '../types/theme';

interface HeaderProps {
  theme: AppTheme;
  onToggleTheme: () => void;
  onOpenUpload: () => void;
  onOpenAddOtherMaddah: () => void;
  onOpenStageMode: () => void;
  onOpenProxySettings: () => void;
  onOpenGoogleDrive: () => void;
  onOpenBackup: () => void;
  isProxyActive?: boolean;
  activeTrackTitle?: string;
  totalTracks: number;
  customTracksCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  onOpenUpload,
  onOpenAddOtherMaddah,
  onOpenStageMode,
  onOpenProxySettings,
  onOpenGoogleDrive,
  onOpenBackup,
  isProxyActive = false,
  activeTrackTitle,
  totalTracks,
  customTracksCount,
}) => {
  const isGreen = theme === 'soft-green';

  return (
    <header
      className={`sticky top-0 z-40 px-3 sm:px-6 py-2.5 sm:py-3 border-b transition-colors ${
        isGreen
          ? 'bg-[#0b120d] border-[#1e3022]'
          : 'bg-[#120b0b] border-[#301e1e]'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand & Emblem */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div
            className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl border shrink-0 ${
              isGreen
                ? 'bg-[#132217] border-[#22482e] text-emerald-400'
                : 'bg-[#221313] border-[#482222] text-red-400'
            }`}
          >
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-xl text-stone-100 tracking-tight flex items-center gap-1.5">
                طَنین مَداحی
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-stone-400 font-normal hidden md:block">
              سامانه اشعار، همگام‌سازی زنده صوت با متن و گنجینه نوای مداحان
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Main Action - Upload */}
          <button
            onClick={onOpenUpload}
            type="button"
            className={`min-h-[40px] flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
              isGreen
                ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950'
                : 'bg-red-600 hover:bg-red-500 text-stone-100'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">استخراج صوت</span>
          </button>

          {/* Group: Data & Sync */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenGoogleDrive}
              type="button"
              className="p-2 rounded-xl text-stone-400 hover:text-emerald-400 hover:bg-stone-900 border border-transparent hover:border-stone-800 transition-colors"
              title="گوگل درایو"
            >
              <Cloud className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenBackup}
              type="button"
              className="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-900 border border-transparent hover:border-stone-800 transition-colors"
              title="پشتیبان‌گیری"
            >
              <Database className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenProxySettings}
              type="button"
              className="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-900 border border-transparent hover:border-stone-800 transition-colors"
              title="تنظیمات سرور"
            >
              <Server className="w-5 h-5" />
            </button>
          </div>

          {/* Group: Views & Settings */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenStageMode}
              type="button"
              className="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-900 border border-transparent hover:border-stone-800 transition-colors"
              title="حالت منبر"
            >
              <BookOpen className="w-5 h-5" />
            </button>
            <button
              onClick={onToggleTheme}
              type="button"
              className="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-900 border border-transparent hover:border-stone-800 transition-colors"
              title="تغییر تم"
            >
              <Palette className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
