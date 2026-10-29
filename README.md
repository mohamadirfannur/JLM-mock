# JLM Network Planner

Prototype web untuk **PT Jala Lintas Media** — tampilan mengikuti Figma *JLM - Map Planner* (versi Light, font Exo 2 + Inter, warna cyan `#00D4FF` / purple `#7B2FFF`).
Semua data berjalan di browser (tanpa backend); jaringan jalan, bangunan, dan POI area Gedebage–Rancasari Bandung diambil dari OpenStreetMap, atribut aset & harga bersifat contoh.

## Struktur aplikasi
| Menu | Route | Isi |
|---|---|---|
| Login | `/` | Masuk (akun contoh sudah terisi) |
| Dashboard | `/dashboard` | KPI aset pasif/aktif, coverage FTTH, kualitas data, tabel aset, distribusi, proyek per RW, laporan segmen kabel |
| Proyek Jaringan | `/proyek` | Daftar proyek FTTH / MPLS / MW + Project Detail (mini map, *Add to Map*) |
| Peta · Asset Management | `/peta/asset` | Filter Lokasi → peta jaringan, Map Content, Map Tools (tambah sitepoint/kabel, pindah, edit atribut, generate tiang, core config, import, **hapus**), popup aset, detail & port, tabel, activity log |
| Peta · FTTH Auto-Design | `/peta/ftth` | Desain baru (upload KMZ/Excel/SHP, gambar polygon, pilih RW) → **Processing Queue** → *Generate & Insert to Cable* → hasil, BOQ/BOM, export, kirim ke inventaris |
| Peta · Planning Market | `/peta/market` | Pilih RW/cluster atau gambar/upload AOI → jumlah rumah, kelas rumah, kompetitor ISP, POI, revenue → *Buat Desain FTTH* |
| BOQ & BOM | `/boq-bom` | Laporan aktual material: rencana vs terpasang per RW/cluster, skenario 100/30/50%, export Excel/PDF/KML/DXF |
| Pengguna / Pengaturan | `/pengguna`, `/pengaturan` | Manajemen user, standar desain JLM, harga satuan, integrasi, reset data |

Di tiap peta, tombol **Fitur lain** (ikon grid di kanan) membuka *Map Dashboard* untuk pindah modul. Area yang dipilih di Filter Lokasi dipakai bersama oleh semua modul.

## Alur presentasi (± 10 menit)
1. Login → Dashboard.
2. Peta → **Filter Lokasi**: pilih *Cluster Perumahan C · Cisaranten Wetan* → *Terapkan Data* → klik ODC/ODP → popup → *Edit Aset* (port, edit, hapus).
3. Fitur lain → **Planning Market** → Filter Lokasi pilih *RW 07 Cipamokolan* → lihat jumlah rumah & potensi → *Buat Desain FTTH untuk area ini*.
4. Wizard FTTH (parameter standar JLM sudah terisi) → *Proses Desain* → pantau **Processing Queue** → *Generate & Insert to Cable* → Hasil Desain (skenario 30/50/100%, BOQ/BOM, Export) → *Kirim ke inventaris aset*.
5. Buka di Asset Management (aset status rencana, garis putus-putus) → Ringkasan → *Set As-built*.
6. **BOQ & BOM** → pilih cluster → rencana vs terpasang → Export.

Pengaturan → Data → *Reset ke kondisi awal* untuk mengulang presentasi.

## Development
```bash
cp .env.example .env      # isi NUXT_PUBLIC_MAPTILER_KEY
pnpm install
pnpm dev                  # http://localhost:3000
pnpm build                # Vercel: preset Nuxt + env NUXT_PUBLIC_MAPTILER_KEY
```
Data referensi dibangun ulang dengan `node scripts/build-data.mjs <folder raw OSM>` → `public/data/*`.
