# Menu Foto Critical/Maintenance — Apps Script (di dalam Spreadsheet)

Menu **📷 Upload Foto** di spreadsheet yang membuka **Web Utilitas Batubara** pada record yang
sedang dipilih, tempat operator meng-upload fotonya. Script ini sendiri **tidak
mengunggah apa pun** dan tidak butuh izin Google Drive.

## Alur operator

1. Isi baris critical/maintenance di spreadsheet seperti biasa. Kolom **Link Foto**
   masih kosong.
2. Klik salah satu sel di baris itu → menu **📷 Upload Foto → Upload foto baris terpilih**.
3. Dialog muncul berisi ringkasan baris → **Buka web & upload foto**.
4. Web terbuka langsung di record tersebut → pilih/ambil foto → upload.
   Ini jalan di HP juga, karena upload-nya di web, bukan di dialog Apps Script.
5. Kolom **Link Foto** baris itu terisi otomatis: `📷 Foto (n)`, klik untuk kembali
   membuka galeri record tersebut. Kalau semua fotonya dihapus, selnya kosong lagi.

Kalau saat menu diklik tidak ada baris data yang jelas (masih di baris judul, atau tab
lain), web tetap dibuka — di daftar **Aktivitas Terbaru**, supaya operator bisa mencari
sendiri record yang baru dia isi.

## Isi folder ini

Kedua file di sini adalah **salinan versi-terkontrol** dari script yang dipasang langsung
di spreadsheet (container-bound):

- `Code.gs` — menu, penentuan baris terpilih, pembentukan URL.
- `OpenWeb.html` — dialog konfirmasi + pembuka tab.

## Pasang

1. Buka spreadsheet → **Extensions → Apps Script**.
2. Ganti isi `Code.gs` di editor dengan isi `Code.gs` dari folder ini.
3. **File → + → HTML**, beri nama **`OpenWeb`** (tanpa `.html`), tempel isi
   `OpenWeb.html` dari folder ini.
4. **Project Settings → Script Properties**, tambahkan tiga properti:

   | Properti | Isi |
   |---|---|
   | `appUrl` | URL web, mis. `https://powerops.example.com` (tanpa `/` di akhir) |
   | `criticalGid` | gid tab Critical Equipment (lihat `#gid=` di URL tab) |
   | `maintenanceGid` | gid tab Maintenance |

5. **Save**, jalankan `onOpen` sekali (▶) untuk memicu otorisasi (hanya izin
   Spreadsheet), lalu **reload spreadsheet** → menu **📷 Upload Foto** muncul.

Konfigurasi ada di Script Properties, bukan di kode — jadi saat pindah ke spreadsheet
produksi cukup tempel ulang kedua file dan isi ketiga properti itu.

## Prasyarat di spreadsheet

- Kolom **`Link Foto`** sudah ada di kedua tab (Critical: kolom N, Maintenance: kolom L).
  Web yang mengisi & mengosongkan selnya; script ini tidak pernah menulisnya.
- Kolom **`ID`** (kolom B) harus tetap ada dan isinya jangan diubah — itu identitas baris
  yang menghubungkannya ke foto. Bentuknya `KODE-VARIAN-acak`, mis. `L-08.12-A-a1`.
  Kalau baris yang dipilih belum punya ID, script mengisikannya sekali dengan format yang
  sama supaya tautannya bisa langsung menunjuk record itu.
  Header lama `web_uid …` masih dikenali, jadi sheet yang belum diganti tetap jalan.

Cek kapan saja dengan `npx tsx scripts/check-critical-sheet.ts` di repo web — script itu
read-only dan melaporkan tab, baris header, serta posisi kolom `ID` & `Link Foto`.

## Catatan

- Menu custom Apps Script **tidak muncul di aplikasi Google Sheets di HP** — itu batasan
  Google. Yang penting, tautan hasilnya bisa dibuka di HP dan upload foto dari kamera
  tetap jalan; operator lapangan cukup dikirimi tautannya, atau membuka
  `/critical-maintenance` langsung.
- Foto disimpan di Cloudflare R2 lewat API web, bukan di Google Drive — jadi tidak ada
  file yang membebani kuota Drive pribadi operator.
