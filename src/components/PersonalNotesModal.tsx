/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MaddahiTrack } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import {
  FileText,
  X,
  Check,
  Trash2,
  Sparkles,
  Clock,
} from 'lucide-react';

interface PersonalNotesModalProps {
  isOpen: boolean;
  track: MaddahiTrack | null;
  theme?: AppTheme;
  onClose: () => void;
  onSaveNotes: (trackId: string, notes: string) => void;
}

const NOTE_TEMPLATES = [
  'نکته اجرا: در بند دوم اوج گرفته شود و صدا رها گردد.',
  'شروع با طمأنینه و اشک در مقام دشتی.',
  'مناسب برای شب عاشورا قبل از روضه خیمه‌گاه.',
  'هم‌خوانی و پاسخ دسته‌جمعی اهل هیئت در ترجیع‌بند.',
  'سینه سنگین و هماهنگ، ضرب‌آهنگ متوقف نشود.',
  'اشاره به مقتل لهوف و فرازهای زیارت ناحیه مقدسه.',
];

export const PersonalNotesModal: React.FC<PersonalNotesModalProps> = ({
  isOpen,
  track,
  theme = 'soft-green',
  onClose,
  onSaveNotes,
}) => {
  const [notes, setNotes] = useState<string>('');
  const isGreen = theme === 'soft-green';

  useEffect(() => {
    if (track) {
      setNotes(track.personalNotes || '');
    }
  }, [track, isOpen]);

  if (!isOpen || !track) return null;

  const handleSave = () => {
    onSaveNotes(track.id, notes.trim());
    onClose();
  };

  const handleClear = () => {
    setNotes('');
  };

  const handleAddTemplate = (tpl: string) => {
    setNotes((prev) => (prev ? `${prev.trim()}\n• ${tpl}` : `• ${tpl}`));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 select-none">
      <div
        className={`relative w-full max-w-xl rounded-2xl border p-4 sm:p-6 text-stone-100 flex flex-col max-h-[90vh] overflow-y-auto ${
          isGreen
            ? 'bg-[#101813] border-[#223828]'
            : 'bg-[#181010] border-[#382222]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isGreen
                  ? 'bg-[#183321] text-emerald-300'
                  : 'bg-[#331818] text-red-300'
              }`}
            >
              <FileText className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3
                className={`text-base sm:text-lg font-bold ${
                  isGreen ? 'text-emerald-200' : 'text-red-200'
                }`}
              >
                یادداشت شخصی و نکات اجرا
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-400">
                ثبت تفسیر، نکات فنی، ریتم و خاطرات برای «{track.title}»
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Track brief banner */}
        <div className="mt-3 p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-stone-200">{track.title}</p>
            <p className="text-[11px] text-stone-400 mt-0.5">
              مداح: {track.maddah} {track.occasion && `• ${track.occasion}`}
            </p>
          </div>
          {track.personalNotesUpdatedAt && (
            <div className="text-[10px] text-stone-500 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-stone-500" />
              <span>آخرین ویرایش: {new Date(track.personalNotesUpdatedAt).toLocaleDateString('fa-IR')}</span>
            </div>
          )}
        </div>

        {/* Text Area */}
        <div className="py-3.5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1.5">
              متن یادداشت مداح:
            </label>
            <textarea
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="نکات منبر، نحوه اوج‌گیری صدا، زمان تغییر سبک، تفاسیر مقتلی، یا تذکرات اجرایی را در اینجا بنویسید..."
              className={`w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border text-xs sm:text-sm text-stone-100 placeholder-stone-600 leading-relaxed resize-none focus:outline-none ${
                isGreen
                  ? 'border-stone-800 focus:border-emerald-500'
                  : 'border-stone-800 focus:border-red-500'
              }`}
              autoFocus
            />
          </div>

          {/* Quick Template Chips */}
          <div>
            <p className="text-[11px] font-semibold text-stone-400 mb-1.5 flex items-center gap-1">
              <Sparkles className={`w-3 h-3 ${isGreen ? 'text-emerald-400' : 'text-red-400'}`} />
              <span>پیشنهادات و نکات پرکاربرد منبر:</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NOTE_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAddTemplate(tpl)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border text-right transition-colors cursor-pointer ${
                    isGreen
                      ? 'bg-stone-950 hover:bg-[#122317] text-stone-300 hover:text-emerald-200 border-stone-800 hover:border-emerald-700'
                      : 'bg-stone-950 hover:bg-[#231212] text-stone-300 hover:text-red-200 border-stone-800 hover:border-red-700'
                  }`}
                >
                  + {tpl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-800 shrink-0">
          {notes ? (
            <button
              onClick={handleClear}
              type="button"
              className="px-3 py-1.5 rounded-lg text-stone-500 hover:text-red-400 text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>پاک‌کردن</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="px-3 py-2 rounded-xl text-stone-400 hover:text-stone-200 text-xs font-semibold cursor-pointer"
            >
              انصراف
            </button>
            <button
              onClick={handleSave}
              type="button"
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isGreen
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950'
                  : 'bg-red-600 hover:bg-red-500 text-stone-100'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>ذخیره یادداشت</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
