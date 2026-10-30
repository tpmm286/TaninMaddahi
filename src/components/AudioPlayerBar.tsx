/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MaddahiTrack } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import { formatTime } from '../utils/syncUtils';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Gauge,
  Volume2,
  Maximize2,
  Music,
  Bookmark,
  FileText,
  Sliders,
} from 'lucide-react';

interface AudioPlayerBarProps {
  track: MaddahiTrack | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  pitchShift: number;
  isLooping: boolean;
  vocalBoost: boolean;
  theme?: AppTheme;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onStepTime: (deltaSeconds: number) => void;
  onChangeRate: (rate: number) => void;
  onChangePitch: (semitones: number) => void;
  onToggleLoop: () => void;
  onToggleVocalBoost: () => void;
  onOpenStageMode: () => void;
  onToggleBookmark?: (trackId: string) => void;
  onOpenNotes?: (track: MaddahiTrack) => void;
}

const SPEED_OPTIONS = [0.75, 0.9, 1.0, 1.1, 1.25];
const PITCH_OPTIONS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  track,
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  pitchShift,
  isLooping,
  vocalBoost,
  theme = 'soft-green',
  onTogglePlay,
  onSeek,
  onStepTime,
  onChangeRate,
  onChangePitch,
  onToggleLoop,
  onToggleVocalBoost,
  onOpenStageMode,
  onToggleBookmark,
  onOpenNotes,
}) => {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showPitchMenu, setShowPitchMenu] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);

  const progressBarRef = useRef<HTMLDivElement>(null);
  const isGreen = theme === 'soft-green';

  // Calculate ratio from clientX coordinate
  const getRatioFromEvent = useCallback(
    (clientX: number): number => {
      if (!progressBarRef.current) return 0;
      const rect = progressBarRef.current.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const offset = clientX - rect.left;
      return Math.max(0, Math.min(1, offset / rect.width));
    },
    []
  );

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const ratio = getRatioFromEvent(e.clientX);
    const targetTime = ratio * duration;
    setIsScrubbing(true);
    setScrubTime(targetTime);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moveRatio = getRatioFromEvent(moveEvent.clientX);
      setScrubTime(moveRatio * duration);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      const finalRatio = getRatioFromEvent(upEvent.clientX);
      const finalTime = finalRatio * duration;
      setIsScrubbing(false);
      onSeek(finalTime);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Touch drag handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const ratio = getRatioFromEvent(touch.clientX);
    const targetTime = ratio * duration;
    setIsScrubbing(true);
    setScrubTime(targetTime);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch || !isScrubbing) return;
    const ratio = getRatioFromEvent(touch.clientX);
    setScrubTime(ratio * duration);
  };

  const handleTouchEnd = () => {
    if (isScrubbing) {
      setIsScrubbing(false);
      onSeek(scrubTime);
    }
  };

  if (!track) return null;

  // Active displayed time and percentage
  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;
  const isBookmarked = Boolean(track.isBookmarked);
  const hasPersonalNotes = Boolean(track.personalNotes && track.personalNotes.trim());

  return (
    <div
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      className={`fixed bottom-0 inset-x-0 z-40 px-3 sm:px-6 pt-2 sm:pt-2.5 border-t select-none transition-colors ${
        isGreen
          ? 'bg-[#0a110c] border-[#1e3022]'
          : 'bg-[#110a0a] border-[#301e1e]'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-1.5">
        {/* Progress Bar Container - Explicit LTR to guarantee 100% correct audio scrub orientation */}
        <div
          dir="ltr"
          className="flex items-center gap-2.5 w-full select-none"
        >
          {/* Current Playback Time */}
          <span className="text-[11px] font-mono text-stone-400 w-11 text-left shrink-0 font-medium">
            {formatTime(displayTime)}
          </span>

          {/* Interactive Seek Bar Area with enlarged touch/tap hitbox */}
          <div
            ref={progressBarRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            role="slider"
            aria-label="زمان پخش"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={displayTime}
            className="group relative flex-1 py-2 cursor-pointer touch-none flex items-center"
          >
            {/* Background Track */}
            <div className="w-full h-2 bg-stone-900 border border-stone-800 rounded-full overflow-hidden relative">
              {/* Progress Bar Fill */}
              <div
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-75 ${
                  isGreen ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Slider Thumb Circle */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border border-stone-950 transition-transform ${
                isGreen
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                  : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'
              } ${isScrubbing ? 'scale-125' : 'group-hover:scale-110'}`}
              style={{ left: `${progressPercent}%` }}
            />
          </div>

          {/* Total Duration */}
          <span className="text-[11px] font-mono text-stone-400 w-11 text-right shrink-0 font-medium">
            {formatTime(duration)}
          </span>
        </div>

        {/* Row A: track info + quick actions */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`hidden xs:flex w-9 h-9 rounded-lg border items-center justify-center shrink-0 ${
              isGreen
                ? 'bg-[#142618] border-[#22482e] text-emerald-400'
                : 'bg-[#261414] border-[#482222] text-red-400'
            }`}
          >
            <Music className="w-4 h-4" />
          </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-bold text-stone-100 truncate">
                {track.title}
              </h4>
              <p className="text-[10px] sm:text-[11px] text-stone-400 truncate">
                {track.maddah} {track.rhythm ? `• ${track.rhythm}` : ''}
              </p>
            </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Bookmark button on player */}
            {onToggleBookmark && (
              <button
                onClick={() => onToggleBookmark(track.id)}
                type="button"
                className={`min-w-[32px] min-h-[32px] sm:min-w-[34px] sm:min-h-[34px] rounded-lg border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                  isBookmarked
                    ? isGreen
                      ? 'bg-[#14301d] text-emerald-300 border-emerald-500/80'
                      : 'bg-[#301414] text-red-300 border-red-500/80'
                    : 'bg-stone-900 text-stone-500 hover:text-stone-300 border-stone-800'
                }`}
                title={isBookmarked ? 'حذف از نشانه‌گذاری‌ها' : 'نشانه‌گذاری قطعه'}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            )}

            {/* Quick Notes button on player */}
            {onOpenNotes && (
              <button
                onClick={() => onOpenNotes(track)}
                type="button"
                className={`min-w-[32px] min-h-[32px] sm:min-w-[34px] sm:min-h-[34px] rounded-lg border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                  hasPersonalNotes
                    ? isGreen
                      ? 'bg-[#162e1c] text-emerald-300 border-[#285734]'
                      : 'bg-[#2e1616] text-red-300 border-[#572828]'
                    : 'bg-stone-900 text-stone-500 hover:text-stone-300 border-stone-800'
                }`}
                title={hasPersonalNotes ? 'مشاهده یادداشت منبر' : 'افزودن یادداشت شخصی'}
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Stage / Menbar Mode */}
            <button
              onClick={onOpenStageMode}
              type="button"
              className={`min-h-[34px] sm:min-h-[36px] flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                isGreen
                  ? 'bg-[#14301d] hover:bg-[#1a3d25] text-emerald-300 border-[#225732]'
                  : 'bg-[#301414] hover:bg-[#3d1a1a] text-red-300 border-[#572222]'
              }`}
              title="حالت منبر و اجرای زنده (بزرگ‌نمایی متن)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">منبر</span>
            </button>
          </div>
        </div>

        {/* Row B: transport + speed / pitch */}
        <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-4">
            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                type="button"
                className={`min-h-[34px] sm:min-h-[36px] flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  playbackRate !== 1.0
                    ? isGreen
                      ? 'bg-[#14301d] text-emerald-300 border-emerald-500/60'
                      : 'bg-[#301414] text-red-300 border-red-500/60'
                    : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                }`}
                title="تنظیم سرعت پخش"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{playbackRate}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-stone-950 border border-stone-800 rounded-xl p-1.5 flex flex-col gap-1 z-50 min-w-[110px]">
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => {
                        onChangeRate(rate);
                        setShowSpeedMenu(false);
                      }}
                      className={`px-3 py-1 text-xs rounded-lg font-bold text-right transition-colors cursor-pointer ${
                        playbackRate === rate
                          ? isGreen
                            ? 'bg-emerald-600 text-stone-950'
                            : 'bg-red-600 text-stone-100'
                          : 'text-stone-300 hover:bg-stone-900'
                      }`}
                    >
                      {rate}x {rate === 1.0 ? '(عادی)' : rate < 1.0 ? '(تمرین)' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => onStepTime(-5)}
              type="button"
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-900 border border-transparent hover:border-stone-800 rounded-xl transition-colors cursor-pointer"
              title="۵ ثانیه به عقب"
              aria-label="۵ ثانیه به عقب"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={onTogglePlay}
              type="button"
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-colors cursor-pointer font-bold ${
                isGreen
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950'
                  : 'bg-red-500 hover:bg-red-400 text-stone-100'
              }`}
              aria-label={isPlaying ? 'توقف پخش' : 'پخش'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current mr-0.5" />
              )}
            </button>

            <button
              onClick={() => onStepTime(5)}
              type="button"
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-stone-400 hover:text-stone-100 hover:bg-stone-900 border border-transparent hover:border-stone-800 rounded-xl transition-colors cursor-pointer"
              title="۵ ثانیه به جلو"
              aria-label="۵ ثانیه به جلو"
            >
              <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            {/* Pitch (Key) Selector */}
            <div className="relative">
              <button
                onClick={() => setShowPitchMenu(!showPitchMenu)}
                type="button"
                className={`min-h-[34px] sm:min-h-[36px] flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  pitchShift !== 0
                    ? isGreen
                      ? 'bg-[#14301d] text-emerald-300 border-emerald-500/60'
                      : 'bg-[#301414] text-red-300 border-red-500/60'
                    : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                }`}
                title="تغییر گام و پرده صدا (Pitch / Key)"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{pitchShift === 0 ? 'گام اصلی' : pitchShift > 0 ? `+${pitchShift}` : `${pitchShift}`}</span>
              </button>

              {showPitchMenu && (
                <div className="absolute bottom-full mb-2 left-0 bg-stone-950 border border-stone-800 rounded-xl p-1.5 flex flex-col gap-1 z-50 min-w-[130px]">
                  {PITCH_OPTIONS.map((semis) => (
                    <button
                      key={semis}
                      onClick={() => {
                        onChangePitch(semis);
                        setShowPitchMenu(false);
                      }}
                      className={`px-3 py-1 text-xs rounded-lg font-bold text-right transition-colors cursor-pointer ${
                        pitchShift === semis
                          ? isGreen
                            ? 'bg-emerald-600 text-stone-950'
                            : 'bg-red-600 text-stone-100'
                          : 'text-stone-300 hover:bg-stone-900'
                      }`}
                    >
                      {semis === 0 ? 'گام اصلی (0)' : semis > 0 ? `+${semis} نیم‌پرده` : `${semis} نیم‌پرده`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Vocal Boost (hidden on very small screens, visible on sm+) */}
            <button
              onClick={onToggleVocalBoost}
              type="button"
              className={`hidden sm:flex min-h-[36px] items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                vocalBoost
                  ? isGreen
                    ? 'bg-[#172e1e] text-emerald-300 border-emerald-600/70'
                    : 'bg-[#2e1717] text-red-300 border-red-600/70'
                  : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
              }`}
              title="تقویت وضوح صدای مداح"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>وضوح صدا</span>
            </button>

        </div>
      </div>
    </div>
  );
};
