/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MaddahiTrack } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import {
  Play,
  Pause,
  Sliders,
  Download,
  Trash2,
  Mic,
  Bookmark,
  FileText,
  User,
  FolderOpen,
  Headphones,
} from 'lucide-react';
import { formatTime } from '../utils/syncUtils';

interface TrackCardProps {
  track: MaddahiTrack;
  isActive: boolean;
  isPlaying: boolean;
  theme?: AppTheme;
  onSelect: (track: MaddahiTrack) => void;
  onTogglePlay: (track: MaddahiTrack) => void;
  onToggleBookmark: (trackId: string) => void;
  onOpenNotes: (track: MaddahiTrack) => void;
  onOpenSyncEditor: (track: MaddahiTrack) => void;
  onExportLrc: (track: MaddahiTrack) => void;
  onDelete?: (trackId: string) => void;
  onPickAudio?: (track: MaddahiTrack) => void;
  /** ثانیهٔ آخرین توقف (برای نمایش «ادامه از ...») */
  resumeAt?: number;
}

const CATEGORY_MAP: Record<string, { label: string; color: string; border: string }> = {
  zamineh: { label: 'زمینه', color: 'bg-[#14301d] text-emerald-300', border: 'border-[#225732]' },
  shoor: { label: 'شور', color: 'bg-[#301414] text-red-300', border: 'border-[#572222]' },
  vahed: { label: 'واحد', color: 'bg-[#2b2413] text-amber-300', border: 'border-[#4a3d1e]' },
  rozeh: { label: 'روضه', color: 'bg-[#271329] text-purple-300', border: 'border-[#452248]' },
  doodameh: { label: 'دودمه', color: 'bg-[#13212b] text-blue-300', border: 'border-[#203a4d]' },
  monajat: { label: 'مناجات', color: 'bg-[#132b26] text-teal-300', border: 'border-[#1e4a42]' },
};

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  isActive,
  isPlaying,
  theme = 'soft-green',
  onSelect,
  onTogglePlay,
  onToggleBookmark,
  onOpenNotes,
  onOpenSyncEditor,
  onExportLrc,
  onDelete,
  onPickAudio,
  resumeAt,
}) => {
  const isGreen = theme === 'soft-green';
  const cat = CATEGORY_MAP[track.category] || {
    label: 'نوحه',
    color: 'bg-stone-800 text-stone-300',
    border: 'border-stone-700',
  };

  const isBookmarked = Boolean(track.isBookmarked);
  const hasPersonalNotes = Boolean(track.personalNotes && track.personalNotes.trim());
  const hasAudio = Boolean(track.audioUrl || track.hasLocalAudio);

  return (
    <div
      onClick={() => onSelect(track)}
      className={`group relative rounded-xl p-3.5 sm:p-4 transition-colors cursor-pointer border ${
        isActive
          ? isGreen
            ? 'bg-[#121f15] border-emerald-500'
            : 'bg-[#1f1212] border-red-500'
          : isGreen
          ? 'bg-[#0d140f] hover:bg-[#121c15] border-[#1d2d20]'
          : 'bg-[#140d0d] hover:bg-[#1c1212] border-[#2d1d1d]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cat.color} ${cat.border}`}>
              {cat.label}
            </span>

            {track.isCustom ? (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                  isGreen
                    ? 'bg-[#14301d] text-emerald-300 border-[#225732]'
                    : 'bg-[#301414] text-red-300 border-[#572222]'
                }`}
              >
                <Mic className="w-3 h-3" />
                اثر من
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-stone-900 text-stone-300 border border-stone-800 flex items-center gap-1">
                <User className="w-3 h-3 text-stone-400" />
                سایر مداحان
              </span>
            )}

            {track.maqam && (
              <span className="text-[10px] text-stone-400 bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded">
                {track.maqam}
              </span>
            )}

            {hasPersonalNotes && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNotes(track);
                }}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 cursor-pointer transition-colors ${
                  isGreen
                    ? 'bg-[#172b1d] text-emerald-300 border-[#234d2f] hover:bg-[#1f3a27]'
                    : 'bg-[#2b1717] text-red-300 border-[#4d2323] hover:bg-[#3a1f1f]'
                }`}
                title="مشاهده یا ویرایش یادداشت منبر"
              >
                <FileText className="w-3 h-3" />
                یادداشت مداح
              </span>
            )}
          </div>

          <h3
            className={`font-bold text-base leading-snug truncate transition-colors ${
              isActive
                ? isGreen
                  ? 'text-emerald-300'
                  : 'text-red-300'
                : 'text-stone-100'
            }`}
          >
            {track.title}
          </h3>

          <p className="text-xs text-stone-400 mt-1 flex items-center gap-1 font-medium">
            <span className="text-stone-300">{track.maddah}</span>
            {track.occasion && (
              <>
                <span className="text-stone-600">•</span>
                <span className="text-stone-400 truncate">{track.occasion}</span>
              </>
            )}
          </p>

          <div className="flex items-center gap-3 text-[11px] text-stone-400 mt-2.5 pt-2 border-t border-stone-800/80">
            <span>مدت: {formatTime(track.duration)}</span>
            <span>•</span>
            <span>{track.lyricsLines?.length || 0} بیت/مصراع</span>
            {track.rhythm && (
              <>
                <span>•</span>
                <span className="text-stone-400 truncate">{track.rhythm}</span>
              </>
            )}
            {resumeAt !== undefined && resumeAt > 0 && (
              <>
                <span>•</span>
                <span className={isGreen ? 'text-emerald-300' : 'text-red-300'}>
                  ادامه از {formatTime(resumeAt)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right side controls: Bookmark + Play button (Min 44px for touchscreens) */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(track.id);
            }}
            type="button"
            aria-label={isBookmarked ? 'حذف از نشانه‌گذاری‌ها' : 'نشانه‌گذاری اثر'}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
              isBookmarked
                ? isGreen
                  ? 'bg-[#14301d] text-emerald-300 border-emerald-500/80'
                  : 'bg-[#301414] text-red-300 border-red-500/80'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-500 hover:text-stone-300 border-stone-800'
            }`}
            title={isBookmarked ? 'حذف از نشانه‌گذاری‌ها' : 'نشانه‌گذاری و افزودن به برگزیده‌ها'}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay(track);
            }}
            type="button"
            aria-label={isActive && isPlaying ? 'توقف پخش' : 'پخش اثر'}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              isActive && isPlaying
                ? isGreen
                  ? 'bg-emerald-500 text-stone-950 font-bold'
                  : 'bg-red-500 text-stone-100 font-bold'
                : isGreen
                ? 'bg-stone-800 hover:bg-emerald-600 text-stone-200 hover:text-stone-950 border border-stone-700'
                : 'bg-stone-800 hover:bg-red-600 text-stone-200 hover:text-stone-100 border border-stone-700'
            }`}
          >
            {isActive && isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current mr-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Bottom actions row */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-stone-800/60">
        <div className="flex items-center gap-1 flex-wrap">
          {onPickAudio && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPickAudio(track);
              }}
              type="button"
              className={`min-h-[32px] flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                hasAudio
                  ? isGreen
                    ? 'text-emerald-300 bg-[#142618]'
                    : 'text-red-300 bg-[#261414]'
                  : 'text-stone-300 hover:text-stone-100 hover:bg-stone-800'
              }`}
              title={
                hasAudio
                  ? track.audioFileName
                    ? `صوت فعلی: ${track.audioFileName} (برای تغییر لمس کنید)`
                    : 'تغییر فایل صوتی این اثر'
                  : 'انتخاب فایل صوتی از گوشی برای این اثر'
              }
            >
              {hasAudio ? <Headphones className="w-3.5 h-3.5" /> : <FolderOpen className="w-3.5 h-3.5" />}
              <span>{hasAudio ? 'تغییر صوت' : 'انتخاب صوت'}</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenNotes(track);
            }}
            type="button"
            className={`min-h-[32px] flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              hasPersonalNotes
                ? isGreen
                  ? 'text-emerald-300 bg-[#142618]'
                  : 'text-red-300 bg-[#261414]'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
            }`}
            title="مشاهده یا افزودن یادداشت و نکات اجرا"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{hasPersonalNotes ? 'یادداشت' : '+ یادداشت'}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSyncEditor(track);
            }}
            type="button"
            className="min-h-[32px] flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-stone-300 hover:text-stone-100 hover:bg-stone-800 transition-colors"
            title="ویرایش زمان‌بندی و هماهنگی بندها"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>همگامی</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onExportLrc(track);
            }}
            type="button"
            className="min-h-[32px] flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
            title="دانلود فایل متن هماهنگ LRC"
          >
            <Download className="w-3.5 h-3.5" />
            <span>LRC</span>
          </button>
        </div>

        {onDelete && (track.isCustom || track.isOtherMaddah) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(track.id);
            }}
            type="button"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800 transition-colors"
            title="حذف این قطعه از کتابخانه"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
