# LumaBooth Replica (lokal)

Replika lokal struktur dashboard **LumaBooth / Fotoshare** — dibangun dari hasil analisis
arsitektur (route, auth flow, API) memakai REA. Ini proyek **belajar**, bukan salinan kode asli.

> Catatan: hanya untuk belajar arsitektur. Jangan menyalin aset/brand/kode berhak cipta asli.

## Stack
- **Backend:** Express + JWT + `node:sqlite` (SQLite bawaan Node 22.5+/24) — menggantikan `fotoshare.co/api`
- **Frontend:** React 18 + Vite + React Router — semua route `/admin` terpetakan

## Tampilan (UI)
Seluruh antarmuka memakai **gaya neo-brutal / editorial cetak** — konsisten antara
admin (`frontend/src/styles.css`) dan halaman publik (`backend/src/views.js`):

- Palet **kertas `#F2EFE8`** + **tinta `#16130F`** + satu aksen **oranye `#FF3B00`**
  (tambahan: kuning `#FFD400` untuk status, hijau `#1F9D55` untuk aktif)
- Garis **2px**, sudut tajam, **bayangan keras** (offset, tanpa blur)
- Judul pakai sans tebal; label/angka/tabel pakai **mono** uppercase
- Tanpa gradien, tanpa emoji, tanpa efek kaca
- Responsif & mobile-first: sidebar jadi bar horizontal, grid 2 kolom,
  target sentuh ≥ 34px. Diuji otomatis (lihat `bridge/mobile-check.js`)

## Prasyarat
- Node.js 24 (sudah ada di komputer Anda)

## Menjalankan

Buka **2 terminal**.

### Terminal 1 — Backend (port 4000)
```powershell
cd "C:\Users\Fery\Documents\Default Project\kira2-share\backend"
npm install        # sekali saja
npm run seed       # buat user demo + event contoh (sekali saja)
npm run dev        # atau: npm start
```

### Terminal 2 — Frontend (port 5173)
```powershell
cd "C:\Users\Fery\Documents\Default Project\kira2-share\frontend"
npm install        # sekali saja
npm run dev
```

Lalu buka **http://localhost:5173** di browser.

## Login demo
- **Email:** `demo@local`
- **Password:** `demo1234`

(Atau daftar akun baru lewat tombol "Daftar" di halaman login.)

## Yang sudah berjalan
- ✅ Auth JWT (register + login), mirip pola custom-token asli
- ✅ Route `/admin` lengkap terpetakan (sidebar + protected route)
- ✅ CRUD Event (buat, lihat, ubah status, hapus) + halaman analytics
- ✅ Dashboard dengan stats, langganan, akun, pengaturan
- ✅ Halaman lain tampil sebagai placeholder (tinggal diisi)

## Struktur
```
kira2-share/
├── backend/
│   ├── src/server.js        # entry Express
│   ├── src/db.js            # skema SQLite (users, events)
│   ├── src/auth.js          # hash + JWT + middleware
│   ├── src/routes/user.js   # /api/user/*
│   ├── src/routes/event.js  # /api/event/*
│   └── src/seed.js          # data demo
└── frontend/
    └── src/
        ├── App.jsx          # semua route
        ├── auth.jsx         # AuthContext (JWT)
        ├── api.js           # fetch wrapper
        ├── layout/AdminLayout.jsx
        └── pages/           # Dashboard, Events, dll
```

## Langkah berikutnya (ide)
1. Tambah route/halaman experiences + editor foto (Konva)
2. Ganti chart placeholder dengan **Recharts**
3. Simpan foto ke folder lokal (pengganti Backblaze B2)
4. Tambah endpoint update profil & ganti password
5. Halaman billing (Stripe) bisa dipakai mode "sandbox"
