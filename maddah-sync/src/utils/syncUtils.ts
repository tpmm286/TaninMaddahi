/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LyricLine } from '../types/maddahi.ts';
export type { LyricLine };

/**
 * Format seconds into mm:ss or mm:ss.d
 */
export function formatTime(seconds: number, includeSubseconds = false): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const padMins = mins.toString().padStart(2, '0');
  const padSecs = secs.toString().padStart(2, '0');

  if (includeSubseconds) {
    const sub = Math.floor((seconds % 1) * 10);
    return `${padMins}:${padSecs}.${sub}`;
  }
  return `${padMins}:${padSecs}`;
}

/**
 * Parse mm:ss or mm:ss.xx into seconds
 */
export function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().replace(/^\[|\]$/g, '');
  const parts = cleaned.split(':');
  if (parts.length === 1) {
    const val = parseFloat(parts[0]);
    return isNaN(val) ? 0 : Math.max(0, val);
  }
  if (parts.length >= 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return Math.max(0, mins * 60 + secs);
  }
  return 0;
}

/**
 * Find the active lyric line index based on current playback time.
 */
export function findActiveLineIndex(lines: LyricLine[], currentTime: number): number {
  if (!lines || lines.length === 0) return -1;
  if (currentTime < lines[0].startTime) return 0;

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const next = lines[i + 1];
    if (next) {
      if (currentTime >= current.startTime && currentTime < next.startTime) {
        return i;
      }
    } else {
      if (currentTime >= current.startTime) {
        return i;
      }
    }
  }

  return lines.length - 1;
}

/**
 * Parse standard LRC format text into LyricLine[]
 */
export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{1,2}:\d{1,2}(?:\.\d{1,3})?)\](.*)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = line.match(timeRegex);
    if (match) {
      const timeInSec = parseTime(match[1]);
      const text = match[2].trim();
      if (text) {
        result.push({
          id: `line-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          startTime: timeInSec,
          endTime: timeInSec + 4,
          text,
          stanzaIndex: 1,
        });
      }
    }
  }

  for (let i = 0; i < result.length; i++) {
    if (i < result.length - 1) {
      result[i].endTime = result[i + 1].startTime;
    } else {
      result[i].endTime = result[i].startTime + 5;
    }
  }

  return result.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Serialize LyricLine[] to standard LRC format
 */
export function toLrc(lines: LyricLine[], title?: string, artist?: string): string {
  const headers: string[] = [];
  if (title) headers.push(`[ti:${title}]`);
  if (artist) headers.push(`[ar:${artist}]`);
  headers.push(`[tool:Tanin Maddahi]`);

  const body = lines.map((line) => {
    const mins = Math.floor(line.startTime / 60).toString().padStart(2, '0');
    const secs = (line.startTime % 60).toFixed(2).padStart(5, '0');
    return `[${mins}:${secs}]${line.text}`;
  });

  return [...headers, ...body].join('\n');
}

/**
 * Clean Persian poetry text and split into clean lines
 */
export function cleanPersianPoetry(rawText: string): string[] {
  if (!rawText) return [];
  return rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/[\u200B-\u200D\uFEFF]/g, '').trim())
    .filter((l) => l.length > 0);
}

/**
 * Distribute timestamps across lines based on duration and stanza breaks.
 */
export function estimateTimestampsFromText(lyricsText: string, totalDuration: number): LyricLine[] {
  const rawLines = cleanPersianPoetry(lyricsText);
  if (rawLines.length === 0) return [];

  const duration = Math.max(totalDuration, rawLines.length * 3);
  const introLeadTime = Math.min(3, duration * 0.05);
  const availableTime = duration - introLeadTime - 2;

  const weights = rawLines.map((line) => {
    const words = line.split(/\s+/).filter(Boolean).length;
    return Math.max(2, words);
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  let currentStart = introLeadTime;

  return rawLines.map((text, idx) => {
    const fraction = weights[idx] / totalWeight;
    const lineDuration = Math.max(2.5, fraction * availableTime);
    const start = currentStart;
    const end = start + lineDuration;
    currentStart = end;

    const isChorus = /^(حسین|یا حسین|یا اباالفضل|جان آقا|مولا|لبیک|مظلوم|امان از دل)/i.test(text);

    return {
      id: `line-${idx + 1}-${Math.random().toString(36).slice(2, 7)}`,
      startTime: Math.round(start * 100) / 100,
      endTime: Math.round(end * 100) / 100,
      text,
      stanzaIndex: Math.floor(idx / 4) + 1,
      type: isChorus ? 'chorus' : 'verse',
    };
  });
}
