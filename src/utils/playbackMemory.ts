/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * به‌خاطر سپردن مکان پخش: آخرین اثر باز شده + ثانیهٔ توقف هر اثر.
 */

const POSITIONS_KEY = 'tanin_maddahi_positions_v1';
const LAST_TRACK_KEY = 'tanin_maddahi_last_track_v1';

export type PositionsMap = Record<string, number>;

export function loadPositions(): PositionsMap {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: PositionsMap = {};
    Object.keys(parsed).forEach((k) => {
      const v = Number(parsed[k]);
      if (isFinite(v) && v > 0) clean[k] = v;
    });
    return clean;
  } catch {
    return {};
  }
}

export function savePositions(map: PositionsMap): void {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function loadLastTrackId(): string | null {
  try {
    return localStorage.getItem(LAST_TRACK_KEY);
  } catch {
    return null;
  }
}

export function saveLastTrackId(id: string): void {
  try {
    localStorage.setItem(LAST_TRACK_KEY, id);
  } catch {
    // ignore
  }
}

/** موقعیت‌های خیلی نزدیک به ابتدا یا انتها ذخیره نمی‌شوند (یعنی «از اول»). */
export function isResumablePosition(time: number, duration?: number): boolean {
  if (!isFinite(time) || time < 2) return false;
  if (duration && isFinite(duration) && duration > 0 && time > duration - 3) return false;
  return true;
}
