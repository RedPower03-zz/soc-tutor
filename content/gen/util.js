// Shared helpers for generators that pick distractors from fact tables.

/** Picks k items from `pool` whose text length is close to `answer`'s, with some randomness. */
export function closeLen(r, answer, pool, k = 3, text = (x) => x) {
  const target = text(answer).length;
  const cands = r.shuffle(pool.filter((p) => text(p) !== text(answer)));
  cands.sort((a, b) => Math.abs(text(a).length - target) - Math.abs(text(b).length - target));
  return r.sample(cands.slice(0, Math.max(k + 2, Math.ceil(cands.length / 2))), k);
}

export const fmt = (n) => n.toLocaleString('en-US');

// Minimal, dependency-free encoders (the app runs in the browser without Buffer).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}
export const asciiBytes = (s) => [...s].map((ch) => ch.charCodeAt(0) & 0xff);
export const utf16leBytes = (s) => [...s].flatMap((ch) => [ch.charCodeAt(0) & 0xff, ch.charCodeAt(0) >> 8]);
export const hex = (bytes) => bytes.map((b) => b.toString(16).padStart(2, '0')).join('');

/** Registrable ("organisational") domain for the reserved example namespaces used here. */
export const orgDomain = (d) => d.toLowerCase().split('.').slice(-2).join('.');
