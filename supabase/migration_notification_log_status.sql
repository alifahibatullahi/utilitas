-- Status pengiriman di notification_log.
-- Sebelumnya log SELALU ditulis tanpa memeriksa hasil kirim ke gateway WA, sehingga
-- "ada di log" tidak berarti pesan benar-benar terkirim (insiden notif siap-publish
-- supervisor grup D, 12 Jun 2026: gagal di gateway tapi log tampak normal).
--   status : 'sent' | 'failed' — NULL untuk baris lama (dianggap sent).
--   error  : alasan gagal dari gateway (NULL kalau sukses).
alter table notification_log
    add column if not exists status text check (status in ('sent', 'failed'));
alter table notification_log
    add column if not exists error text;
