// Small input cleaners for data sent by the boards.
export function num(v, min, max) {
  // only real numbers or numeric strings (Number(true) = 1, Number([5]) = 5 would sneak through)
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = Number(v);
  return v === "" || !Number.isFinite(n) || n < min || n > max ? null : n;
}

// whole numbers only (alert levels 0/1/2): 1.5 would break the integer column
export function int(v, min, max) {
  const n = num(v, min, max);
  return n !== null && Number.isInteger(n) ? n : null;
}

// request body that must be a JSON object ({}), never null / a number / a list
export function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

export function str(v, maxLen) {
  if (v === null || v === undefined || typeof v === "object") return null;
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
