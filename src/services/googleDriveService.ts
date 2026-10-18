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
