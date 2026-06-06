# WAHA — WhatsApp Gateway untuk PowerOps

Self-host gateway WhatsApp (pengganti Fonnte). Notif & publish laporan dikirim
lewat WAHA. Setup ini memakai **dua container = dua nomor WA**:

| Container      | Port  | Nomor untuk                                   | Env aplikasi          |
|----------------|-------|-----------------------------------------------|-----------------------|
| `waha-notif`   | 3000  | reminder/notif shift & harian (grup A–D)      | `WAHA_*`              |
| `waha-publish` | 3001  | publish ke washift, Utilitas 2, SU 3A         | `WAHA_*_PUBLISH`      |

> Cukup satu nomor? Hapus service `waha-publish` di `docker-compose.yml` dan
> kosongkan `WAHA_*_PUBLISH` di aplikasi — otomatis fallback ke nomor notif.

---

## Prasyarat
- VPS (RAM 1–2 GB cukup) dengan **Docker** + **Docker Compose** terpasang.
- Dua nomor WhatsApp **khusus bot** (jangan nomor pribadi → risiko banned).
- (Disarankan) domain + HTTPS via reverse proxy (Caddy/Nginx).

---

## Langkah 1 — Jalankan container
```bash
# di VPS, dalam folder waha/
cp .env.example .env
nano .env                 # isi WAHA_API_KEY, WAHA_API_KEY_PUBLISH, password dashboard

docker compose up -d
docker compose logs -f    # tunggu "Nest application successfully started", lalu Ctrl-C
```

## Langkah 2 — Login WhatsApp (scan QR) per container
Ulangi untuk **kedua** container (port 3000 = notif, 3001 = publish):

1. Buka `http://IP-VPS:3000/dashboard` (lalu `:3001/dashboard`).
2. Login pakai `WAHA_DASHBOARD_USERNAME` / `WAHA_DASHBOARD_PASSWORD`.
3. Klik **Start** pada session `default` → muncul **QR code**.
4. Di HP nomor bot: WhatsApp → ⋮ → **Perangkat tertaut** → **Tautkan perangkat** → scan.
   - ⏱️ QR pertama hidup **60 detik**; kalau telat, refresh untuk QR baru.
5. Status berubah jadi **WORKING** = siap. (notif pakai nomor A, publish pakai nomor B).

## Langkah 3 — Ambil chatId grup
Grup di DB disimpan format `xxxx@g.us`. Untuk dapat ID grup baru:
```bash
curl http://IP-VPS:3000/api/default/groups -H "X-Api-Key: <WAHA_API_KEY>"
```
Atau lewat menu **Groups** di dashboard. (Grup D saat ini: `120363321789945938@g.us`.)

## Langkah 4 — Tes kirim manual
```bash
# teks ke grup
curl -X POST http://IP-VPS:3000/api/sendText \
  -H "X-Api-Key: <WAHA_API_KEY>" -H "Content-Type: application/json" \
  -d '{"session":"default","chatId":"120363321789945938@g.us","text":"Tes WAHA ✅"}'

# file PDF ke grup
curl -X POST http://IP-VPS:3000/api/sendFile \
  -H "X-Api-Key: <WAHA_API_KEY>" -H "Content-Type: application/json" \
  -d '{"session":"default","chatId":"120363321789945938@g.us","file":{"url":"https://contoh.com/lap.pdf","filename":"lap.pdf","mimetype":"application/pdf"},"caption":"Laporan"}'
```

## Langkah 5 — Sambungkan ke aplikasi PowerOps
Set di host aplikasi (Vercel → Settings → Environment Variables):
```
WAHA_BASE_URL=http://IP-VPS:3000
WAHA_API_KEY=<sama dgn WAHA_API_KEY>
WAHA_SESSION=default

WAHA_BASE_URL_PUBLISH=http://IP-VPS:3001
WAHA_API_KEY_PUBLISH=<sama dgn WAHA_API_KEY_PUBLISH>
WAHA_SESSION_PUBLISH=default
```
Lalu **redeploy**. Setelah yakin jalan, hapus `FONNTE_TOKEN` & `FONNTE_TOKEN_PUBLISH`.

## Langkah 6 — Verifikasi end-to-end
- Health-check app: buka `https://APP_URL/api/whatsapp/waha-health`
  → `{"healthy":true,...}` (HTTP 200) artinya kedua session WORKING.
- Trigger notif asli (lengkapi laporan shift sampai "siap dipublish") dan
  pastikan pesan masuk ke grup.

---

## Operasional & "biar jarang down"
| Aspek           | Tindakan                                                                 |
|-----------------|--------------------------------------------------------------------------|
| Anti-banned     | Nomor khusus bot; jangan blast masif                                     |
| Auto-restart    | `restart: always` (sudah diset) — container nyala lagi kalau crash       |
| Session persist | Volume `.sessions-*` (sudah diset) — restart tak butuh scan QR ulang     |
| Backup          | Backup folder `.sessions-notif/` & `.sessions-publish/` berkala          |
| Monitoring      | Ping `/api/whatsapp/waha-health`; kalau ≠200 → cek dashboard, re-scan QR |
| HTTPS           | Pasang reverse proxy + domain agar `WAHA_BASE_URL` aman                  |

**Kalau session FAILED / logout** (HP unlink perangkat, dll): buka dashboard
container terkait → **Start** → scan ulang QR.

## Update versi WAHA
```bash
docker compose pull && docker compose up -d
```

## Referensi
- Dashboard: `http://IP-VPS:<port>/dashboard`
- Docs: https://waha.devlike.pro/docs/
