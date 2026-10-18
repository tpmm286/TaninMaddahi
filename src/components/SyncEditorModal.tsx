/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MaddahiTrack, LyricLine } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import { formatTime, toLrc } from '../utils/syncUtils';
import {
  X,
  Plus,
  Trash2,
  Clock,
  Download,
  Save,
  Play,
} from 'lucide-react';

interface SyncEditorModalProps {
  track: MaddahiTrack | null;
  currentPlaybackTime: number;
  isOpen: boolean;
  theme?: AppTheme;
  onClose: () => void;
  onSaveTrack: (updatedTrack: MaddahiTrack) => void;
  onSeekTo: (seconds: number) => void;
}

export const SyncEditorModal: React.FC<SyncEditorModalProps> = ({
  track,
  currentPlaybackTime,
  isOpen,
  theme = 'soft-green',
  onClose,
  onSaveTrack,
  onSeekTo,
}) => {
  if (!isOpen || !track) return null;

  const [lines, setLines] = useState<LyricLine[]>(track.lyricsLines || []);
  const [title, setTitle] = useState(track.title);
  const [maddah, setMaddah] = useState(track.maddah);
  const isGreen = theme === 'soft-green';

  const handleUpdateLine = (id: string, field: keyof LyricLine, value: any) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const handleNudgeTime = (id: string, delta: number) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id === id) {
          const newStart = Math.max(0, Math.round((line.startTime + delta) * 10) / 10);
          const newEnd = Math.max(newStart + 1, Math.round((line.endTime + delta) * 10) / 10);
          return { ...line, startTime: newStart, endTime: newEnd };
        }
        return line;
      })
    );
  };

  const handleSetCurrentTime = (id: string) => {
    const cur = Math.round(currentPlaybackTime * 10) / 10;
    setLines((prev) =>
      prev.map((line) => {
        if (line.id === id) {
          return { ...line, startTime: cur, endTime: cur + 4 };
        }
        return line;
      })
    );
  };

  const handleAddLine = () => {
    const lastLine = lines[lines.length - 1];
    const newStart = lastLine ? lastLine.endTime : 0;
    const newLine: LyricLine = {
      id: `line-${Date.now()}`,
      startTime: newStart,
      endTime: newStart + 4,
      text: 'بیت جدید...',
      stanzaIndex: lastLine ? lastLine.stanzaIndex || 1 : 1,
      type: 'verse',
    };
    setLines([...lines, newLine]);
  };

  const handleDeleteLine = (id: string) => {
    setLines(lines.filter((l) => l.id !== id));
  };

  const handleSave = () => {
    const sorted = [...lines].sort((a, b) => a.startTime - b.startTime);
    const updated: MaddahiTrack = {
      ...track,
      title,
      maddah,
      lyricsLines: sorted,
    };
    onSaveTrack(updated);
    onClose();
  };

  const handleExportLrc = () => {
    const lrcContent = toLrc(lines, title, maddah);
    const blob = new Blob([lrcContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'maddahi'}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 select-none">
      <div
        className={`relative w-full max-w-3xl rounded-2xl border p-4 sm:p-6 text-stone-100 max-h-[92vh] flex flex-col ${
          isGreen
            ? 'bg-[#101813] border-[#223828]'
            : 'bg-[#181010] border-[#382222]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 shrink-0">
          <div>
            <h3
              className={`text-base sm:text-lg font-bold ${
                isGreen ? 'text-emerald-200' : 'text-red-200'
              }`}
            >
              ویرایشگر زمان‌بندی و هماهنگی متن و صوت
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              زمان ثانیه فعلی پخش:{' '}
              <span
                className={`font-mono font-bold ${
                  isGreen ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatTime(currentPlaybackTime, true)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportLrc}
              type="button"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 text-xs font-semibold border border-stone-800 cursor-pointer"
              title="خروجی فایل LRC استاندارد"
            >
              <Download className="w-3.5 h-3.5" />
              <span>خروجی LRC</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-xl hover:bg-stone-800 text-stone-400 hover:text-stone-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List of lines */}
        <div className="flex-1 overflow-y-auto py-3.5 space-y-2.5">
          {lines.map((line, idx) => (
            <div
              key={line.id}
              className="p-2.5 sm:p-3 rounded-xl bg-stone-950 border border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-mono text-stone-500 w-6 shrink-0 text-center">
                  #{idx + 1}
                </span>

                <input
                  type="text"
                  value={line.text}
                  onChange={(e) => handleUpdateLine(line.id, 'text', e.target.value)}
                  className={`flex-1 px-2.5 py-1.5 bg-stone-900 border text-xs sm:text-sm text-stone-100 rounded-lg focus:outline-none ${
                    isGreen
                      ? 'border-stone-800 focus:border-emerald-500'
                      : 'border-stone-800 focus:border-red-500'
                  }`}
                />
              </div>

              {/* Time and actions */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  onClick={() => onSeekTo(line.startTime)}
                  type="button"
                  className="p-1.5 rounded-lg bg-stone-900 hover:bg-stone-850 text-stone-300 border border-stone-800 text-xs flex items-center gap-1 cursor-pointer"
                  title="پخش از این ثانیه"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs gap-1">
                  <Clock className="w-3 h-3 text-stone-500" />
                  <span className="font-mono text-stone-200">
                    {formatTime(line.startTime, true)}
                  </span>
                  <div className="flex gap-0.5 ml-1">
                    <button
                      onClick={() => handleNudgeTime(line.id, -0.5)}
                      className="px-1 hover:text-white rounded font-bold cursor-pointer"
                      title="-0.5s"
                    >
                      -
                    </button>
                    <button
                      onClick={() => handleNudgeTime(line.id, 0.5)}
                      className="px-1 hover:text-white rounded font-bold cursor-pointer"
                      title="+0.5s"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => handleSetCurrentTime(line.id)}
                  type="button"
                  className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    isGreen
                      ? 'bg-[#14301d] text-emerald-300 border-[#225732]'
                      : 'bg-[#301414] text-red-300 border-[#572222]'
                  }`}
                  title="تنظیم شروع به ثانیه فعلی صوت"
                >
                  زمان زنده
                </button>

                <button
                  onClick={() => handleDeleteLine(line.id)}
                  type="button"
                  className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-900 transition-colors cursor-pointer"
                  title="حذف بیت"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={handleAddLine}
            type="button"
            className={`w-full py-2.5 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              isGreen
                ? 'border-[#225732] text-emerald-300 hover:bg-[#14301d]/50'
                : 'border-[#572222] text-red-300 hover:bg-[#301414]/50'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>افزودن بند یا بیت جدید</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-800 shrink-0">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 rounded-xl text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer"
          >
            انصراف
          </button>

          <button
            onClick={handleSave}
            type="button"
            className={`min-h-[40px] px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isGreen
                ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950'
                : 'bg-red-600 hover:bg-red-500 text-stone-100'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>ذخیره تغییرات</span>
          </button>
        </div>
      </div>
    </div>
  );
};
