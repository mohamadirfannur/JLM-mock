export const fmt = (n: number | undefined | null, d = 0) => (n ?? 0).toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });
export const idr = (n: number) => "IDR " + fmt(Math.round(n));
export const idrShort = (n: number) => {
  if (n >= 1e12) return `Rp ${(n / 1e12).toFixed(2)} T`;
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(2)} M`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(1)} jt`;
  return "Rp " + fmt(n);
};
export const meters = (m: number) => (m >= 1000 ? `${fmt(m / 1000, 2)} km` : `${fmt(m)} m`);
export const area = (m2: number) => (m2 >= 1e6 ? `${fmt(m2 / 1e6, 2)} km²` : `${fmt(m2)} m²`);
export const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
export const nowStr = () => new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

/** Stable pseudo "last update" label derived from an id (so lists don't all say "baru saja"). */
export function relTime(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const opts = ["Hari ini", "2 jam lalu", "5 jam lalu", "Kemarin", "2 hari lalu", "3 hari lalu", "5 hari lalu", "1 minggu lalu", "2 minggu lalu"];
  return opts[h % opts.length];
}
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const m2 = (v: number) => area(v);
