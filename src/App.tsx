/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MaddahiTrack, LyricLine, ProxyConfig } from './types/maddahi';
import { AppTheme, THEME_STORAGE_KEY } from './types/theme';
import { DEFAULT_TRACKS } from './data/defaultTracks';
import { MaddahiAudioEngine } from './utils/audioSynth';
import { findActiveLineIndex, toLrc } from './utils/syncUtils';
import {
  saveAudio,
  loadAudio,
  deleteAudio,
  isVolatileUrl,
  measureAudioDuration,
} from './utils/audioStore';
import {
  PositionsMap,
  loadPositions,
  savePositions,
  loadLastTrackId,
  saveLastTrackId,
  isResumablePosition,
} from './utils/playbackMemory';
import { App as CapApp } from '@capacitor/app';
import { Header } from './components/Header';
import { TrackCard } from './components/TrackCard';
import { SynchronizedLyricsView } from './components/SynchronizedLyricsView';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { UploadAndSyncModal } from './components/UploadAndSyncModal';
import { SyncEditorModal } from './components/SyncEditorModal';
import { StageModeModal } from './components/StageModeModal';
import { AddOtherMaddahPoemModal } from './components/AddOtherMaddahPoemModal';
import { PersonalNotesModal } from './components/PersonalNotesModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { RecommendedTracksSection } from './components/RecommendedTracksSection';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import {
  ProxySettingsModal,
  PROXY_STORAGE_KEY,
  DEFAULT_PROXY_CONFIG,
} from './components/ProxySettingsModal';
import {
  Search,
  BookOpen,
  Mic,
  Music2,
  Layers,
  Bookmark,
  Users,
  Plus,
} from 'lucide-react';

const STORAGE_KEY = 'tanin_maddahi_tracks_v2';

// آدرس‌های blob:/data: با بستن برنامه از بین می‌روند و نباید ذخیره شوند
const stripVolatileAudio = (t: MaddahiTrack): MaddahiTrack =>
  isVolatileUrl(t.audioUrl) ? { ...t, audioUrl: undefined } : t;

// ذخیرهٔ فایل صوتی (که فعلاً فقط با آدرس blob: در دسترس است) در حافظهٔ ماندگار
const persistBlobUrlAudio = (trackId: string, url: string) => {
  fetch(url)
    .then((r) => r.blob())
    .then((b) => saveAudio(trackId, b))
    .catch(() => {
      // ignore
    });
};

export default function App() {
  // Theme state: 'soft-green' (default) or 'soft-red'
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'soft-green' || saved === 'soft-red') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'soft-green';
  });

  const isGreen = theme === 'soft-green';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'soft-green' ? 'soft-red' : 'soft-green'));
  };

  // Load stored tracks or defaults
  const [tracks, setTracks] = useState<MaddahiTrack[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return (parsed as MaddahiTrack[]).map(stripVolatileAudio);
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_TRACKS;
  });

  // مکان توقف هر اثر (ثانیه) + آخرین اثر باز شده
  const [savedPositions, setSavedPositions] = useState<PositionsMap>(() => loadPositions());

  const [activeTrackId, setActiveTrackId] = useState<string>(() => {
    const last = loadLastTrackId();
    if (last && tracks.some((t) => t.id === last)) return last;
    return tracks[0]?.id || '';
  });

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => {
    const t = tracks.find((x) => x.id === activeTrackId);
    const pos = savedPositions[activeTrackId] || 0;
    return isResumablePosition(pos, t?.duration) ? pos : 0;
  });
  const [duration, setDuration] = useState<number>(
    () => tracks.find((t) => t.id === activeTrackId)?.duration || tracks[0]?.duration || 72
  );
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [pitchShift, setPitchShift] = useState<number>(0);
  const [loopRange, setLoopRange] = useState<{ start: number; end: number } | null>(null);
  const [vocalBoost, setVocalBoost] = useState<boolean>(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'bookmarks' | 'my-works' | 'other-maddahs'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMaddah, setSelectedMaddah] = useState<string>('all');

  // Mobile navigation tab ('lyrics' | 'library')
  const [mobileTab, setMobileTab] = useState<'lyrics' | 'library'>('lyrics');

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isAddOtherMaddahOpen, setIsAddOtherMaddahOpen] = useState<boolean>(false);
  const [isSyncEditorOpen, setIsSyncEditorOpen] = useState<boolean>(false);
  const [isStageModeOpen, setIsStageModeOpen] = useState<boolean>(false);
  const [isProxySettingsOpen, setIsProxySettingsOpen] = useState<boolean>(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState<boolean>(false);
  const [isGoogleDriveOpen, setIsGoogleDriveOpen] = useState<boolean>(false);
  const [isBackupOpen, setIsBackupOpen] = useState<boolean>(false);

  const [trackToEdit, setTrackToEdit] = useState<MaddahiTrack | null>(null);
  const [trackForNotes, setTrackForNotes] = useState<MaddahiTrack | null>(null);

  // Custom OpenAI-compatible proxy server settings
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>(() => {
    try {
      const saved = localStorage.getItem(PROXY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_PROXY_CONFIG, ...parsed };
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROXY_CONFIG;
  });

  const handleSaveProxyConfig = (cfg: ProxyConfig) => {
    setProxyConfig(cfg);
    try {
      localStorage.setItem(PROXY_STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      // ignore
    }
  };

  // Audio Engine instance ref
  const engineRef = useRef<MaddahiAudioEngine | null>(null);

  // Refs for position memory (avoid stale closures in timers/listeners)
  const tracksRef = useRef<MaddahiTrack[]>(tracks);
  tracksRef.current = tracks;
  const activeIdRef = useRef<string>(activeTrackId);
  const currentTimeRef = useRef<number>(currentTime);
  const isPlayingRef = useRef<boolean>(false);
  const positionsRef = useRef<PositionsMap>(savedPositions);
  const backHandlerRef = useRef<() => void>(() => {});

  // File picker (انتخاب صوت از گوشی)
  const audioPickerRef = useRef<HTMLInputElement>(null);
  const pickTargetIdRef = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 5000);
  };

  // ذخیرهٔ مکان پخش یک اثر
  const savePosition = (trackId: string, time: number) => {
    if (!trackId || !isFinite(time)) return;
    const trackDuration = tracksRef.current.find((t) => t.id === trackId)?.duration;
    const prev = positionsRef.current;
    let next: PositionsMap;
    if (isResumablePosition(time, trackDuration)) {
      if (prev[trackId] !== undefined && Math.abs(prev[trackId] - time) < 0.5) return;
      next = { ...prev, [trackId]: Math.round(time * 10) / 10 };
    } else {
      if (prev[trackId] === undefined) return;
      next = { ...prev };
      delete next[trackId];
    }
    positionsRef.current = next;
    setSavedPositions(next);
    savePositions(next);
  };

  const resumeStartFor = (track: MaddahiTrack): number => {
    const pos = positionsRef.current[track.id] || 0;
    return isResumablePosition(pos, track.duration) ? pos : 0;
  };

  // بارگذاری اثر در پخش‌کننده و پرش به مکان ذخیره‌شده
  const loadTrackIntoEngine = (track: MaddahiTrack, startAt: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setTrack(track.audioUrl, track.duration);
    currentTimeRef.current = 0;
    if (startAt > 0) {
      engine.seek(startAt);
      currentTimeRef.current = startAt;
      setCurrentTime(startAt);
    }
  };

  // جابه‌جایی اثر فعال: مکان اثر قبلی ذخیره و اثر جدید ثبت می‌شود
  const switchActiveBookkeeping = (newId: string) => {
    savePosition(activeIdRef.current, currentTimeRef.current);
    activeIdRef.current = newId;
    currentTimeRef.current = 0;
    saveLastTrackId(newId);
  };

  // ساخت آدرس تازه برای صوت‌های ذخیره‌شده در IndexedDB
  const hydrateLocalAudio = async (list: MaddahiTrack[]) => {
    const urls: Record<string, string> = {};
    for (const t of list) {
      if (!t.hasLocalAudio || t.audioUrl) continue;
      const blob = await loadAudio(t.id);
      if (blob) urls[t.id] = URL.createObjectURL(blob);
    }
    if (Object.keys(urls).length === 0) return;
    setTracks((prev) =>
      prev.map((t) => (urls[t.id] && !t.audioUrl ? { ...t, audioUrl: urls[t.id] } : t))
    );
    const active = list.find((t) => t.id === activeIdRef.current);
    if (active && urls[active.id] && !isPlayingRef.current) {
      loadTrackIntoEngine({ ...active, audioUrl: urls[active.id] }, resumeStartFor(active));
    }
  };

  // Save tracks to localStorage on update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks.map(stripVolatileAudio)));
    } catch {
      // ignore
    }
  }, [tracks]);

  // Active track object
  const activeTrack = useMemo(() => {
    return tracks.find((t) => t.id === activeTrackId) || tracks[0] || null;
  }, [tracks, activeTrackId]);

  // Current active lyric line index
  const activeLineIndex = useMemo(() => {
    if (!activeTrack?.lyricsLines) return -1;
    return findActiveLineIndex(activeTrack.lyricsLines, currentTime);
  }, [activeTrack, currentTime]);

  // Initialize Audio Engine once
  useEffect(() => {
    const engine = new MaddahiAudioEngine({
      onTimeUpdate: (cur, dur) => {
        currentTimeRef.current = cur;
        setCurrentTime(cur);
        if (dur && isFinite(dur)) {
          setDuration(dur);
        }
      },
      onEnded: () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        // پایان اثر: دفعهٔ بعد از ابتدا شروع شود
        savePosition(activeIdRef.current, 0);
      },
      onPlayStateChange: (playing) => {
        isPlayingRef.current = playing;
        setIsPlaying(playing);
      },
    });

    engineRef.current = engine;

    if (activeTrack) {
      loadTrackIntoEngine(activeTrack, resumeStartFor(activeTrack));
    }

    // صوت‌های انتخاب‌شده در دفعات قبل را از حافظهٔ ماندگار برمی‌گرداند
    hydrateLocalAudio(tracksRef.current);

    return () => {
      engine.destroy();
    };
  }, []);

  // ذخیرهٔ دوره‌ای مکان پخش + هنگام رفتن برنامه به پس‌زمینه یا بسته شدن
  useEffect(() => {
    activeIdRef.current = activeTrackId;
  }, [activeTrackId]);

  useEffect(() => {
    const flush = () => {
      if (isPlayingRef.current) {
        savePosition(activeIdRef.current, currentTimeRef.current);
      }
    };

    const interval = window.setInterval(flush, 2000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);

    let capHandle: { remove: () => void } | null = null;
    let capBackHandle: { remove: () => void } | null = null;
    try {
      CapApp.addListener('appStateChange', (state) => {
        if (!state.isActive) flush();
      })
        .then((h) => {
          capHandle = h;
        })
        .catch(() => {});
      // دکمهٔ برگشت اندروید: بستن پنجره‌ها، بازگشت به متن، سپس کوچک‌کردن برنامه
      CapApp.addListener('backButton', () => backHandlerRef.current())
        .then((h) => {
          capBackHandle = h;
        })
        .catch(() => {});
    } catch {
      // نسخهٔ وب: افزونه در دسترس نیست
    }

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      capHandle?.remove();
      capBackHandle?.remove();
    };
  }, []);

  // Update audio engine when active track changes
  const handleSelectTrack = (selected: MaddahiTrack) => {
    // همیشه آخرین نسخهٔ اثر (با آدرس صوت تازه) را بگیر
    const track = tracksRef.current.find((t) => t.id === selected.id) || selected;

    // اثر فعلی دوباره انتخاب شد: از ابتدا شروع نشود، فقط به متن برو
    if (track.id === activeIdRef.current) {
      setMobileTab('lyrics');
      return;
    }

    switchActiveBookkeeping(track.id);
    const startAt = resumeStartFor(track);

    setActiveTrackId(track.id);
    setCurrentTime(startAt);
    setDuration(track.duration);
    setLoopRange(null);
    engineRef.current?.setLoopRange(null);

    if (engineRef.current) {
      loadTrackIntoEngine(track, startAt);
      if (isPlaying) {
        engineRef.current.play();
      }
    }

    setMobileTab('lyrics');
  };

  const handleTogglePlay = (track?: MaddahiTrack) => {
    if (!engineRef.current) return;

    if (track && track.id !== activeTrackId) {
      handleSelectTrack(track);
      setTimeout(() => {
        engineRef.current?.play();
      }, 50);
      return;
    }

    if (isPlaying) {
      engineRef.current.pause();
      savePosition(activeIdRef.current, currentTimeRef.current);
    } else {
      engineRef.current.play();
    }
  };

  const handleSeek = (seconds: number) => {
    if (!engineRef.current) return;
    engineRef.current.seek(seconds);
    currentTimeRef.current = seconds;
    setCurrentTime(seconds);
    savePosition(activeIdRef.current, seconds);
  };

  const handleStepTime = (deltaSeconds: number) => {
    const target = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    handleSeek(target);
  };

  const handleChangePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    engineRef.current?.setPlaybackRate(rate);
  };

  const handleChangePitch = (semitones: number) => {
    setPitchShift(semitones);
    engineRef.current?.setPitchShift(semitones);
  };

  const handleToggleVocalBoost = () => {
    const next = !vocalBoost;
    setVocalBoost(next);
    engineRef.current?.setVocalBoost(next);
  };

  const handleToggleLoopLine = (line: LyricLine) => {
    if (!engineRef.current) return;

    if (
      loopRange &&
      Math.abs(loopRange.start - line.startTime) < 0.1 &&
      Math.abs(loopRange.end - line.endTime) < 0.1
    ) {
      setLoopRange(null);
      engineRef.current.setLoopRange(null);
    } else {
      const newRange = { start: line.startTime, end: line.endTime };
      setLoopRange(newRange);
      engineRef.current.setLoopRange(newRange);
      handleSeek(line.startTime);
      if (!isPlaying) {
        engineRef.current.play();
      }
    }
  };

  const handleSeekToLine = (line: LyricLine) => {
    handleSeek(line.startTime);
    if (!isPlaying) {
      engineRef.current?.play();
    }
  };

  const handleNextVerse = () => {
    if (!activeTrack?.lyricsLines) return;
    const nextIdx = Math.min(activeTrack.lyricsLines.length - 1, activeLineIndex + 1);
    const line = activeTrack.lyricsLines[nextIdx];
    if (line) {
      handleSeekToLine(line);
    }
  };

  const handlePrevVerse = () => {
    if (!activeTrack?.lyricsLines) return;
    const prevIdx = Math.max(0, activeLineIndex - 1);
    const line = activeTrack.lyricsLines[prevIdx];
    if (line) {
      handleSeekToLine(line);
    }
  };

  // Toggle Bookmark handler
  const handleToggleBookmark = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, isBookmarked: !t.isBookmarked } : t))
    );
  };

  // Open Personal Notes Modal
  const handleOpenNotes = (track: MaddahiTrack) => {
    setTrackForNotes(track);
    setIsNotesModalOpen(true);
  };

  // Save Personal Notes handler
  const handleSavePersonalNotes = (trackId: string, notes: string) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? {
              ...t,
              personalNotes: notes,
              personalNotesUpdatedAt: Date.now(),
            }
          : t
      )
    );
  };

  const handleOpenSyncEditor = (track: MaddahiTrack) => {
    setTrackToEdit(track);
    setIsSyncEditorOpen(true);
  };

  const handleSaveTrackChanges = (updated: MaddahiTrack) => {
    setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (updated.id === activeTrackId) {
      setDuration(updated.duration);
    }
  };

  const handleTrackCreated = (created: MaddahiTrack) => {
    let newTrack = created;
    if (created.audioUrl && created.audioUrl.startsWith('blob:')) {
      // فایل صوتی برای دفعات بعد در حافظهٔ ماندگار ذخیره می‌شود
      newTrack = { ...created, hasLocalAudio: true };
      persistBlobUrlAudio(created.id, created.audioUrl);
    }

    switchActiveBookkeeping(newTrack.id);
    setTracks((prev) => [newTrack, ...prev]);
    setActiveTrackId(newTrack.id);
    setCurrentTime(0);
    setDuration(newTrack.duration);
    setMobileTab('lyrics');

    if (engineRef.current) {
      engineRef.current.setTrack(newTrack.audioUrl, newTrack.duration);
      engineRef.current.play();
    }
  };

  const handleTracksImported = (newTracks: MaddahiTrack[]) => {
    if (newTracks.length === 0) return;
    switchActiveBookkeeping(newTracks[0].id);
    setTracks((prev) => [...newTracks, ...prev]);
    setActiveTrackId(newTracks[0].id);
    setCurrentTime(0);
    setDuration(newTracks[0].duration);
    setMobileTab('lyrics');
    if (engineRef.current) {
      engineRef.current.setTrack(newTracks[0].audioUrl, newTracks[0].duration);
      engineRef.current.play();
    }
  };

  const handleRestoreData = (restoredTracks: MaddahiTrack[]) => {
    if (restoredTracks.length === 0) return;
    const cleaned = restoredTracks.map(stripVolatileAudio);
    switchActiveBookkeeping(cleaned[0].id);
    tracksRef.current = cleaned;
    setTracks(cleaned);
    setActiveTrackId(cleaned[0].id);
    setCurrentTime(0);
    setDuration(cleaned[0].duration || 60);
    setMobileTab('library');
    if (engineRef.current) {
      loadTrackIntoEngine(cleaned[0], resumeStartFor(cleaned[0]));
    }
    hydrateLocalAudio(cleaned);
  };


  const handleDeleteTrack = (id: string) => {
    const removed = tracks.find((t) => t.id === id);
    const remaining = tracks.filter((t) => t.id !== id);
    setTracks(remaining);
    if (activeTrackId === id && remaining.length > 0) {
      handleSelectTrack(remaining[0]);
    }
    // پاک‌سازی صوت و مکان ذخیره‌شدهٔ اثر حذف‌شده
    deleteAudio(id);
    if (positionsRef.current[id] !== undefined) {
      const next = { ...positionsRef.current };
      delete next[id];
      positionsRef.current = next;
      setSavedPositions(next);
      savePositions(next);
    }
    if (removed?.audioUrl && removed.audioUrl.startsWith('blob:') && activeTrackId !== id) {
      URL.revokeObjectURL(removed.audioUrl);
    }
  };

  // انتخاب فایل صوتی از گوشی برای یک اثر
  const handleRequestPickAudio = (track: MaddahiTrack) => {
    pickTargetIdRef.current = track.id;
    audioPickerRef.current?.click();
  };

  const handleAudioPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = pickTargetIdRef.current;
    e.target.value = '';
    if (!file || !targetId) return;

    const target = tracksRef.current.find((t) => t.id === targetId);
    if (!target) return;

    const looksLikeAudio =
      (file.type && file.type.startsWith('audio/')) ||
      /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|wma|amr|3gp|webm|mp4)$/i.test(file.name);
    if (!looksLikeAudio) {
      showNotice('فایل انتخاب‌شده صوتی نیست. لطفاً یک فایل صوتی (مثل MP3 یا M4A) انتخاب کنید.');
      return;
    }

    const saved = await saveAudio(targetId, file);
    const url = URL.createObjectURL(file);
    const measured = await measureAudioDuration(url);
    const newDuration = measured || target.duration;
    const oldUrl = target.audioUrl;

    setTracks((prev) =>
      prev.map((t) =>
        t.id === targetId
          ? { ...t, audioUrl: url, hasLocalAudio: saved, audioFileName: file.name, duration: newDuration }
          : t
      )
    );
    tracksRef.current = tracksRef.current.map((t) =>
      t.id === targetId
        ? { ...t, audioUrl: url, hasLocalAudio: saved, audioFileName: file.name, duration: newDuration }
        : t
    );

    // صوت تازه از ابتدا شروع شود
    savePosition(targetId, 0);
    if (targetId === activeIdRef.current && engineRef.current) {
      setLoopRange(null);
      engineRef.current.setLoopRange(null);
      loadTrackIntoEngine({ ...target, audioUrl: url, duration: newDuration }, 0);
      setCurrentTime(0);
      setDuration(newDuration);
    }

    if (oldUrl && oldUrl.startsWith('blob:')) {
      URL.revokeObjectURL(oldUrl);
    }

    showNotice(
      saved
        ? `صوت «${file.name}» برای «${target.title}» انتخاب و ذخیره شد. اگر زمان‌بندی بیت‌ها با این صوت نمی‌خواند، از بخش «همگامی» تنظیم کنید.`
        : `صوت «${file.name}» انتخاب شد، اما حافظهٔ دستگاه اجازهٔ ذخیره نداد؛ فقط تا بستن برنامه باقی می‌ماند.`
    );
  };

  const handleExportLrc = (track: MaddahiTrack) => {
    const lrc = toLrc(track.lyricsLines || [], track.title, track.maddah);
    const blob = new Blob([lrc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${track.title || 'maddahi'}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Unique list of all madahs present in the library
  const uniqueMaddahs = useMemo(() => {
    const names = tracks
      .map((t) => t.maddah)
      .filter((m) => m && !m.includes('(اثر من)') && !m.includes('(خودم)'));
    return Array.from(new Set(names));
  }, [tracks]);

  // Counts for tabs
  const bookmarkedCount = useMemo(() => tracks.filter((t) => t.isBookmarked).length, [tracks]);
  const customTracksCount = useMemo(() => tracks.filter((t) => t.isCustom).length, [tracks]);
  const otherMaddahsCount = useMemo(
    () => tracks.filter((t) => !t.isCustom || t.isOtherMaddah).length,
    [tracks]
  );

  // Filtered tracks based on scope, category, maddah, and search
  const filteredTracks = useMemo(() => {
    return tracks.filter((track) => {
      // 1. Scope Filter
      if (scopeFilter === 'bookmarks' && !track.isBookmarked) return false;
      if (scopeFilter === 'my-works' && !track.isCustom) return false;
      if (scopeFilter === 'other-maddahs' && (track.isCustom && !track.isOtherMaddah)) {
        return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'all' && track.category !== selectedCategory) {
        return false;
      }

      // 3. Maddah Filter
      if (selectedMaddah !== 'all' && track.maddah !== selectedMaddah) {
        return false;
      }

      // 4. Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const inTitle = track.title.toLowerCase().includes(q);
      const inMaddah = track.maddah.toLowerCase().includes(q);
      const inOccasion = track.occasion ? track.occasion.toLowerCase().includes(q) : false;
      const inNotes = track.personalNotes ? track.personalNotes.toLowerCase().includes(q) : false;
      const inLyrics = track.lyricsLines?.some((l) => l.text.toLowerCase().includes(q));

      return inTitle || inMaddah || inOccasion || inNotes || inLyrics;
    });
  }, [tracks, scopeFilter, selectedCategory, selectedMaddah, searchQuery]);

  // دکمهٔ برگشت اندروید (هر رندر به‌روز می‌شود تا وضعیت پنجره‌ها را ببیند)
  backHandlerRef.current = () => {
    if (isStageModeOpen) return setIsStageModeOpen(false);
    if (isSyncEditorOpen) return setIsSyncEditorOpen(false);
    if (isNotesModalOpen) return setIsNotesModalOpen(false);
    if (isUploadOpen) return setIsUploadOpen(false);
    if (isAddOtherMaddahOpen) return setIsAddOtherMaddahOpen(false);
    if (isProxySettingsOpen) return setIsProxySettingsOpen(false);
    if (isGoogleDriveOpen) return setIsGoogleDriveOpen(false);
    if (isBackupOpen) return setIsBackupOpen(false);
    if (mobileTab === 'library') return setMobileTab('lyrics');
    // پخش ادامه پیدا می‌کند؛ برنامه فقط به پس‌زمینه می‌رود
    CapApp.minimizeApp().catch(() => {
      CapApp.exitApp().catch(() => {});
    });
  };

  return (
    <div
      className={`min-h-screen text-stone-100 flex flex-col font-sans pb-44 transition-colors ${
        isGreen ? 'bg-[#090e0b]' : 'bg-[#0e0909]'
      }`}
    >
      {/* Header */}
      <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenAddOtherMaddah={() => setIsAddOtherMaddahOpen(true)}
        onOpenStageMode={() => setIsStageModeOpen(true)}
        onOpenProxySettings={() => setIsProxySettingsOpen(true)}
        onOpenGoogleDrive={() => setIsGoogleDriveOpen(true)}
        onOpenBackup={() => setIsBackupOpen(true)}
        isProxyActive={Boolean(proxyConfig.enabled && proxyConfig.baseUrl)}
        activeTrackTitle={activeTrack?.title}
        totalTracks={tracks.length}
        customTracksCount={customTracksCount}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-3.5 flex-1 flex flex-col">
        {/* Mobile View Toggle Switch (Flat, Touch Ergonomic >= 44px) */}
        <div
          className={`lg:hidden flex items-center rounded-xl p-1 mb-3.5 border ${
            isGreen
              ? 'bg-[#0e1610] border-[#1d2f21]'
              : 'bg-[#160e0e] border-[#2f1d1d]'
          }`}
        >
          <button
            onClick={() => setMobileTab('lyrics')}
            type="button"
            className={`min-h-[44px] flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobileTab === 'lyrics'
                ? isGreen
                  ? 'bg-emerald-600 text-stone-950 font-black'
                  : 'bg-red-600 text-stone-100 font-black'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>متن و همگام‌ساز زنده</span>
          </button>

          <button
            onClick={() => setMobileTab('library')}
            type="button"
            className={`min-h-[44px] flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mobileTab === 'library'
                ? isGreen
                  ? 'bg-emerald-600 text-stone-950 font-black'
                  : 'bg-red-600 text-stone-100 font-black'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>فهرست آثار ({tracks.length})</span>
          </button>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-stretch">
          {/* Left Column (Desktop) / Tab 2: Track Library & Filters */}
          <section
            aria-label="فهرست نوحه‌ها و آثار مداحی"
            className={`lg:col-span-5 flex flex-col gap-3 ${
              mobileTab === 'library' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {/* Recommended for You Section */}
            <RecommendedTracksSection
              tracks={tracks}
              activeTrack={activeTrack}
              theme={theme}
              onSelectTrack={handleSelectTrack}
              onToggleBookmark={handleToggleBookmark}
            />

            {/* Search Bar - Flat & Lightweight */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در اشعار، نام مداح، مناسبت یا یادداشت‌ها..."
                className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl border text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none transition-colors ${
                  isGreen
                    ? 'bg-[#0f1711] border-[#1d2f21] focus:border-emerald-500'
                    : 'bg-[#170f0f] border-[#2f1d1d] focus:border-red-500'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  type="button"
                  aria-label="پاک کردن جستجو"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-300 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Scope Filter Tabs: All / Bookmarks / Other Madahs / My Works */}
            <div
              className={`grid grid-cols-4 gap-1 p-1 rounded-xl border text-xs ${
                isGreen
                  ? 'bg-[#0e1610] border-[#1d2f21]'
                  : 'bg-[#160e0e] border-[#2f1d1d]'
              }`}
            >
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className={`min-h-[42px] py-1.5 px-1 rounded-lg font-bold flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  scopeFilter === 'all'
                    ? isGreen
                      ? 'bg-emerald-600 text-stone-950 font-black'
                      : 'bg-red-600 text-stone-100 font-black'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <span>همه آثار</span>
                <span className="text-[10px] opacity-80">({tracks.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setScopeFilter('bookmarks')}
                className={`min-h-[42px] py-1.5 px-1 rounded-lg font-bold flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  scopeFilter === 'bookmarks'
                    ? isGreen
                      ? 'bg-emerald-600 text-stone-950 font-black'
                      : 'bg-red-600 text-stone-100 font-black'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Bookmark className="w-3 h-3 fill-current" />
                  برگزیده‌ها
                </span>
                <span className="text-[10px] opacity-80">({bookmarkedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setScopeFilter('other-maddahs')}
                className={`min-h-[42px] py-1.5 px-1 rounded-lg font-bold flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  scopeFilter === 'other-maddahs'
                    ? isGreen
                      ? 'bg-emerald-600 text-stone-950 font-black'
                      : 'bg-red-600 text-stone-100 font-black'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  سایر مداحان
                </span>
                <span className="text-[10px] opacity-80">({otherMaddahsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setScopeFilter('my-works')}
                className={`min-h-[42px] py-1.5 px-1 rounded-lg font-bold flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  scopeFilter === 'my-works'
                    ? isGreen
                      ? 'bg-emerald-600 text-stone-950 font-black'
                      : 'bg-red-600 text-stone-100 font-black'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Mic className="w-3 h-3" />
                  آثار من
                </span>
                <span className="text-[10px] opacity-80">({customTracksCount})</span>
              </button>
            </div>

            {/* Dedicated Maddah Filter Chips */}
            {(scopeFilter === 'other-maddahs' || scopeFilter === 'all') && uniqueMaddahs.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] text-stone-400 shrink-0 flex items-center gap-1 pl-1">
                  <Users className={`w-3 h-3 ${isGreen ? 'text-emerald-400' : 'text-red-400'}`} />
                  مداح:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMaddah('all')}
                  className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors border cursor-pointer ${
                    selectedMaddah === 'all'
                      ? isGreen
                        ? 'bg-[#14301d] text-emerald-300 border-emerald-500 font-bold'
                        : 'bg-[#301414] text-red-300 border-red-500 font-bold'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  همه مداحان
                </button>
                {uniqueMaddahs.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMaddah(m)}
                    className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors border cursor-pointer ${
                      selectedMaddah === m
                        ? isGreen
                          ? 'bg-[#14301d] text-emerald-300 border-emerald-500 font-bold'
                          : 'bg-[#301414] text-red-300 border-red-500 font-bold'
                        : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'all', label: 'همه سبک‌ها' },
                { id: 'zamineh', label: 'زمینه' },
                { id: 'shoor', label: 'شور' },
                { id: 'vahed', label: 'واحد' },
                { id: 'rozeh', label: 'روضه' },
                { id: 'doodameh', label: 'دودمه' },
                { id: 'monajat', label: 'مناجات' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedCategory(f.id)}
                  type="button"
                  className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-colors border cursor-pointer ${
                    selectedCategory === f.id
                      ? isGreen
                        ? 'bg-emerald-600 text-stone-950 border-emerald-500'
                        : 'bg-red-600 text-stone-100 border-red-500'
                      : 'bg-stone-950 text-stone-400 hover:text-stone-200 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Quick Actions Row */}
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] text-stone-400 font-medium">
                نمایش {filteredTracks.length} اثر
              </span>
              <button
                onClick={() => setIsAddOtherMaddahOpen(true)}
                type="button"
                className={`text-xs flex items-center gap-1 font-bold hover:underline cursor-pointer ${
                  isGreen ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ ثبت شعر مداح دیگر</span>
              </button>
            </div>

            {/* Tracks List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5 max-h-[calc(100vh-320px)]">
              {filteredTracks.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-2xl bg-stone-950 border border-dashed border-stone-800">
                  <Music2 className="w-8 h-8 text-stone-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-stone-300">
                    {scopeFilter === 'bookmarks'
                      ? 'هنوز اثری نشانه‌گذاری نشده است'
                      : 'شعری با این مشخصات یافت نشد'}
                  </p>
                  <p className="text-xs text-stone-500 mt-1">
                    {scopeFilter === 'bookmarks'
                      ? 'با کلیک روی نشانه‌گذاری کنار هر شعر، آن را به برگزیده‌ها بیفزایید.'
                      : 'می‌توانید شعر جدید اضافه نمایید یا فیلترها را تغییر دهید.'}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                    <button
                      onClick={() => setIsAddOtherMaddahOpen(true)}
                      type="button"
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        isGreen
                          ? 'bg-[#14301d] text-emerald-300 border-[#225732]'
                          : 'bg-[#301414] text-red-300 border-[#572222]'
                      }`}
                    >
                      + ثبت شعر مداح دیگر
                    </button>
                    <button
                      onClick={() => {
                        setScopeFilter('all');
                        setSelectedCategory('all');
                        setSelectedMaddah('all');
                        setSearchQuery('');
                      }}
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-stone-900 text-stone-300 text-xs font-semibold hover:bg-stone-800 transition-colors border border-stone-800 cursor-pointer"
                    >
                      پاک کردن فیلترها
                    </button>
                  </div>
                </div>
              ) : (
                filteredTracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    isActive={track.id === activeTrackId}
                    isPlaying={track.id === activeTrackId && isPlaying}
                    theme={theme}
                    onSelect={handleSelectTrack}
                    onTogglePlay={handleTogglePlay}
                    onToggleBookmark={handleToggleBookmark}
                    onOpenNotes={handleOpenNotes}
                    onOpenSyncEditor={handleOpenSyncEditor}
                    onExportLrc={handleExportLrc}
                    onDelete={handleDeleteTrack}
                    onPickAudio={handleRequestPickAudio}
                    resumeAt={savedPositions[track.id]}
                  />
                ))
              )}
            </div>
          </section>

          {/* Right Column: Synchronized Lyrics View */}
          <section
            aria-label="نمایش متن همگام‌سازی شده"
            className={`lg:col-span-7 flex flex-col h-full min-h-[500px] ${
              mobileTab === 'lyrics' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {activeTrack ? (
              <SynchronizedLyricsView
                track={activeTrack}
                currentTime={currentTime}
                activeLineIndex={activeLineIndex}
                isPlaying={isPlaying}
                loopRange={loopRange}
                theme={theme}
                onSeekToLine={handleSeekToLine}
                onToggleLoopLine={handleToggleLoopLine}
                onToggleBookmark={handleToggleBookmark}
                onOpenNotes={handleOpenNotes}
                onOpenSyncEditor={() => handleOpenSyncEditor(activeTrack)}
                onOpenStageMode={() => setIsStageModeOpen(true)}
                onPickAudio={() => handleRequestPickAudio(activeTrack)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-stone-500 bg-stone-950 rounded-2xl border border-stone-800">
                <div className="px-6 py-10 space-y-2">
                  <p className="text-stone-300 font-bold">هنوز اثری اضافه نکرده‌اید</p>
                  <p className="text-xs leading-relaxed">
                    با دکمهٔ «+» بالای صفحه، صوت یا متن نوحه را اضافه کنید تا استخراج و همگام‌سازی شروع شود.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Persistent Bottom Audio Player Bar */}
      <AudioPlayerBar
        track={activeTrack}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        pitchShift={pitchShift}
        isLooping={Boolean(loopRange)}
        vocalBoost={vocalBoost}
        theme={theme}
        onTogglePlay={() => handleTogglePlay()}
        onSeek={handleSeek}
        onStepTime={handleStepTime}
        onChangeRate={handleChangePlaybackRate}
        onChangePitch={handleChangePitch}
        onToggleLoop={() => {
          if (loopRange) {
            setLoopRange(null);
            engineRef.current?.setLoopRange(null);
          } else if (activeTrack?.lyricsLines?.[activeLineIndex]) {
            handleToggleLoopLine(activeTrack.lyricsLines[activeLineIndex]);
          }
        }}
        onToggleVocalBoost={handleToggleVocalBoost}
        onOpenStageMode={() => setIsStageModeOpen(true)}
        onToggleBookmark={handleToggleBookmark}
        onOpenNotes={handleOpenNotes}
      />

      {/* Upload and AI Sync Modal */}
      <UploadAndSyncModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onTrackCreated={handleTrackCreated}
        proxyConfig={proxyConfig}
        onOpenProxySettings={() => setIsProxySettingsOpen(true)}
        theme={theme}
      />

      {/* Add Other Maddah Poem Modal */}
      <AddOtherMaddahPoemModal
        isOpen={isAddOtherMaddahOpen}
        onClose={() => setIsAddOtherMaddahOpen(false)}
        onTrackCreated={handleTrackCreated}
        theme={theme}
      />

      {/* Personal Notes Modal */}
      <PersonalNotesModal
        isOpen={isNotesModalOpen}
        track={trackForNotes}
        onClose={() => setIsNotesModalOpen(false)}
        onSaveNotes={handleSavePersonalNotes}
        theme={theme}
      />

      {/* Proxy Settings Modal (OpenAI Architecture) */}
      <ProxySettingsModal
        isOpen={isProxySettingsOpen}
        onClose={() => setIsProxySettingsOpen(false)}
        onSave={handleSaveProxyConfig}
        currentConfig={proxyConfig}
        theme={theme}
      />

      {/* Sync Editor Modal */}
      <SyncEditorModal
        isOpen={isSyncEditorOpen}
        track={trackToEdit}
        currentPlaybackTime={currentTime}
        onClose={() => setIsSyncEditorOpen(false)}
        onSaveTrack={handleSaveTrackChanges}
        onSeekTo={handleSeek}
        theme={theme}
      />

      {/* Fullscreen Stage / Menbar Mode */}
      <StageModeModal
        isOpen={isStageModeOpen}
        track={activeTrack}
        currentTime={currentTime}
        duration={duration}
        activeLineIndex={activeLineIndex}
        isPlaying={isPlaying}
        onClose={() => setIsStageModeOpen(false)}
        onTogglePlay={() => handleTogglePlay()}
        onSeekToLine={handleSeekToLine}
        onNextVerse={handleNextVerse}
        onPrevVerse={handlePrevVerse}
        onToggleLoopLine={handleToggleLoopLine}
        isLooping={Boolean(loopRange)}
        theme={theme}
      />

      {/* Google Drive Token Sync Modal */}
      <GoogleDriveSyncModal
        isOpen={isGoogleDriveOpen}
        onClose={() => setIsGoogleDriveOpen(false)}
        onTracksImported={handleTracksImported}
        tracks={tracks}
        onRestoreData={handleRestoreData}
        theme={theme}
      />

      {/* Backup & Restore Modal (JSON Backup) */}
      <BackupRestoreModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        tracks={tracks}
        proxyConfig={proxyConfig}
        onRestoreData={handleRestoreData}
        theme={theme}
      />

      {/* انتخاب فایل صوتی از گوشی (پنهان؛ با دکمهٔ «انتخاب صوت» باز می‌شود) */}
      <input
        ref={audioPickerRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac"
        className="hidden"
        onChange={handleAudioPicked}
      />

      {/* پیام کوتاه وضعیت */}
      {notice && (
        <div className="fixed bottom-28 inset-x-3 z-50 flex justify-center pointer-events-none">
          <div
            role="status"
            className={`max-w-md w-full text-xs leading-relaxed font-medium px-3.5 py-2.5 rounded-xl border ${
              isGreen
                ? 'bg-[#10201a] text-emerald-200 border-[#225732]'
                : 'bg-[#241313] text-red-200 border-[#572222]'
            }`}
          >
            {notice}
          </div>
        </div>
      )}
    </div>
  );
}
