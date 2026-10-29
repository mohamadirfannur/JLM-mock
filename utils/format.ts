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
