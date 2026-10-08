'use client';

import { useLayoutEffect, useState } from 'react';

/**
 * Menyejajarkan baris dua kartu yang bersanding (Umur stok & Riwayat loading):
 * elemen ke-i bertanda `data-sejajar` di tiap anak wadah dibuat setinggi yang
 * paling tinggi di antara mereka — yang pendek mengikuti yang panjang — supaya
 * garis antar-baris kedua tabel lurus satu sama lain.
 *
 * Mengembalikan callback ref untuk wadahnya. Bukan useRef: wadah baru dirender
 * setelah data denah selesai dimuat, dan ref objek tidak memicu efek ulang saat
 * elemennya muncul belakangan.
 *
 * Hanya berlaku selama `media` cocok (kartu bersanding). Di HP kartu bertumpuk,
 * jadi tinggi paksaannya dihapus dan semua kembali ke tinggi alami.
 *
 * Sengaja menulis langsung ke style elemen, bukan lewat state React: ukurannya
 * baru diketahui setelah tata letak, dan satu lintasan sinkron (hapus → ukur →
 * tulis) tidak membuat layar berkedip maupun memicu render ulang.
 */
export function useBarisSejajar(media = '(min-width: 1024px)') {
    const [el, setEl] = useState<HTMLElement | null>(null);

    useLayoutEffect(() => {
        if (!el) return;
        const mq = window.matchMedia(media);

        const sejajarkan = () => {
            const kolom = [...el.children].map(k => [...k.querySelectorAll<HTMLElement>('[data-sejajar]')]);

            // Hapus dulu tinggi paksaan supaya yang terukur tinggi ALAMI — tanpa ini
            // baris tak pernah bisa memendek lagi setelah ganti halaman.
            for (const b of kolom.flat()) {
                b.style.height = '';
                b.style.minHeight = '';
            }
            if (!mq.matches) return;

            const jumlah = Math.max(0, ...kolom.map(k => k.length));
            for (let i = 0; i < jumlah; i++) {
                const baris = kolom.flatMap(k => (k[i] ? [k[i]] : []));
                if (baris.length < 2) continue;   // tak punya pasangan: biarkan alami
                // getComputedStyle, bukan getBoundingClientRect: satuannya CSS px elemen
                // itu sendiri, jadi tidak meleset oleh zoom body/AppShell.
                const tinggi = Math.max(...baris.map(b => parseFloat(getComputedStyle(b).height) || 0));
                for (const b of baris) {
                    // Baris tabel mengabaikan min-height; height di <tr> justru berlaku
                    // sebagai tinggi minimum.
                    if (b.tagName === 'TR') b.style.height = `${tinggi}px`;
                    else b.style.minHeight = `${tinggi}px`;
                }
            }
        };

        sejajarkan();

        // Ganti halaman, urutan Terlama/Terbaru, atau refetch mengganti isi baris.
        // TANPA `attributes`: tulisan style di atas tidak boleh memicu dirinya sendiri.
        const mo = new MutationObserver(sejajarkan);
        mo.observe(el, { childList: true, characterData: true, subtree: true });
        // Lebar berubah → teks turun baris. Tulisan kita mengubah tinggi wadah sekali,
        // lintasan berikutnya menghasilkan angka yang sama, jadi berhenti sendiri.
        const ro = new ResizeObserver(sejajarkan);
        ro.observe(el);
        mq.addEventListener('change', sejajarkan);
        // Ikon Material Symbols dimuat belakangan dan bisa mengubah tinggi baris.
        let aktif = true;
        document.fonts?.ready.then(() => { if (aktif) sejajarkan(); });

        return () => {
            aktif = false;
            mo.disconnect();
            ro.disconnect();
            mq.removeEventListener('change', sejajarkan);
        };
    }, [el, media]);

    return setEl;
}
