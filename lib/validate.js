// Small input cleaners for data sent by the boards.
export function num(v, min, max) {
  const n = Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) || n < min || n > max ? null : n;
}

export function str(v, maxLen) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, maxLen) : null;
}

// Board time is unix seconds. Reject times far in the future or older than 30 days.
export function boardTime(v) {
  const t = num(v, 1.5e9, 4e9);
  if (t === null) return null;
  const ms = t * 1000, now = Date.now();
  if (ms > now + 10 * 60e3 || ms < now - 30 * 86400e3) return null;
  return new Date(ms);
}
