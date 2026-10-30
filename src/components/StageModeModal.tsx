/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { MaddahiTrack, LyricLine } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import { formatTime } from '../utils/syncUtils';
import {
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Type,
  Minimize2,
  MoveVertical,
} from 'lucide-react';

interface StageModeModalProps {
  track: MaddahiTrack | null;
  currentTime: number;
  duration: number;
  activeLineIndex: number;
  isPlaying: boolean;
  isOpen: boolean;
  theme?: AppTheme;
  onClose: () => void;
  onTogglePlay: () => void;
  onSeekToLine: (line: LyricLine) => void;
  onNextVerse: () => void;
  onPrevVerse: () => void;
  onToggleLoopLine: (line: LyricLine) => void;
  isLooping: boolean;
}

export const StageModeModal: React.FC<StageModeModalProps> = ({
  track,
  currentTime,
  duration,
  activeLineIndex,
  isPlaying,
  isOpen,
  theme = 'soft-green',
  onClose,
  onTogglePlay,
  onSeekToLine,
  onNextVerse,
  onPrevVerse,
  onToggleLoopLine,
  isLooping,
}) => {
  const [fontSize, setFontSize] = useState<number>(32); // 22 to 56px
  const [lineHeightMultiplier, setLineHeightMultiplier] = useState<number>(2.4); // 1.8, 2.4, 3.0
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const isGreen = theme === 'soft-green';

  useEffect(() => {
    if (!isOpen || activeLineIndex < 0 || !activeLineRef.current || !containerRef.current) {
      return;
    }
    const container = containerRef.current;
    const activeEl = activeLineRef.current;

    const elTop = activeEl.offsetTop;
    const elHeight = activeEl.offsetHeight;
    const containerHeight = container.clientHeight;

    container.scrollTo({
      top: Math.max(0, elTop - containerHeight / 2 + elHeight / 2),
      behavior: 'smooth',
    });
  }, [activeLineIndex, isOpen]);

  if (!isOpen || !track) return null;

  const lines = track.lyricsLines || [];

  return (
    <div
      className={`fixed inset-0 z-50 text-stone-100 flex flex-col select-none overflow-hidden ${
        isGreen ? 'bg-[#060a07]' : 'bg-[#0a0606]'
      }`}
    >
      {/* Top Bar for Stage */}
      <div
        className={`flex items-center justify-between px-3 sm:px-6 py-2.5 border-b gap-2 flex-wrap ${
          isGreen
            ? 'bg-[#0b140e] border-[#1d2f21]'
            : 'bg-[#140b0b] border-[#2f1d1d]'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isGreen ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          />
          <h2
            className={`text-base sm:text-lg font-black truncate max-w-[200px] sm:max-w-md ${
              isGreen ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {track.title}
          </h2>
          <span className="text-xs text-stone-400 font-medium hidden sm:inline">
            ({track.maddah})
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Font scale buttons */}
          <div className="flex items-center bg-stone-900 border border-stone-800 rounded-xl px-2 py-1 gap-1.5 text-xs">
            <Type className="w-3.5 h-3.5 text-stone-400" />
            <button
              onClick={() => setFontSize((s) => Math.max(22, s - 3))}
              className="px-2 py-0.5 rounded font-bold hover:bg-stone-800 cursor-pointer"
              title="کوچک‌تر کردن قلم"
            >
              -
            </button>
            <span className="font-mono text-stone-300 min-w-[28px] text-center">{fontSize}px</span>
            <button
              onClick={() => setFontSize((s) => Math.min(56, s + 3))}
              className="px-2 py-0.5 rounded font-bold hover:bg-stone-800 cursor-pointer"
              title="بزرگ‌تر کردن قلم"
            >
              +
            </button>
          </div>

          {/* Line Spacing / Height */}
          <div className="flex items-center bg-stone-900 border border-stone-800 rounded-xl px-2 py-1 gap-1 text-xs">
            <MoveVertical className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-[11px] text-stone-400 hidden xs:inline">فاصله:</span>
            {[
              { label: 'عادی', val: 1.8 },
              { label: 'خوانا', val: 2.4 },
              { label: 'خیلی باز', val: 3.0 },
            ].map((sp) => (
              <button
                key={sp.val}
                type="button"
                onClick={() => setLineHeightMultiplier(sp.val)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  lineHeightMultiplier === sp.val
                    ? isGreen
                      ? 'bg-emerald-600 text-stone-950'
                      : 'bg-red-600 text-stone-100'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>

          {/* Close stage mode */}
          <button
            onClick={onClose}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-bold border border-stone-800 cursor-pointer"
          >
            <Minimize2 className="w-4 h-4" />
            <span className="hidden sm:inline">خروج از منبر</span>
          </button>
        </div>
      </div>

      {/* Main Big Lyrics Scroll - Flat, High Contrast */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-8 sm:px-12 space-y-4 text-center"
        style={{ fontSize: `${fontSize}px`, lineHeight: lineHeightMultiplier }}
      >
        {lines.map((line, idx) => {
          const isActive = idx === activeLineIndex;
          const isChorus = line.type === 'chorus';

          return (
            <div
              key={line.id}
              ref={isActive ? activeLineRef : null}
              onClick={() => onSeekToLine(line)}
              className={`p-4 sm:p-6 rounded-2xl transition-colors cursor-pointer border ${
                isActive
                  ? isGreen
                    ? 'bg-[#13281a] border-emerald-500 text-emerald-100 font-bold'
                    : 'bg-[#281313] border-red-500 text-red-100 font-bold'
                  : isChorus
                  ? isGreen
                    ? 'bg-[#0f1a12] border-[#1d3021] text-stone-200 font-semibold'
                    : 'bg-[#1a0f0f] border-[#301d1d] text-stone-200 font-semibold'
                  : 'bg-transparent border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <span className="text-xs font-mono text-stone-500">
                  {formatTime(line.startTime)}
                </span>
                {isChorus && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
                    هم‌خوانی / ترجیع‌بند
                  </span>
                )}
              </div>

              <p
                style={{ lineHeight: lineHeightMultiplier }}
                className="tracking-wide"
              >
                {line.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Bottom Thumb Control Deck (Flat, Touch ergonomic >= 48px) */}
      <div
        className={`border-t px-4 sm:px-6 py-3 flex items-center justify-between gap-3 ${
          isGreen
            ? 'bg-[#0b140e] border-[#1d2f21]'
            : 'bg-[#140b0b] border-[#2f1d1d]'
        }`}
      >
        {/* Prev Verse */}
        <button
          onClick={onPrevVerse}
          disabled={activeLineIndex <= 0}
          type="button"
          className="min-h-[48px] flex-1 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-30 text-stone-200 font-bold text-sm sm:text-base flex items-center justify-center gap-1.5 border border-stone-800 transition-colors cursor-pointer"
        >
          <ChevronUp className={`w-5 h-5 ${isGreen ? 'text-emerald-400' : 'text-red-400'}`} />
          <span>بیت قبلی</span>
        </button>

        {/* Play / Pause Big */}
        <button
          onClick={onTogglePlay}
          type="button"
          className={`min-w-[56px] min-h-[56px] rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer font-bold ${
            isGreen
              ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950'
              : 'bg-red-500 hover:bg-red-400 text-stone-100'
          }`}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current mr-0.5" />
          )}
        </button>

        {/* Next Verse */}
        <button
          onClick={onNextVerse}
          disabled={activeLineIndex >= lines.length - 1}
          type="button"
          className="min-h-[48px] flex-1 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-30 text-stone-200 font-bold text-sm sm:text-base flex items-center justify-center gap-1.5 border border-stone-800 transition-colors cursor-pointer"
        >
          <ChevronDown className={`w-5 h-5 ${isGreen ? 'text-emerald-400' : 'text-red-400'}`} />
          <span>بیت بعدی</span>
        </button>
      </div>
    </div>
  );
};
