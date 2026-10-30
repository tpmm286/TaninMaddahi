/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * در نسخهٔ اندروید سرور Express وجود ندارد؛ بنابراین آدرس سرور (اختیاری) برای
 * قابلیت‌های هوشمند (استخراج متن با هوش مصنوعی، گوگل درایو) از اینجا خوانده می‌شود.
 * در نسخهٔ وب (همان‌سرور) مقدار خالی است و مسیرهای نسبی مثل قبل کار می‌کنند.
 */

export const API_BASE_STORAGE_KEY = 'tanin_maddahi_api_base';

export function isNativeApp(): boolean {
  try {
    const cap = (window as any).Capacitor;
    return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  } catch {
    return false;
  }
}

export function getApiBase(): string {
  try {
    const saved = localStorage.getItem(API_BASE_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
  } catch {
    // ignore
  }
  const fromBuild = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  return (fromBuild || '').trim().replace(/\/+$/, '');
}

export function setApiBase(value: string): void {
  try {
    const v = value.trim().replace(/\/+$/, '');
    if (v) localStorage.setItem(API_BASE_STORAGE_KEY, v);
    else localStorage.removeItem(API_BASE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function apiUrl(path: string): string {
  return `${getApiBase()}${path}`;
}
