# Integrasi dslrBooth → Self-Host

Bagian ini menjelaskan bagaimana **dslrBooth (app asli) diarahkan sepenuhnya ke replika
self-host**: foto masuk ke server kita, dan **QR share bawaan dslrBooth** (tombol
"QR code" di layar sharing) ikut menunjuk ke server kita — bukan ke `fotoshare.co`.

> Tidak ada pemalsuan validasi lisensi. Endpoint lisensi/login diteruskan utuh ke
> server asli. Yang diganti hanya **tujuan link** dan **penyimpanan foto**.

---

## Arsitektur

```
 dslrBooth
   │  ambil foto  ─────────────────────────────►  C:\dslrBooth\testing\...
   │                                                     │
   │  upload ke cloud (Ditolak: lisensi)                │ watcher (5 detik)
   │  → FileItems.UploadUrl = fotoshare.co/license-error │
   │                                                     ▼
   │                                            replika: backend/uploads + tabel photos
   │                                                     │
   │  "<QR> dibuat dari FileItems.UploadUrl"             │
   │            ▲                                        │
   │            └── backend rewriting tiap 0,8 detik ──┘
   │                (backend/src/boothShare.js)
   ▼
 QR berisi: http://<IP-LAN>:4000/gallery/<eventId>?session=<SessionNanoId>
   │
   ▼
 tamu pindai → Halaman galeri self-host (original + print + GIF/video), per sesi
```

### 3 komponen

| Komponen | File | Fungsi |
|---|---|---|
| **Importer** | `backend/src/booth.js` | Menyalin foto dari `C:\dslrBooth` ke `backend/uploads`, dedup via `photos.source_path`, menandai `photos.session_id` (dari `FileItems.SessionNanoId` di DB lokal dslrBooth) |
| **Share rewriter** | `backend/src/boothShare.js` | Menulis ulang `FileItems.UploadUrl` di DB lokal dslrBooth → link galeri self-host **per sesi**. Inilah yang membuat QR dslrBooth menunjuk ke server kita |
| **Jembatan MITM** | `bridge/proxy.js` | Proxy lokal yang meng-intersep `mobileapi.fotoshare.co` (opsional; berguna bila app memanggil `album/link`) |

---

## Mode yang dipakai

| Mode | Status | Keterangan |
|---|---|---|
| **Impor folder** | ✅ aktif | Foto masuk otomatis ke replika |
| **Rewrite link share** | ✅ aktif | QR dslrBooth → galeri self-host per sesi |
| **Tampilan QR statis di template** | ⏸ nonaktif | Sakelar: `%APPDATA%\dslrBooth\.lumabooth_screen_off` |
| **MITM proxy** | ⚙️ opsional | Butuh CA + proxy sistem (lihat `bridge/README.md`) |

---

## Menjalankan

### 1. Backend (wajib)
```powershell
cd "C:\Users\Fery\Documents\Default Project\lumabooth-replica\backend"
npm run dev
```
Output normal:
```
✅ API berjalan di http://localhost:4000
[booth] watcher aktif -> C:\dslrBooth (setiap 5000ms)
[screen] watcher QR layar aktif (...\AppData\Roaming\dslrBooth)
[share] rewriter link share aktif (...\dslrBooth\database_2025.db)
```

### 2. Frontend (opsional — untuk dasbor admin)
```powershell
cd "C:\Users\Fery\Documents\Default Project\lumabooth-replica\frontend"
npm run dev
```

### 3. Jembatan MITM (opsional)
Hanya perlu bila ingin ikut mengarahkan endpoint `album/link` / `guest.fotoshare.co`.
Lihat `bridge/README.md` (perlu `install-admin.ps1` sebagai Administrator).

---

## URL penting

| URL | Isi |
|---|---|
| `http://localhost:4000/gallery/5` | Galeri **sesi terbaru** (default) |
| `http://localhost:4000/gallery/5?session=<id>` | Galeri **sesi tertentu** ← ini yang dipakai QR dslrBooth |
| `http://localhost:4000/gallery/5?all=1` | Semua sesi |
| `http://localhost:4000/qr/5` | Halaman QR besar (bisa dicetak / ditampilkan) |
| `http://localhost:4000/booth` | Pintasan → halaman QR |
| `http://localhost:4000/api/booth/gallery-url` | JSON URL galeri yang dipakai bridge |

Dari HP (harus satu jaringan/WiFi):
`http://192.168.27.100:4000/gallery/5?session=...`

---

## Catatan operasional

- **Firewall:** Windows Firewall di profil ini nonaktif, jadi port 4000 bisa diakses
  dari LAN. Jika mengaktifkan firewall, izinkan inbound TCP 4000.
- **dslrBooth harus dalam keadaan**: foto masuk ke `C:\dslrBooth` (lokasi `ImagesPath`).
  Kalau diganti, set `DSLRBOOTH_IMAGE_PATH`.
- **Penulisan DB lokal dslrBooth** dilakukan tiap 0,8 detik. dslrBooth sendiri
  menulis `UploadUrl` kembali ke URL error lisensi setiap upload, jadi rewrite
  harus berjalan terus (backend harus hidup).
- **Backups**: `app_settings_2021.json.bak*` dan template `template.orig.xml`.
- **Menonaktifkan patch tampilan layar**: buat file kosong
  `%APPDATA%\dslrBooth\.lumabooth_screen_off`.
