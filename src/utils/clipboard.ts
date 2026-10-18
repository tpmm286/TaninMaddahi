/** کپی مطمئن در WebView اندروید (با جایگزین در صورت رد شدن Clipboard API) */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* ادامه با روش جایگزین */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** زمان به شکل LRC استاندارد: [mm:ss.xx] */
export function lrcStamp(sec: number): string {
  const t = Math.max(0, Number(sec) || 0);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.min(99, Math.round((t - Math.floor(t)) * 100));
  const p = (n: number) => String(n).padStart(2, '0');
  return `[${p(m)}:${p(s)}.${p(cs)}]`;
}
