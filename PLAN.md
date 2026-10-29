# JLM Mock — Plan End-to-End Journey

Target: demo klikable (semua data dummy) untuk JLM, deploy ke Vercel. Deadline: **Jumat, 30 Okt 2026**.
Modul: **FTTH Auto-Design**, **Asset Management (OSP)**, **Market Potential**.

## Sumber referensi
- Flow & struktur UI: repo `ahmadmmi/surge` (Nuxt 3 + MapLibre + Tailwind). Dicopy pola UX-nya, bukan backend-nya.
  - Login → Hero (pilih Business Planning / Operation) → Landing modul → `/map/[modul]`
  - Layout peta: navbar atas, panel kiri (Project / Layer), panel kanan (Analysis / Detail / Attribute), legend.
- Kebutuhan JLM: Kuesioner Onboarding v1.0 + MoM 13 Okt 2026.
- Design: Figma (versi putih / light). Token yang ada cuma bisa baca library (HeroUI kit + icon), belum bisa baca screen.

## Angka standar JLM (dipakai sebagai default parameter FTTH)
| Parameter | Nilai JLM |
|---|---|
| Jarak max ODP → rumah | 250 m |
| Kapasitas ODP | 16 rumah |
| Jarak antar tiang | max 60 m |
| Tiang | T7 1-stage (lingkungan), T7 2-stage (jalan utama backbone/feeder), T9 2-stage (crossing) |
| ODC | 24C → 16 ODP, 48C → 36 ODP |
| Radius ODP → ODC | max 1000 m (sekali tarikan distribusi) |
| Kabel | Backbone 96–288c, Feeder 48–96c, Sub-feeder 24–48c, Distribusi 12–24c |
| Instalasi | Aerial + underground (kombinasi) |
| Coil | 350 m (feeder), 500 m (backbone); JC tiap 3500 m |
| Area proyek | per RW / per cluster perumahan (upload KML/KMZ/SHP atau gambar) |
| Skenario | Plan 100% (core masa depan), build awal ikut penetrasi 30% / 50% |
| Output | KML, DWG, PDF, Excel (BOQ/BOM) |
| Kode aset | contoh `BDG-F4599.48 (Feed GENOVA SUMMARECON BANDUNG_350M)` |
| Jenis aset | Pasif: OTB, OLT, ODC, ODP, Pole, Kabel, SS, JC, ONT · Aktif: OLT, Mikrotik, Switch, Juniper, Inverter, Rack server |

Catatan MoM: **aset point harus bisa dihapus** (bukan cuma dipindah) — wajib ada di mock.

## Stack
- Nuxt 3 (sama kayak surge) + Tailwind + MapLibre GL + @mapbox/mapbox-gl-draw + turf.
- Basemap light gratis (CARTO Positron / OpenFreeMap), tanpa API key.
- Data dummy: GeoJSON statis di `/public/data` + state Pinia (persist localStorage biar edit kerasa nyata).
- Deploy: `nuxt generate` (static) → Vercel.
- Lokasi dummy: Bandung (Summarecon Bandung / Gedebage) biar nyambung sama contoh kode aset JLM.

## Journey end-to-end (alur demo)
1. **Login** (dummy, akun apa aja masuk) → **Home** pilih modul.
2. **Market Potential**: filter Provinsi/Kota → peta hexagon skor potensi (Very Low–High) + POI + ISP kompetitor → klik area → ringkasan (jumlah rumah, penetrasi kompetitor, estimasi homepass) → tombol **"Buat Desain FTTH di area ini"**.
3. **FTTH Auto-Design**: Project baru (nama, area dari Market / upload KML / gambar polygon per RW-cluster) → parameter (default angka JLM, bisa diubah) → OLT (pakai existing / auto bottom-up) → animasi "Generating..." → hasil di peta: homepass, ODP, ODC, tiang, kabel per tipe, JC & coil + kode otomatis → summary + skenario penetrasi 30/50/100% → edit manual (geser/hapus/tambah) → **BOQ/BOM** + biaya → export (KML/PDF/Excel/DWG dummy download) → **"Kirim ke Asset Management"**.
4. **Asset Management**: semua aset existing + hasil desain (status Planned → Installed) → layer & legend per jenis aset → klik aset → detail (atribut, kapasitas terpakai ODP/ODC, histori, attachment) → tambah / pindah / **hapus** aset → tabel aset + filter → import KML/Excel (mock) → laporan (kapasitas terpakai, material aktual & segmen kabel terpasang).

## Batch kerja
**Batch 0 — Fondasi (± 2–3 jam)**
- Scaffold Nuxt 3, Tailwind token light theme (warna dari Figma kalau akses dapet, fallback palet surge versi putih).
- Layout: navbar, login dummy, home/pilih modul, shell halaman peta (panel kiri/kanan/legend).
- Peta dasar + layer loader GeoJSON. Push ke GitHub + setup Vercel.

**Batch 1 — FTTH Auto-Design (prioritas utama)**
- Data dummy: 2 cluster (mis. Summarecon Bandung cluster A, 1 RW Gedebage) hasil desain pre-baked.
- Wizard project, draw/upload AOI, form parameter JLM, OLT start point, progress, layer hasil, summary, skenario penetrasi.
- Area custom (digambar sendiri) → generator dummy sederhana di browser (sebar rumah, cluster 16/ODP, snap ke jalan kasar).
- Edit manual (geser, hapus, tambah), BOQ/BOM table + biaya, export dummy.

**Batch 2 — Asset Management**
- Dataset aset Bandung (OLT/ODC/ODP/pole/kabel/JC/ONT + aktif).
- Layer panel, legend, filter, popup, panel detail, kapasitas port.
- Add / move / delete aset (MoM), tabel aset, import mock, laporan.
- Terima "kiriman" dari FTTH (aset Planned).

**Batch 3 — Market Potential**
- Hexgrid skor potensi, POI, ISP kompetitor, filter wilayah, summary panel.
- Tombol lanjut ke FTTH bawa polygon area.

**Batch 4 — Polish & demo**
- Mode "Demo guide" (step-by-step tooltip alur), loading state, empty state, konsistensi Figma.
- QA seluruh flow, deploy final, script demo singkat.

## Status (29 Okt 2026)
- [x] Batch 0 — Fondasi (Nuxt 3 + MapLibre/MapTiler, login, dashboard, landing, shell peta)
- [x] Batch 1 — FTTH Auto-Design (engine bottom-up di browser + wizard + BOQ/BOM + export + edit manual)
- [x] Batch 2 — Asset Management (CRUD + pindah/hapus + kabel + tiang + import + laporan + activity log)
- [x] Batch 3 — Market Potential (digitize/upload/buffer/select, summary POI/AOI/Footprint, revenue)
- [x] Integrasi Market → FTTH → Asset (Planned → As-built)
- [x] Batch 4 — Redesain penuh mengikuti Figma JLM - Map Planner (Light): navbar + sidebar, Dashboard, Proyek, Filter Lokasi, Map Content, Processing Queue, BOQ & BOM, Pengguna, Pengaturan

Catatan: modul tampil di halaman masing-masing (`/map/market-potential`, `/map/ftth`, `/map/asset-management`) mengikuti pola surge.

## Open questions
- Akses Figma: token sekarang tidak punya scope `file_content:read` → screen belum bisa dibaca.
- Nama produk di UI: Cartogram / RAIAGrid?
- Urutan batch kalau waktu mepet: FTTH → Asset → Market (usulan).
