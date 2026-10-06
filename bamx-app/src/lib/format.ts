const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtKg(n?: number | null) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${Math.round(n * 10) / 10} kg`;
}

/** "AAAA-MM-DD HH:MM" in local time, for editable text fields. */
export function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parses "AAAA-MM-DD HH:MM" (local) → ISO string, or null if invalid. */
export function parseLocalInput(s: string): string | null {
  const m = s.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (isNaN(d.getTime()) || d.getMonth() !== +m[2] - 1) return null;
  return d.toISOString();
}

/** Validates "AAAA-MM-DD" → same string or null. */
export function parseDateOnly(s: string): string | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(d.getTime()) || d.getMonth() !== +m[2] - 1) return null;
  return s.trim();
}

export function isToday(iso?: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function num(s: string): number | null {
  const v = parseFloat(s.replace(',', '.'));
  return isNaN(v) || !isFinite(v) ? null : v;
}

/** Text limits (MASVS-CODE-4). */
export const MAX = { short: 120, address: 300, long: 1000 };

/**
 * Normalizes untrusted free text before it is stored (MASVS-CODE-4):
 * removes control characters and HTML angle brackets, collapses whitespace, enforces a max length.
 * React Native renders text as plain text (no HTML), and AppSync stores it as a typed String,
 * so this is defense in depth for any future web dashboard or CSV export.
 */
export function cleanText(s: string | null | undefined, max = MAX.short): string {
  return (s ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

/** RFC4122 v4 id; react-native-get-random-values provides crypto.getRandomValues. */
export function uuid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
