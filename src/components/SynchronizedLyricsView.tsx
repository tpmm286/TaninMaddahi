/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { MaddahiTrack, LyricLine } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import { formatTime } from '../utils/syncUtils';
import {
  Repeat,
  Type,
  Maximize2,
  Sliders,
  Eye,
  Bookmark,
  FileText,
  ChevronDown,
  ChevronUp,
  MoveVertical,
  FolderOpen,
  Headphones,
} from 'lucide-react';

interface SynchronizedLyricsViewProps {
  track: MaddahiTrack;
  currentTime: number;
  activeLineIndex: number;
  isPlaying: boolean;
  loopRange: { start: number; end: number } | null;
  theme?: AppTheme;
  onSeekToLine: (line: LyricLine) => void;
  onToggleLoopLine: (line: LyricLine) => void;
  onToggleBookmark: (trackId: string) => void;
  onOpenNotes: (track: MaddahiTrack) => void;
  onOpenSyncEditor: () => void;
  onOpenStageMode: () => void;
  onPickAudio?: () => void;
}

export const SynchronizedLyricsView: React.FC<SynchronizedLyricsViewProps> = ({
  track,
  currentTime,
  activeLineIndex,
  isPlaying,
  loopRange,
  theme = 'soft-green',
  onSeekToLine,
  onToggleLoopLine,
  onToggleBookmark,
  onOpenNotes,
  onOpenSyncEditor,
  onOpenStageMode,
  onPickAudio,
}) => {
  const [fontSize, setFontSize] = useState<number>(22);
  const [lineHeightMultiplier, setLineHeightMultiplier] = useState<number>(2.0); // 1.6, 2.0, 2.4, 2.8
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [showNotesBanner, setShowNotesBanner] = useState<boolean>(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const isGreen = theme === 'soft-green';

  useEffect(() => {
    if (!autoScroll || activeLineIndex < 0 || !activeLineRef.current || !scrollContainerRef.current) {
      return;
    }
    const container = scrollContainerRef.current;
    const activeEl = activeLineRef.current;

    const elTop = activeEl.offsetTop;
    const elHeight = activeEl.offsetHeight;
    const containerHeight = container.clientHeight;

    const targetScroll = elTop - containerHeight / 2 + elHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth',
    });
  }, [activeLineIndex, autoScroll]);

  const lines = track.lyricsLines || [];
  const isBookmarked = Boolean(track.isBookmarked);
  const hasPersonalNotes = Boolean(track.personalNotes && track.personalNotes.trim());
  const hasAudio = Boolean(track.audioUrl || track.hasLocalAudio);

  return (
    <div
      className={`flex flex-col h-full rounded-2xl border overflow-hidden ${
        isGreen
          ? 'bg-[#0c140e] border-[#1d2f21]'
          : 'bg-[#140c0c] border-[#2f1d1d]'
      }`}
    >
      {/* Top Bar with Title & Reading Tools */}
      <div
        className={`px-3.5 py-2.5 sm:px-5 border-b flex flex-wrap items-center justify-between gap-2.5 ${
          isGreen
            ? 'bg-[#101b13] border-[#1e3323]'
            : 'bg-[#1b1010] border-[#331e1e]'
        }`}
      >
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className={`text-base sm:text-lg font-bold ${
                isGreen ? 'text-emerald-200' : 'text-red-200'
              }`}
            >
              {track.title}
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded border font-medium ${
                isGreen
                  ? 'bg-[#14301d] text-emerald-300 border-[#225732]'
                  : 'bg-[#301414] text-red-300 border-[#572222]'
              }`}
            >
              {track.maddah}
            </span>
            {track.occasion && (
              <span className="text-[11px] text-stone-400 hidden sm:inline">
                • {track.occasion}
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {lines.length} بند و مصراع همگام با صوت • روی هر بیت کلیک کنید تا صوت به آن ثانیه منتقل شود
          </p>
        </div>

        {/* View Controls & Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Bookmark Button */}
          <button
            onClick={() => onToggleBookmark(track.id)}
            type="button"
            className={`min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              isBookmarked
                ? isGreen
                  ? 'bg-[#14301d] text-emerald-300 border-emerald-500/80'
                  : 'bg-[#301414] text-red-300 border-red-500/80'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-400 border-stone-800'
            }`}
            title={isBookmarked ? 'نشانه‌گذاری شده (کلیک برای حذف)' : 'نشانه‌گذاری اثر'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            <span>{isBookmarked ? 'نشانه‌شده' : 'نشانه‌گذاری'}</span>
          </button>

          {/* انتخاب صوت از گوشی */}
          {onPickAudio && (
            <button
              onClick={onPickAudio}
              type="button"
              className={`min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                hasAudio
                  ? isGreen
                    ? 'bg-[#14301d] text-emerald-300 border-[#225732]'
                    : 'bg-[#301414] text-red-300 border-[#572222]'
                  : 'bg-stone-900 hover:bg-stone-800 text-stone-300 border-stone-800'
              }`}
              title={
                hasAudio
                  ? track.audioFileName
                    ? `صوت فعلی: ${track.audioFileName}`
                    : 'تغییر فایل صوتی این اثر'
                  : 'انتخاب فایل صوتی از گوشی'
              }
            >
              {hasAudio ? <Headphones className="w-3.5 h-3.5" /> : <FolderOpen className="w-3.5 h-3.5" />}
              <span>{hasAudio ? 'تغییر صوت' : 'انتخاب صوت'}</span>
            </button>
          )}

          {/* Personal Notes Button */}
          <button
            onClick={() => onOpenNotes(track)}
            type="button"
            className={`min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              hasPersonalNotes
                ? isGreen
                  ? 'bg-[#172b1d] text-emerald-300 border-[#285734]'
                  : 'bg-[#2b1717] text-red-300 border-[#572828]'
                : 'bg-stone-900 hover:bg-stone-800 text-stone-400 border-stone-800'
            }`}
            title="مشاهده یا ویرایش یادداشت منبر"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>یادداشت منبر</span>
            {hasPersonalNotes && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isGreen ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
            )}
          </button>

          {/* Font Size Adjuster */}
          <div className="min-h-[36px] flex items-center bg-stone-900 border border-stone-800 rounded-xl px-2 py-1 text-xs gap-1.5 text-stone-300">
            <Type className="w-3.5 h-3.5 text-stone-400" />
            <button
              onClick={() => setFontSize((s) => Math.max(16, s - 2))}
              className="px-1.5 py-0.5 hover:text-white rounded hover:bg-stone-800 font-bold cursor-pointer"
              title="کوچک‌تر کردن قلم"
            >
              -
            </button>
            <span className="text-[11px] font-mono text-stone-300 px-0.5">{fontSize}px</span>
            <button
              onClick={() => setFontSize((s) => Math.min(46, s + 2))}
              className="px-1.5 py-0.5 hover:text-white rounded hover:bg-stone-800 font-bold cursor-pointer"
              title="بزرگ‌تر کردن قلم"
            >
              +
            </button>
          </div>

          {/* Line Height / Spacing Control */}
          <div className="min-h-[36px] flex items-center bg-stone-900 border border-stone-800 rounded-xl px-2 py-1 text-xs gap-1.5 text-stone-300">
            <MoveVertical className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-[11px] text-stone-400 hidden xs:inline">فاصله:</span>
            <div className="flex items-center gap-0.5">
              {[
                { label: 'عادی', val: 1.6 },
                { label: 'باز', val: 2.1 },
                { label: 'دورخوان', val: 2.7 },
              ].map((spacing) => (
                <button
                  key={spacing.val}
                  type="button"
                  onClick={() => setLineHeightMultiplier(spacing.val)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                    lineHeightMultiplier === spacing.val
                      ? isGreen
                        ? 'bg-emerald-600 text-stone-950'
                        : 'bg-red-600 text-stone-100'
                      : 'hover:bg-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                  title={`تنظیم فاصله خطوط به ${spacing.label}`}
                >
                  {spacing.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            type="button"
            className={`min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors ${
              autoScroll
                ? isGreen
                  ? 'bg-[#14301d] text-emerald-300 border-[#225732]'
                  : 'bg-[#301414] text-red-300 border-[#572222]'
                : 'bg-stone-900 text-stone-400 border-stone-800'
            }`}
            title="حرکت خودکار همگام با صوت"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>اسکرول</span>
          </button>

          {/* Sync Editor Trigger */}
          <button
            onClick={onOpenSyncEditor}
            type="button"
            className="min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 transition-colors cursor-pointer"
            title="ویرایش زمان‌بندی بیت‌ها"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">همگامی</span>
          </button>

          {/* Stage / Menbar Mode */}
          <button
            onClick={onOpenStageMode}
            type="button"
            className={`min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isGreen
                ? 'bg-[#193321] hover:bg-[#20402a] text-emerald-300 border-[#285734]'
                : 'bg-[#331919] hover:bg-[#402020] text-red-300 border-[#572828]'
            }`}
            title="حالت استیج منبر (متن درشت تمام‌صفحه)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>منبر</span>
          </button>
        </div>
      </div>

      {/* In-view Personal Notes Banner (Collapsible) */}
      {hasPersonalNotes && (
        <div
          className={`px-3.5 py-2 sm:px-5 border-b text-xs ${
            isGreen
              ? 'bg-[#101b13] border-[#1e3323]'
              : 'bg-[#1b1010] border-[#331e1e]'
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowNotesBanner(!showNotesBanner)}
              type="button"
              className={`flex items-center gap-2 font-bold transition-colors cursor-pointer ${
                isGreen ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>نکات و یادداشت مداح برای اجرای این نوحه:</span>
              {showNotesBanner ? (
                <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              )}
            </button>

            <button
              onClick={() => onOpenNotes(track)}
              type="button"
              className={`text-[11px] font-semibold hover:underline cursor-pointer ${
                isGreen ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              ویرایش یادداشت
            </button>
          </div>

          {showNotesBanner && (
            <p
              className={`mt-1 text-stone-300 text-xs leading-relaxed whitespace-pre-line pl-3 pr-1 border-r-2 mr-1 ${
                isGreen ? 'border-emerald-500' : 'border-red-500'
              }`}
            >
              {track.personalNotes}
            </p>
          )}
        </div>
      )}

      {/* Synchronized Lyrics Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3.5 py-6 sm:px-6 space-y-3"
        style={{ fontSize: `${fontSize}px`, lineHeight: lineHeightMultiplier }}
      >
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-stone-400">
            <p className="text-base font-semibold">متن شعری برای این اثر ثبت نشده است.</p>
            <p className="text-xs text-stone-500 mt-1">
              از بخش «همگامی» یا «استخراج صوت» برای افزودن متن استفاده کنید.
            </p>
          </div>
        ) : (
          lines.map((line, idx) => {
            const isActive = idx === activeLineIndex;
            const isLooping =
              loopRange &&
              Math.abs(loopRange.start - line.startTime) < 0.1 &&
              Math.abs(loopRange.end - line.endTime) < 0.1;
            const isChorus = line.type === 'chorus';
            const isMention = line.type === 'mention';

            return (
              <div
                key={line.id}
                ref={isActive ? activeLineRef : null}
                onClick={() => onSeekToLine(line)}
                className={`group relative rounded-xl p-3 sm:p-4 transition-colors cursor-pointer border ${
                  isActive
                    ? isGreen
                      ? 'bg-[#152719] border-emerald-500 text-emerald-100'
                      : 'bg-[#271515] border-red-500 text-red-100'
                    : isChorus
                    ? isGreen
                      ? 'bg-[#0f1912] hover:bg-[#142218] border-[#1d2f21] text-stone-200'
                      : 'bg-[#190f0f] hover:bg-[#221414] border-[#2f1d1d] text-stone-200'
                    : 'bg-transparent hover:bg-stone-900/60 border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {isChorus && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800/80">
                          ترجیع‌بند / دم
                        </span>
                      )}
                      {isMention && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800/80">
                          ذکر / هم‌خوانی
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-stone-500">
                        {formatTime(line.startTime, true)}
                      </span>
                    </div>

                    <p
                      style={{ lineHeight: lineHeightMultiplier }}
                      className={`tracking-normal font-semibold ${
                        isActive
                          ? isGreen
                            ? 'text-emerald-200 font-bold'
                            : 'text-red-200 font-bold'
                          : isChorus
                          ? 'text-stone-100 font-bold'
                          : 'text-stone-300'
                      }`}
                    >
                      {line.text}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLoopLine(line);
                      }}
                      type="button"
                      className={`min-h-[32px] flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        isLooping
                          ? isGreen
                            ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-bold'
                            : 'bg-red-500 text-stone-100 border-red-400 font-bold'
                          : 'bg-stone-900 hover:bg-stone-800 text-stone-300 border-stone-800'
                      }`}
                      title={isLooping ? 'لغو تکرار این بند' : 'تکرار مداوم این بند'}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span className="text-[11px] hidden sm:inline">
                        {isLooping ? 'در حال تکرار' : 'تکرار بند'}
                      </span>
                    </button>
                  </div>
                </div>

                {isActive && isPlaying && (
                  <div
                    className={`absolute bottom-0 right-3 left-3 h-0.5 ${
                      isGreen ? 'bg-emerald-400' : 'bg-red-400'
                    }`}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {loopRange && (
        <div
          className={`px-4 py-2 border-t flex items-center justify-between text-xs ${
            isGreen
              ? 'bg-[#13281a] border-emerald-700/60 text-emerald-200'
              : 'bg-[#281313] border-red-700/60 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4" />
            <span>
              حالت تکرار فعال است ({formatTime(loopRange.start)} تا {formatTime(loopRange.end)})
            </span>
          </div>
          <button
            onClick={() => onToggleLoopLine({ id: '', startTime: 0, endTime: 0, text: '' })}
            className="px-2 py-1 rounded bg-stone-900 hover:bg-stone-800 text-[11px] font-bold text-stone-200 border border-stone-700"
          >
            لغو تکرار
          </button>
        </div>
      )}
    </div>
  );
};
