/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MaddahiTrack, LyricLine } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import { estimateTimestampsFromText } from '../utils/syncUtils';
import {
  X,
  BookOpen,
  User,
  Music,
  Check,
  Tag,
  FileText,
  AlertCircle,
  Upload,
} from 'lucide-react';

interface AddOtherMaddahPoemModalProps {
  isOpen: boolean;
  theme?: AppTheme;
  onClose: () => void;
  onTrackCreated: (newTrack: MaddahiTrack) => void;
}

const POPULAR_MADDAHS = [
  'حاج محمود کریمی',
  'سید مجید بنی‌فاطمه',
  'حاج میثم مطیعی',
  'محمدحسین پویانفر',
  'حسین طاهری',
  'جواد مقدم',
  'حاج مهدی رسولی',
  'حاج منصور ارضی',
  'حاج محمدرضا طاهری',
  'حاج حیدر خمسه',
];

export const AddOtherMaddahPoemModal: React.FC<AddOtherMaddahPoemModalProps> = ({
  isOpen,
  theme = 'soft-green',
  onClose,
  onTrackCreated,
}) => {
  const [title, setTitle] = useState('');
  const [maddah, setMaddah] = useState(POPULAR_MADDAHS[0]);
  const [customMaddah, setCustomMaddah] = useState('');
  const [isCustomMaddah, setIsCustomMaddah] = useState(false);
  const [category, setCategory] = useState<MaddahiTrack['category']>('zamineh');
  const [occasion, setOccasion] = useState('ایام محرم و صفر');
  const [poemText, setPoemText] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [rhythm, setRhythm] = useState('');
  const [maqam, setMaqam] = useState('');

  // Optional audio file
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<number>(60);

  const [errorMsg, setErrorMsg] = useState('');
  const isGreen = theme === 'soft-green';

  if (!isOpen) return null;

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    const tempAudio = new Audio(url);
    tempAudio.addEventListener('loadedmetadata', () => {
      if (tempAudio.duration && isFinite(tempAudio.duration)) {
        setAudioDuration(Math.round(tempAudio.duration));
      }
    });
  };

  const handleSave = () => {
    const finalMaddah = (isCustomMaddah ? customMaddah : maddah).trim();

    if (!title.trim()) {
      setErrorMsg('لطفاً عنوان شعر یا نوحه را وارد نمایید.');
      return;
    }

    if (!finalMaddah) {
      setErrorMsg('لطفاً نام مداح را مشخص فرمایید.');
      return;
    }

    if (!poemText.trim()) {
      setErrorMsg('لطفاً متن اشعار یا ابیات را وارد کنید.');
      return;
    }

    setErrorMsg('');

    // Estimate timestamps for lines
    const lines: LyricLine[] = estimateTimestampsFromText(
      poemText.trim(),
      audioDuration || 60
    );

    const newTrack: MaddahiTrack = {
      id: `track-other-${Date.now()}`,
      title: title.trim(),
      maddah: finalMaddah,
      category,
      occasion: occasion.trim(),
      audioUrl: audioUrl || undefined,
      duration: audioDuration || 60,
      lyricsLines: lines,
      isCustom: false,
      isOtherMaddah: true,
      isBookmarked: false,
      personalNotes: personalNotes.trim() || undefined,
      personalNotesUpdatedAt: personalNotes.trim() ? Date.now() : undefined,
      createdAt: Date.now(),
      notes: `شعر متعلق به ${finalMaddah}.`,
      rhythm: rhythm.trim() || undefined,
      maqam: maqam.trim() || undefined,
    };

    onTrackCreated(newTrack);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 select-none">
      <div
        className={`relative w-full max-w-2xl rounded-2xl border p-4 sm:p-6 text-stone-100 flex flex-col max-h-[92vh] overflow-y-auto ${
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
              <BookOpen className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3
                className={`text-base sm:text-lg font-bold ${
                  isGreen ? 'text-emerald-200' : 'text-red-200'
                }`}
              >
                افزودن و مدیریت شعر مداحان دیگر
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-400">
                ثبت اشعار و نوای مداحان اهل‌بیت جهت دسترسی و اجرای سریع در مجالس
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

        {/* Form Body */}
        <div className="py-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                عنوان نوحه یا مطلع شعر: *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: منم باید برم، آره سرم باید بره..."
                className={`w-full px-3 py-2 rounded-xl bg-stone-950 border text-xs sm:text-sm text-stone-100 placeholder-stone-600 focus:outline-none ${
                  isGreen
                    ? 'border-stone-800 focus:border-emerald-500'
                    : 'border-stone-800 focus:border-red-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                سبک نوحه / قالب:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs sm:text-sm text-stone-100 focus:outline-none"
              >
                <option value="zamineh">زمینه (آرام و محزون)</option>
                <option value="shoor">شور (کوبنده و پرهیجان)</option>
                <option value="vahed">واحد (سنگین یا شلاقی)</option>
                <option value="rozeh">روضه (مرثیه و گریه)</option>
                <option value="doodameh">دودمه (سنتی دسته‌جات)</option>
                <option value="monajat">مناجات (سحر یا پایان مجلس)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Maddah selection */}
          <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-300 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-stone-400" />
                <span>نام مداح یا خواننده اثر: *</span>
              </label>

              <button
                type="button"
                onClick={() => setIsCustomMaddah(!isCustomMaddah)}
                className={`text-[11px] font-semibold hover:underline cursor-pointer ${
                  isGreen ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {isCustomMaddah ? 'انتخاب از لیست مداحان مشهور' : 'وارد کردن نام دیگر مداح'}
              </button>
            </div>

            {isCustomMaddah ? (
              <input
                type="text"
                value={customMaddah}
                onChange={(e) => setCustomMaddah(e.target.value)}
                placeholder="نام مداح اهل‌بیت را تایپ کنید..."
                className={`w-full px-3 py-2 rounded-xl bg-stone-900 border text-xs sm:text-sm text-stone-100 focus:outline-none ${
                  isGreen
                    ? 'border-stone-800 focus:border-emerald-500'
                    : 'border-stone-800 focus:border-red-500'
                }`}
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_MADDAHS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMaddah(m)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                      maddah === m
                        ? isGreen
                          ? 'bg-[#14301d] text-emerald-300 border-emerald-500 font-bold'
                          : 'bg-[#301414] text-red-300 border-red-500 font-bold'
                        : 'bg-stone-900 hover:bg-stone-800 text-stone-400 border-stone-800'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Row 3: Occasion, Rhythm, Maqam */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                مناسبت / ایام:
              </label>
              <input
                type="text"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="مثال: شب عاشورا، ایام فاطمیه..."
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs sm:text-sm text-stone-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                وزن یا ریتم (اختیاری):
              </label>
              <input
                type="text"
                value={rhythm}
                onChange={(e) => setRhythm(e.target.value)}
                placeholder="مثال: ۴/۴ آرام، بحر طویل..."
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs sm:text-sm text-stone-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                دستگاه / مقام (اختیاری):
              </label>
              <input
                type="text"
                value={maqam}
                onChange={(e) => setMaqam(e.target.value)}
                placeholder="مثال: دشتی، شور، ابوعطا..."
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs sm:text-sm text-stone-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 4: Poem Lyrics Text */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1">
              متن کامل اشعار و ابیات (هر خط یک بیت یا مصراع): *
            </label>
            <textarea
              rows={6}
              value={poemText}
              onChange={(e) => setPoemText(e.target.value)}
              placeholder="متن کامل نوحه را اینجا بنویسید یا الصاق (Paste) کنید...&#10;هر خط به صورت یک بند همگام‌سازی شده در نظر گرفته خواهد شد."
              className={`w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border text-xs sm:text-sm text-stone-100 leading-relaxed font-sans placeholder-stone-600 focus:outline-none ${
                isGreen
                  ? 'border-stone-800 focus:border-emerald-500'
                  : 'border-stone-800 focus:border-red-500'
              }`}
            />
          </div>

          {/* Row 5: Optional Audio Attachment */}
          <div className="p-3 rounded-xl bg-stone-950 border border-stone-800">
            <label className="block text-xs font-semibold text-stone-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-stone-400" />
                <span>ضمیمه کردن فایل صوتی نوحه (اختیاری):</span>
              </span>
              <span className="text-[11px] text-stone-500">فرمت‌های MP3, M4A, WAV</span>
            </label>

            <div className="flex items-center gap-3">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 hover:border-stone-700 cursor-pointer text-xs font-semibold text-stone-300 transition-colors">
                <Upload className="w-4 h-4 text-stone-400" />
                <span>{audioFile ? audioFile.name : 'انتخاب فایل صوتی از گوشی یا رایانه'}</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioChange}
                  className="hidden"
                />
              </label>

              {audioFile && (
                <button
                  type="button"
                  onClick={() => {
                    setAudioFile(null);
                    setAudioUrl('');
                  }}
                  className="p-2 rounded-xl text-stone-500 hover:text-red-400 hover:bg-stone-900 transition-colors cursor-pointer"
                  title="حذف فایل صوتی"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Row 6: Personal Notes for Menbar */}
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-stone-400" />
              <span>یادداشت شخصی مداح و نکات اجرا (اختیاری):</span>
            </label>
            <textarea
              rows={2}
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              placeholder="نکات اجرایی منبر، زمان اوج، یا تذکرات لازم برای هیئت..."
              className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-100 placeholder-stone-600 focus:outline-none resize-none"
            />
          </div>
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
            className={`min-h-[42px] px-5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isGreen
                ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950'
                : 'bg-red-600 hover:bg-red-500 text-stone-100'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>ثبت شعر در کتابخانه</span>
          </button>
        </div>
      </div>
    </div>
  );
};
