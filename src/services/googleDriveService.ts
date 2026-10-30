/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
  enabled?: boolean;
}

export interface GoogleDriveAudioFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webContentLink?: string;
  webViewLink?: string;
}

export const DRIVE_CONFIG_STORAGE_KEY = 'tanin_google_drive_config_v1';

/**
 * Obtain a new Google OAuth access_token using the provided refresh_token, client_id, and client_secret.
 */
export async function getGoogleDriveAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('لطفاً شناسه مشتری (Client ID)، کلید مخفی (Client Secret) و توکن بازخوانی (Refresh Token) را به طور کامل وارد کنید.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      refresh_token: refreshToken.trim(),
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let errorMsg = errText;
    try {
      const errJson = JSON.parse(errText);
      errorMsg = errJson.error_description || errJson.error || errText;
    } catch {
      // ignore
    }
    throw new Error(`خطا در احراز هویت با توکن گوگل (HTTP ${response.status}): ${errorMsg}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('پاسخ سرور گوگل شامل access_token معتبر نبود.');
  }

  return data.access_token;
}

/**
 * Fetch a list of audio files from the specified Google Drive folder ID.
 */
export async function fetchGoogleDriveAudioFiles(
  accessToken: string,
  folderId: string
): Promise<GoogleDriveAudioFile[]> {
  if (!accessToken) {
    throw new Error('توکن دسترسی (Access Token) نامعتبر است.');
  }
  if (!folderId) {
    throw new Error('آشناسه پوشه (Folder ID) گوگل درایو وارد نشده است.');
  }

  const cleanFolderId = folderId.trim();
  // Query to find audio files inside the folder or subfolders
  const query = encodeURIComponent(`'${cleanFolderId}' in parents and (mimeType contains 'audio/' or mimeType = 'application/vnd.google-apps.folder')`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,webContentLink,webViewLink)&pageSize=100`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`خطا در دریافت لیست فایل‌ها از گوگل درایو (HTTP ${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const files = data.files || [];
  
  // Filter for audio files
  return files.filter((f: any) => f.mimeType && (f.mimeType.includes('audio') || f.mimeType.includes('mp3') || f.mimeType.includes('m4a') || f.mimeType.includes('wav')));
}

// ---------------------------------------------------------------------------
// دسترسی مستقیم به Google Drive از خود برنامه (بدون نیاز به سرور)
// ---------------------------------------------------------------------------

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export const BACKUP_FILE_NAME = 'tanin_maddahi_backup.json';
export const BACKUP_AUDIO_PREFIX = 'audio__';

async function driveError(response: Response, action: string): Promise<Error> {
  const text = await response.text().catch(() => '');
  let msg = text.slice(0, 220);
  try {
    const j = JSON.parse(text);
    msg = j?.error?.message || j?.error_description || msg;
  } catch {
    // ignore
  }
  let hint = '';
  if (response.status === 401) hint = ' (توکن منقضی یا نامعتبر است)';
  if (response.status === 403) hint = ' (مجوز توکن کافی نیست؛ برای پشتیبان‌گیری دسترسی نوشتن در درایو لازم است)';
  if (response.status === 404) hint = ' (پوشه یا فایل پیدا نشد؛ آیدی پوشه را بررسی کنید)';
  return new Error(`${action} ناموفق بود (HTTP ${response.status})${hint}: ${msg}`);
}

function networkError(e: any): Error {
  if (e instanceof Error && /HTTP \d+/.test(e.message)) return e;
  return new Error('اتصال به اینترنت یا گوگل برقرار نشد. اتصال را بررسی کنید.');
}

/** فهرست همهٔ فایل‌های داخل پوشه (غیر پوشه‌ها)، با پشتیبانی از چند صفحه. */
export async function listDriveFolderFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const all: DriveFile[] = [];
  let pageToken = '';
  try {
    for (let page = 0; page < 10; page++) {
      const q = encodeURIComponent(
        `'${folderId.trim()}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`
      );
      const url =
        `${DRIVE_API}/files?q=${q}&pageSize=200&orderBy=modifiedTime%20desc` +
        `&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw await driveError(res, 'دریافت فهرست فایل‌ها');
      const data = await res.json();
      all.push(...((data.files || []) as DriveFile[]));
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }
  } catch (e) {
    throw networkError(e);
  }
  return all;
}

export function isAudioDriveFile(f: DriveFile): boolean {
  const name = (f.name || '').toLowerCase();
  return (
    (f.mimeType || '').startsWith('audio/') ||
    /\.(mp3|m4a|aac|wav|ogg|opus|flac)$/.test(name)
  );
}

/** دانلود فایل با توکن (آدرس عمومی alt=media بدون توکن کار نمی‌کند). */
export async function downloadDriveFile(accessToken: string, fileId: string): Promise<Blob> {
  try {
    const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw await driveError(res, 'دانلود فایل');
    return await res.blob();
  } catch (e) {
    throw networkError(e);
  }
}

/** آپلود فایل جدید یا جایگزینی محتوای یک فایل موجود. */
export async function uploadDriveFile(
  accessToken: string,
  folderId: string,
  name: string,
  mimeType: string,
  blob: Blob,
  existingId?: string
): Promise<DriveFile> {
  try {
    if (existingId) {
      const res = await fetch(
        `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(existingId)}?uploadType=media&fields=id,name,mimeType,size`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': mimeType },
          body: blob,
        }
      );
      if (!res.ok) throw await driveError(res, 'به‌روزرسانی فایل در درایو');
      return await res.json();
    }

    const boundary = `maddahi${Date.now()}x`;
    const meta = JSON.stringify({ name, parents: [folderId.trim()] });
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      blob,
      `\r\n--${boundary}--`,
    ]);
    const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,size`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) throw await driveError(res, 'ارسال فایل به درایو');
    return await res.json();
  } catch (e) {
    throw networkError(e);
  }
}
