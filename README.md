# JLM Network Planner

Prototype web untuk **PT Jala Lintas Media** — tampilan mengikuti Figma *JLM - Map Planner* (versi Light, font Exo 2 + Inter, warna cyan `#00D4FF` / purple `#7B2FFF`).
Semua data berjalan di browser (tanpa backend); jaringan jalan, bangunan, dan POI area Gedebage–Rancasari Bandung diambil dari OpenStreetMap, atribut aset & harga bersifat contoh.

## Struktur aplikasi
Setelah login, **Beranda** menampilkan dua grup (seperti surge): **Business Planning** (Market Potential Analysis, Assets Management) dan **Business Operation** (FTTH Mapping). Setiap modul berdiri sendiri — navbar & sidebar berganti sesuai modul, area Filter Lokasi disimpan per modul, dan tidak ada data yang dikirim antar modul.

| Modul | Halaman | Fungsi |
|---|---|---|
| **Market Potential Analysis** | `/market` Peta Analisis · `/market/laporan` | Hitung jumlah rumah dari AOI: **gambar polygon**, **upload KML/KMZ/GeoJSON/SHP**, buffer radius, klik RW/kelurahan. Hasil: kelas rumah, harga, carport, daya, jalan, kompetitor ISP, POI, revenue. **POI Insight** per kategori, **Route Analysis** POI → jaringan JLM terdekat, filter atribut, ranking potensi, export CSV/Excel/KML |
| **Assets Management** | `/asset` Dashboard · `/asset/inventaris` · `/asset/peta` · `/asset/boq-bom` | Buat & kelola aset: **Tambah Sitepoint**, **Add Asset** (serial, RFID, tag, tanggal, maintenance, attachment, port), **Tambah Kabel/Rute** (auto ikut jalan / manual), pindah, **hapus**, edit rute, **split kabel**, generate tiang, core config, edit atribut via Excel, import KML/Excel/GIS, **Site Points** (jump, preview, **Find Routes** R1/R2/R3 + BOQ), **Buffer kabel**, **BOQ & BOM polygon**, tabel aset, activity log, laporan kapasitas; BOQ & BOM aktual (rencana vs terpasang) |
| **FTTH Mapping** | `/ftth` Peta FTTH · `/ftth/proyek` · `/ftth/boq-bom` | Auto-design per RW/cluster (standar JLM), **Processing Queue** → *Generate & Insert to Cable*, hasil desain + skenario 30/50/100%, edit manual (pindah, hapus, **tambah ODP/tiang/JC**), export KML/DXF/PDF/Excel, finalisasi As-built, BOQ & BOM desain |

## Alur presentasi
1. Login → Beranda → **Business Planning → Market Potential**: Filter Lokasi pilih cluster atau *Gambar AOI* / *Upload AOI* → jumlah rumah & potensi → POI Insight → Route Analysis → Laporan Analisis.
2. Beranda → **Assets Management**: Dashboard → Peta Jaringan → Tambah Sitepoint → Add Asset → Tambah Kabel → Site Points → Find Routes → Generate BOQ/BOM → hapus aset → Activity Log → BOQ & BOM.
3. Beranda → **Business Operation → FTTH Mapping**: Desain Baru → Processing Queue → Generate & Insert → Hasil (BOQ, Export) → Edit (tambah/pindah/hapus) → Finalisasi → Daftar Proyek.

Pengaturan → Data → *Reset ke kondisi awal* untuk mengulang presentasi.

## Development
```bash
cp .env.example .env      # isi NUXT_PUBLIC_MAPTILER_KEY
pnpm install
pnpm dev                  # http://localhost:3000
pnpm build                # Vercel: preset Nuxt + env NUXT_PUBLIC_MAPTILER_KEY
```
Data referensi dibangun ulang dengan `node scripts/build-data.mjs <folder raw OSM>` → `public/data/*`.
