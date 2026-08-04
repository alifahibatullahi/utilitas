# Menu Foto Critical/Maintenance — Apps Script (di dalam Spreadsheet)

Menu **📷 Upload Foto** di spreadsheet yang membuka **Web Utilitas Batubara** pada record yang
sedang dipilih, tempat operator meng-upload fotonya. Script ini sendiri **tidak
mengunggah apa pun** dan tidak butuh izin Google Drive.

## Alur operator

1. Isi baris critical/maintenance di spreadsheet seperti biasa. Kolom **Dokumentasi**
   masih kosong.
2. Klik salah satu sel di baris itu → menu **📷 Upload Foto → Upload foto baris terpilih**.
3. Dialog langsung muncul (kerangka dulu), lalu terisi empat penanda baris itu — sengaja
   dibuat besar supaya salah baris langsung ketahuan: **nama & nomor item + varian**,
   **uraian**, **scope**, dan **yang melaporkan** (di tab Maintenance: **foreman**).
   Tombolnya aktif begitu ringkasannya datang → **Buka web & upload foto**.
4. Web terbuka **langsung pada pop up record tersebut** → pilih/ambil foto → upload.
   Berlaku juga untuk baris yang kolom Dokumentasi-nya masih kosong: barisnya dikenali dari
   nomor baris + sidik jari isinya, jadi tidak perlu dicari lagi di daftar.
   Ini jalan di HP juga, karena upload-nya di web, bukan di dialog Apps Script.
5. Kolom **Dokumentasi** baris itu terisi otomatis: `📷 Foto (n)`, klik untuk kembali
   membuka galeri record tersebut. Kalau semua fotonya dihapus, selnya kosong lagi.

Kalau saat menu diklik tidak ada baris data yang jelas (masih di baris judul, atau tab
lain), web tetap dibuka — di daftar **Aktivitas Terbaru**, supaya operator bisa mencari
sendiri record yang baru dia isi.

## Isi folder ini

Kedua file di sini adalah **salinan versi-terkontrol** dari script yang dipasang langsung
di spreadsheet (container-bound):

- `Code.gs` — menu, penentuan baris terpilih, pembacaan kolomnya, pembentukan URL.
  Baris header dipindai ulang tiap kali menu diklik. Sempat di-cache (`CacheService`, 6 jam)
  demi kecepatan, lalu dibatalkan: kolom di sheet ini memang sesekali dipindah operator
  (Dokumentasi tab Maintenance pernah geser K → I), dan cache yang basi membuat dialog
  membaca kolom yang salah tanpa ada yang tahu. Ongkosnya cuma satu pembacaan 30 baris,
  sementara dialognya sendiri sudah tampil duluan.

  Nilai bawaan `APP_URL`/`CRITICAL_GID`/`MAINTENANCE_GID` ada di baris pertama berkas —
  Script Properties (`appUrl`, `criticalGid`, `maintenanceGid`) tetap menang bila diisi.
- `OpenWeb.html` — dialog ringkasan baris + pembuka tab. Dialog tampil lebih dulu lalu
  memanggil `getUploadTarget()`; sambil menunggu, ia juga memanggil `appUrl` sekali
  (`…/api/critical-maintenance/row?warm=1`) supaya server web sudah bangun saat tombolnya
  ditekan.

## Pasang

Dipasang di workbook **DATA OPERASIONAL** (`1qbN1nrpJmVJ_WY2YPGB4TCJixLrf5cwAyycqqHZC1mw`),
tab **Critical Equipment** (gid `317293896`) dan **Maintenance** (gid `1401715754`).

1. Buka spreadsheet → **Extensions → Apps Script**.
2. Ganti isi `Code.gs` di editor dengan isi `Code.gs` dari folder ini.
3. **File → + → HTML**, beri nama **`OpenWeb`** (tanpa `.html`), tempel isi
   `OpenWeb.html` dari folder ini.
4. **Save**, jalankan `onOpen` sekali (▶) untuk memicu otorisasi (hanya izin
   Spreadsheet), lalu **reload spreadsheet** → menu **📷 Upload Foto** muncul.

Cukup tempel; URL web dan kedua gid sudah jadi nilai bawaan di baris pertama `Code.gs`
(`APP_URL`, `CRITICAL_GID`, `MAINTENANCE_GID`). Kalau perlu menunjuk spreadsheet atau
lingkungan lain tanpa mengubah kode, isi **Project Settings → Script Properties** dengan
`appUrl` / `criticalGid` / `maintenanceGid` — properti selalu menang atas nilai bawaan.

⚠️ Kalau workbook ini sudah punya Apps Script sendiri, **jangan menimpa berkasnya**: satu
spreadsheet cuma punya satu project container-bound, dan `onOpen` yang terdefinisi dua kali
akan saling meniadakan. Tambahkan `Code.gs` ini sebagai berkas baru dan gabungkan isi
`onOpen`-nya.

### Kedua berkas sengaja tanpa komentar

Selain agar ringkas saat ditempel, ini menghilangkan satu jebakan: mesin template Apps Script
memindai **seluruh** berkas `.html`, termasuk bagian yang dikomentari — sebuah contoh
scriptlet yang ditulis di dalam komentar pun ikut dievaluasi dan memunculkan
`SyntaxError: Unexpected token ';'`. Satu-satunya scriptlet yang boleh ada di `OpenWeb.html`
adalah `JSON.stringify(appUrl)` yang force-print di awal `<script>`.

## Prasyarat di spreadsheet

- Kolom **`Dokumentasi`** sudah ada di kedua tab. Posisinya **dicari lewat nama header**,
  bukan huruf kolom, jadi boleh dipindah — per 4 Agustus 2026 di DATA OPERASIONAL ia ada di
  **K** (Critical Equipment) dan **I** (Maintenance), baris header di baris 2 pada keduanya.
  Setelah memindahkannya, tekan **"Perbarui data"** di web sekali: posisi kolom ikut disimpan
  di cermin dan dipakai saat menulis balik sel.
  Web yang mengisi & mengosongkan selnya; script ini tidak pernah menulisnya.
  Nama lama `Link Foto` masih dikenali, jadi sheet yang belum diganti tetap jalan.

  **Sel inilah identitas barisnya.** Di dalam formula `=HYPERLINK(...)`-nya tersimpan uid
  record tersebut. Karena kolomnya berada di tengah data operator, ia ikut berpindah saat
  baris disortir — itu sebabnya identitas ditaruh di sini, bukan di kolom terpisah.
  Jangan menyalin sel Dokumentasi dari satu baris ke baris lain: fotonya akan ikut.

- Kolom **`ID`** tidak ada di DATA OPERASIONAL, dan memang tidak perlu: sejak identitas
  pindah ke sel Dokumentasi, app tidak pernah menulis kolom itu lagi. Kalau di sheet lain
  masih ada, biarkan — dibaca hanya sebagai arsip pemulihan.

Cek kapan saja dengan `npx tsx scripts/check-critical-sheet.ts` di repo web — script itu
read-only dan melaporkan tab, baris header, posisi kolom `Dokumentasi`, jumlah baris
berfoto, serta baris yang uid-nya tidak cocok dengan isinya.

## Catatan

- Menu custom Apps Script **tidak muncul di aplikasi Google Sheets di HP** — itu batasan
  Google. Yang penting, tautan hasilnya bisa dibuka di HP dan upload foto dari kamera
  tetap jalan; operator lapangan cukup dikirimi tautannya, atau membuka
  `/critical-maintenance` langsung.
- Foto disimpan di Cloudflare R2 lewat API web, bukan di Google Drive — jadi tidak ada
  file yang membebani kuota Drive pribadi operator.
