# JLM Map Planner — Clickable Mock

Prototype end-to-end untuk JLM (IDTek / Cartogram). **Semua data dummy**, semuanya jalan di browser (tanpa backend).

Modul:
- **Market Potential Analysis** (`/map/market-potential`) — hitung jumlah rumah dari AOI (Digitize / Upload KML-KMZ-GeoJSON-SHP / Buffer / Select by Location), kelas rumah, harga, carport, daya listrik, kompetitor ISP, POI, estimasi pelanggan & revenue.
- **FTTH Auto-Design** (`/map/ftth`) — wizard 5 langkah (Project → Area → Analysis + parameter standar JLM → OLT → Generate), hasil desain di peta (ODP, ODC, OLT, kabel per tipe, tiang T7/T9, coil, JC, drop), skenario penetrasi 30/50/100%, edit manual (pindah / hapus), BOQ/BOM, export KML / DXF(DWG) / PDF / Excel / GeoJSON / CSV, kirim ke Asset Management.
- **Asset Management** (`/map/asset-management`) — site point & aset pasif/aktif (OTB, OLT, ODC, ODP, Pole, SS, JC, ONT, Mikrotik, Switch, Juniper, Inverter, Rack), tambah / edit / **pindah / hapus**, kabel & route (auto ikut jalan), generate tiang, core config, import KML/Excel, edit atribut massal via Excel, tabel aset, laporan kapasitas ODP/ODC & material terpasang, activity log, as-built dari desain FTTH.

## Alur demo (± 10 menit)
1. Login (akun demo sudah terisi) → Dashboard → Business Planning → **Market Potential**.
2. Toolbar bawah **Insight Analysis → Potential Analysis** → klik *Analyze* pada cluster teratas (atau **Analytic Tools → Digitize** dan gambar AOI sendiri).
3. Di **Analysis Result** lihat jumlah rumah, kompetitor, revenue → klik **Design FTTH untuk AOI ini**.
4. Wizard FTTH sudah terisi → Next sampai **Generate Network** → lihat hasil, ganti skenario 30/50/100%, tab **BOQ / BOM**, tab **Export**.
5. Project → Active → ikon pensil (**Edit Site Points**) → klik ODP → Pindah / Hapus.
6. **Kirim ke Asset Management** → *Buka Asset Management* → aset Planned (ring kuning) → klik aset → detail, port, Delete → Activity Log → Asset Summary → *Set As-built*.

Menu ☰ → **Reset Demo Data** untuk mengulang dari awal.

## Development
```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # Vercel: framework preset Nuxt, tanpa env var
```
MapTiler key ada di `nuxt.config.ts` (bisa di-override `NUXT_PUBLIC_MAPTILER_KEY`).

Data area Gedebage–Rancasari, Bandung dibangun dari OpenStreetMap (jalan, bangunan, POI) dengan atribut sintetis:
`node scripts/build-data.mjs <folder raw OSM>` → `public/data/*`. Lihat `PLAN.md` untuk standar desain JLM yang dipakai.
