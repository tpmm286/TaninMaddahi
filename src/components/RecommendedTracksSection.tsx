/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { MaddahiTrack } from '../types/maddahi';
import { AppTheme } from '../types/theme';
import { Sparkles, Play, Bookmark, Music } from 'lucide-react';
import { formatTime } from '../utils/syncUtils';

interface RecommendedTracksSectionProps {
  tracks: MaddahiTrack[];
  activeTrack: MaddahiTrack | null;
  theme?: AppTheme;
  onSelectTrack: (track: MaddahiTrack) => void;
  onToggleBookmark: (trackId: string) => void;
}

export const RecommendedTracksSection: React.FC<RecommendedTracksSectionProps> = ({
  tracks,
  activeTrack,
  theme = 'soft-green',
  onSelectTrack,
  onToggleBookmark,
}) => {
  const isGreen = theme === 'soft-green';

  const recommendedTracks = useMemo(() => {
    if (!tracks || tracks.length === 0) return [];

    const activeId = activeTrack?.id;
    const activeCategory = activeTrack?.category;
    const activeMaddah = activeTrack?.maddah;

    // Score tracks based on category match, maddah match, and bookmarks/popularity
    const scored = tracks
      .filter((t) => t.id !== activeId)
      .map((track) => {
        let score = 0;
        if (activeCategory && track.category === activeCategory) {
          score += 5;
        }
        if (activeMaddah && track.maddah && track.maddah === activeMaddah) {
          score += 8;
        }
        if (track.isBookmarked) {
          score += 3;
        }
        if (!track.isCustom) {
          score += 1; // Default verified tracks
        }
        return { track, score };
      });

    scored.sort((a, b) => b.score - a.score);

    // Return top 3 recommendations
    return scored.slice(0, 3).map((item) => item.track);
  }, [tracks, activeTrack]);

  if (recommendedTracks.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border p-3.5 mb-3.5 shadow-sm ${
        isGreen
          ? 'bg-[#101913] border-[#1f3824]'
          : 'bg-[#191010] border-[#381f1f]'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`p-1.5 rounded-lg ${
            isGreen ? 'bg-[#14301d] text-emerald-300' : 'bg-[#301414] text-red-300'
          }`}
        >
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-stone-200">پیشنهاد شده برای شما</h3>
          <p className="text-[10px] text-stone-400">بر اساس سبک و مداح اثر فعلی</p>
        </div>
      </div>

      <div className="space-y-2">
        {recommendedTracks.map((track) => {
          const isBookmarked = Boolean(track.isBookmarked);
          return (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track)}
              className={`group relative rounded-xl p-2.5 transition-colors cursor-pointer border flex items-center justify-between gap-3 ${
                isGreen
                  ? 'bg-stone-900/60 hover:bg-[#152419] border-stone-800/80 hover:border-emerald-500/50'
                  : 'bg-stone-900/60 hover:bg-[#241515] border-stone-800/80 hover:border-red-500/50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isGreen ? 'bg-[#14301d] text-emerald-300' : 'bg-[#301414] text-red-300'
                  }`}
                >
                  <Music className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-stone-100 truncate group-hover:text-emerald-300 transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-[11px] text-stone-400 truncate flex items-center gap-1 mt-0.5">
                    <span>{track.maddah}</span>
                    <span>•</span>
                    <span>{formatTime(track.duration)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBookmark(track.id);
                  }}
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${
                    isBookmarked
                      ? isGreen
                        ? 'bg-[#14301d] text-emerald-300 border-emerald-500'
                        : 'bg-[#301414] text-red-300 border-red-500'
                      : 'bg-stone-800/80 text-stone-400 hover:text-stone-200 border-stone-700'
                  }`}
                  title="نشانه‌گذاری"
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTrack(track);
                  }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors font-bold ${
                    isGreen
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-stone-950'
                      : 'bg-red-600 hover:bg-red-500 text-stone-100'
                  }`}
                  title="پخش"
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
