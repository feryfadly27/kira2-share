# LumaBooth Bridge

Jembatan agar **QR share bawaan dslrBooth** menunjuk ke **server self-host** Anda,
bukan ke `fotoshare.co`.

## Cara kerja

```
dslrBooth ──HTTPS──> mobileapi.fotoshare.co/mobileapi/album/link?event_id=…
                       │
                       ▼ (di-intersep bridge)
              { "success": true, "url": "http://<IP-LAN>:4000/gallery/<id>" }
                       │
                       ▼
        dslrBooth meng-encode URL itu ke QR code
                       │
                       ▼
        tamu memindai QR → http://<IP-LAN>:4000/gallery/<id>
                       │
                       ▼
        galeri replika: original + GIF + video + hasil print
```

Foto diambil dari **disk lokal dslrBooth** oleh `backend/src/booth.js` (watcher),
jadi tidak bergantung pada upload cloud sama sekali.

> **Tidak ada pemalsuan lisensi.** Semua endpoint lain (login, `validate_subscription`,
> upload) diteruskan **utuh** ke server asli. Yang diubah hanya *tujuan link share*.

## Instalasi (sekali saja)

1. Jalankan **`install-admin.ps1` sebagai Administrator** (klik kanan → Run with PowerShell).
   - Memasang CA bridge ke *Trusted Root* (akan muncul dialog sertifikat → pilih **Yes**).
   - Mengaktifkan proxy sistem → `127.0.0.1:8888`.
2. Jalankan bridge:
   ```powershell
   cd bridge
   node proxy.js
   ```
3. Jalankan backend replika:
   ```powershell
   cd ..\backend
   node src/server.js
   ```
4. **Tutup lalu buka ulang dslrBooth** (butuh restart agar CA baru dipercaya).

## Ransomware / pembatalan

```powershell
.\uninstall-admin.ps1   # sebagai Administrator
```
Menghapus CA dari Trusted Root dan mematikan proxy sistem.

## Catatan teknis

- Hanya host dalam `INTERCEPT_HOSTS` yang di-MITM. Host lain di-*tunnel* apa adanya
  (byte murni) sehingga browser & aplikasi lain tidak terpengaruh.
- Bridge Generate sertifikat leaf per host dan menandatanganinya dengan CA.
- Port bridge: `8888` (bisa diubah via `BRIDGE_PORT`).
- Backend yang dibaca bridge: `http://127.0.0.1:4000` (`BRIDGE_BACKEND`).
- Kalau server Anda bukan di `4000`/bukan `localhost`, set `BRIDGE_BACKEND`.
- Untuk URL publik (mis. lewat domain), set `PUBLIC_BASE_URL` di backend
  (mis. `https://foto.example.com`) agar QR memakai domain tersebut.
