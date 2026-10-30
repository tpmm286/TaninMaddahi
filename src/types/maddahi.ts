/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LyricLine {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  stanzaIndex?: number;
  type?: 'verse' | 'chorus' | 'refrain' | 'mention';
}

export interface MaddahiTrack {
  id: string;
  title: string;
  maddah: string;
  category: 'zamineh' | 'shoor' | 'vahed' | 'rozeh' | 'doodameh' | 'monajat';
  occasion?: string;
  audioUrl?: string;
  /** فایل صوتی انتخاب‌شده در حافظهٔ ماندگار برنامه (IndexedDB) ذخیره شده است */
  hasLocalAudio?: boolean;
  audioFileName?: string;
  duration: number;
  lyricsLines: LyricLine[];
  isCustom?: boolean;
  createdAt: number;
  notes?: string;
  rhythm?: string;
  maqam?: string;
  isBookmarked?: boolean;
  isOtherMaddah?: boolean;
  personalNotes?: string;
  personalNotesUpdatedAt?: number;
}

export interface ProxyConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  modelName: string;
  endpointType?: 'auto' | 'chat' | 'audio_transcriptions';
}
