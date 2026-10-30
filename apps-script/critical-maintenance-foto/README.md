# Menu Foto Critical/Maintenance — Apps Script (di dalam Spreadsheet)

Menu **📷 Upload Foto** di spreadsheet yang membuka **Web Utilitas Batubara** pada record yang
sedang dipilih, tempat operator meng-upload fotonya. Script ini sendiri **tidak
mengunggah apa pun** dan tidak butuh izin Google Drive.

## Alur operator

1. Isi baris critical/maintenance di spreadsheet seperti biasa. Kolom **Dokumentasi**
   masih kosong.
2. Klik salah satu sel di baris itu → menu **📷 Upload Foto → Upload foto baris terpilih**.
3. **Tab web langsung terbuka** — tidak ada dialog ringkasan lagi. Pop up upload foto record
   itu sudah terisi begitu halaman tampil, karena isi barisnya (nama & nomor item, varian,
   uraian, tanggal) dititipkan di URL-nya. Web **tidak memanggil API apa pun** untuk record
   itu, dan spreadsheet tidak dibaca ulang.
4. Pilih/ambil foto → upload. Berlaku juga untuk baris yang kolom Dokumentasi-nya masih
   kosong: barisnya dikenali dari nomor baris + sidik jari isinya.
   Ini jalan di HP juga, karena upload-nya di web, bukan di dialog Apps Script.
5. Kolom **Dokumentasi** baris itu terisi otomatis: `📷 Foto (n)`, klik untuk kembali
   membuka galeri record tersebut. Kalau semua fotonya dihapus, selnya kosong lagi.
   Selnya ditulis **sesaat setelah** foto tersimpan, bukan seketika — jadi wajar kalau
   isinya baru muncul beberapa detik kemudian.

Menu ini **khusus untuk upload foto**. Ia tidak lagi ikut menyegarkan data
critical/maintenance di web; itu urusan tombol **"Perbarui data"** di halaman web dan cron.
Yang tersentuh saat upload hanyalah **item + uraian** baris tersebut; kolom lain (scope,
status, shift, foreman, …) menyusul pada pembaruan berikutnya.

Kalau saat menu diklik tidak ada baris data yang jelas (masih di baris judul, atau tab
lain), dialog kecil muncul menjelaskan sebabnya + tombol untuk membuka daftar record di web.
Dialog kecil itu juga muncul kalau browser menahan tab baru (popup blocker) — tombolnya
selalu berhasil karena diklik operator sendiri.

## Isi folder ini

Kedua file di sini adalah **salinan versi-terkontrol** dari script yang dipasang langsung
di spreadsheet (container-bound):

- `Code.gs` — menu, penentuan baris terpilih, pembacaan kolomnya, pembentukan URL.
  Baris header dipindai ulang tiap kali menu diklik. Sempat di-cache (`CacheService`, 6 jam)
  demi kecepatan, lalu dibatalkan: kolom di sheet ini memang sesekali dipindah operator
  (Dokumentasi tab Maintenance pernah geser K → I), dan cache yang basi membuat script
  membaca kolom yang salah tanpa ada yang tahu.

  Seluruh targetnya dihitung di **satu eksekusi** — tidak ada lagi `google.script.run`
  bolak-balik. Perjalanan ke backend Sheets ditekan seminimalnya: Script Properties dibaca
  sekali (`getProperties()`), `getLastRow()` tidak dipakai, dan formula sel Dokumentasi hanya
  dibaca kalau selnya memang berisi — dari puluhan ribu baris, hanya segelintir yang berfoto.

  Nilai bawaan `APP_URL`/`CRITICAL_GID`/`MAINTENANCE_GID` ada di baris pertama berkas —
  Script Properties (`appUrl`, `criticalGid`, `maintenanceGid`) tetap menang bila diisi.
- `OpenWeb.html` — pembuka tab, itu saja. Ia langsung `window.open(url)` lalu menutup dirinya
  sendiri; operator praktis tidak melihatnya. Kalau `window.open` mengembalikan null (browser
  menahan tab baru) atau barisnya tidak jelas, dialog tetap terbuka dengan satu tombol.

  Catatan: `window.open(url, '_blank', 'noopener')` **selalu** mengembalikan null — makanya
  `noopener` tidak dipakai di situ, dan `opener` dinolkan setelahnya.

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

### Semua berkas sengaja tanpa komentar

Selain agar ringkas saat ditempel, ini menghilangkan satu jebakan: mesin template Apps Script
memindai **seluruh** berkas `.html`, termasuk bagian yang dikomentari — sebuah contoh
scriptlet yang ditulis di dalam komentar pun ikut dievaluasi dan memunculkan
`SyntaxError: Unexpected token ';'`. Satu-satunya scriptlet yang boleh ada di `OpenWeb.html`
adalah `JSON.stringify(url)` dan `JSON.stringify(note)` yang force-print di awal `<script>`;
di `KedatanganBatubara.html` hanya `JSON.stringify(cfg)`.

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

## Menu 🚢 Kedatangan Batubara

Folder ini sekarang memuat **seluruh** project container-bound DATA OPERASIONAL, termasuk
menu kedua: **🚢 Kedatangan Batubara → Tambah kedatangan**. Menu itu membuka **dialog form di
dalam Sheets** (tanpa pindah tab). Simpan →

- satu baris `coal_arrivals` (keterangan `Menu spreadsheet`) — tumpukannya muncul di denah
  `/coal-storage` dan di tab Handling laporan shift itu;
- blok kedatangan di **kolom H sheet Catatan** untuk tanggal + shift itu (dan shift sesudahnya
  di pengiriman yang sama, karena tonasenya kumulatif). Kalau laporan shift itu belum ada,
  barisnya tetap dibuat (B/C + H); kolom lain menyusul saat laporan disimpan.

Isian & aturannya sama dengan form Kedatangan Batubara di web (asal, unloading via, nama,
tonase, pilar, mulai masuk storage, status, lanjutan pengiriman). Tonase diketik gaya
Indonesia: `3.000` = tiga ribu, `2.500,5` = dua ribu lima ratus koma lima.

Berkas: `Batubara.gs` (menu, gerbang, pembuka dialog, lompat ke baris Catatan) dan
`KedatanganBatubara.html` (form). Dialog memanggil `/api/sheets/kedatangan-batubara`
**langsung dari browser** (fetch), bukan `UrlFetchApp` — sengaja, supaya project tidak butuh
izin baru. Kalau scope project bertambah, semua pemakai menu Upload Foto diminta otorisasi ulang.

### Pasang

1. Tempel `Code.gs` (versi baru, `onOpen(e)`), lalu **File → + → Script** bernama `Batubara`
   dan **File → + → HTML** bernama `KedatanganBatubara`, isi dari folder ini.
2. **Project Settings → Script Properties**:

   | Properti | Isi |
   |---|---|
   | `batubaraSecret` | sama persis dengan env Vercel `KEDATANGAN_SHEET_SECRET`. Kosong = menu tidak pernah muncul. |
   | `pengujiBatubara` | email penguji, pisah koma. Selama uji, menu hanya muncul untuk mereka. |
   | `batubaraRilis` | `ya` = menu muncul untuk semua. Kosongkan/hapus selama uji. |

3. Buka **Overview → Project OAuth Scopes** dan pastikan daftarnya **sama seperti sebelum
   menempel** (tidak ada tambahan `userinfo.email` / `script.external_request`). Kalau bertambah,
   jangan reload untuk operator — kembalikan berkas lama dulu.
4. Reload spreadsheet → menu **🚢 Kedatangan Batubara** muncul di akun penguji saja.

### Uji & rilis

- Gerbang uji memakai email dari event `onOpen` (`e.user`). Google hanya memberikannya untuk
  pemilik script / satu domain — operator lain mendapat email kosong, jadi menu tetap
  tersembunyi. Kalau menu juga tidak muncul untuk penguji, berarti Google tidak memberi
  email di akun itu; gerbangnya perlu diganti (jangan isi `batubaraRilis` hanya untuk uji).
- Uji sebaiknya dengan **kedatangan sungguhan**: data masuk DB & sheet Catatan produksi. Entri
  uji bisa dihapus dari tab Handling laporan shift itu atau review harian, tapi blok di kolom H
  **tidak ikut hilang** (anti-wipe Catatan) — bersihkan selnya manual.
- Rilis: isi `batubaraRilis` = `ya`, lalu reload. Tidak perlu tempel ulang kode.

## Catatan

- Menu custom Apps Script **tidak muncul di aplikasi Google Sheets di HP** — itu batasan
  Google. Yang penting, tautan hasilnya bisa dibuka di HP dan upload foto dari kamera
  tetap jalan; operator lapangan cukup dikirimi tautannya, atau membuka
  `/critical-maintenance` langsung.
- Foto disimpan di Cloudflare R2 lewat API web, bukan di Google Drive — jadi tidak ada
  file yang membebani kuota Drive pribadi operator.
