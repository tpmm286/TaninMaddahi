// تنظیمات تکمیلی پروژهٔ اندروید که Capacitor می‌سازد (بعد از `npx cap add android` اجرا می‌شود).
// چند بار اجرا شدن آن بی‌ضرر است.
import fs from 'node:fs';
import path from 'node:path';

const androidDir = path.resolve('android');
if (!fs.existsSync(androidDir)) {
  console.error('پوشهٔ android پیدا نشد؛ ابتدا `npx cap add android` را اجرا کنید.');
  process.exit(1);
}

// ---------- AndroidManifest.xml ----------
const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');

const addBeforeManifestEnd = (line, marker) => {
  if (!manifest.includes(marker)) {
    manifest = manifest.replace('</manifest>', `    ${line}\n</manifest>`);
  }
};

// ضبط صدا با میکروفون (قابلیت ضبط مستقیم در برنامه)
addBeforeManifestEnd(
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
  'android.permission.RECORD_AUDIO'
);
addBeforeManifestEnd(
  '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
  'android.permission.MODIFY_AUDIO_SETTINGS'
);
// میکروفون اجباری نباشد تا برنامه روی همهٔ دستگاه‌ها نصب شود
addBeforeManifestEnd(
  '<uses-feature android:name="android.hardware.microphone" android:required="false" />',
  'android.hardware.microphone'
);

// اجازهٔ آدرس http برای سرور شخصی کاربر
if (!manifest.includes('usesCleartextTraffic')) {
  manifest = manifest.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
}

// کیبورد روی کادرهای ورودی پنجره‌ها را نپوشاند
if (!manifest.includes('windowSoftInputMode')) {
  manifest = manifest.replace('<activity', '<activity\n            android:windowSoftInputMode="adjustResize"');
}

fs.writeFileSync(manifestPath, manifest);
console.log('AndroidManifest.xml به‌روزرسانی شد.');

// ---------- نسخه‌ی برنامه (برای به‌روزرسانی روی نسخهٔ قبلی) ----------
const run = parseInt(process.env.GITHUB_RUN_NUMBER || '1', 10) || 1;
const gradlePath = path.join(androidDir, 'app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${run}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "1.0.${run}"`);
fs.writeFileSync(gradlePath, gradle);
console.log(`versionCode=${run} versionName=1.0.${run}`);

// ---------- حداقل نسخهٔ اندروید: ۷ یا پایین‌تر ----------
const varsPath = path.join(androidDir, 'variables.gradle');
if (fs.existsSync(varsPath)) {
  let vars = fs.readFileSync(varsPath, 'utf8');
  vars = vars.replace(/minSdkVersion\s*=\s*(\d+)/, (full, v) =>
    parseInt(v, 10) > 24 ? 'minSdkVersion = 24' : full
  );
  fs.writeFileSync(varsPath, vars);
  console.log((vars.match(/minSdkVersion\s*=\s*\d+/) || [''])[0]);
}
