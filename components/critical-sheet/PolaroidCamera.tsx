/**
 * Kamera polaroid memotret lalu mencetak fotonya — penanda tunggu untuk galeri foto
 * /critical-maintenance.
 *
 * Keyframes-nya di app/globals.css (`kameraAyun`/`kameraFokus`/`kameraKedip`/`kameraCetak`/
 * `kameraCuci`), bukan di sini, supaya `prefers-reduced-motion` cukup diatur satu tempat.
 *
 * Kartu fotonya digambar SEBELUM badan kamera di dalam grup yang sama: badan yang opaque
 * itulah yang menyembunyikannya sebelum "tercetak" keluar dari slot bawah. Menukar urutannya
 * membuat kartu melayang di depan kamera sepanjang siklus.
 */
export default function PolaroidCamera({ className = 'w-[150px] h-auto' }: { className?: string }) {
    return (
        <svg viewBox="0 0 160 142" className={className} role="img" aria-label="Sedang memuat">
            <g className="kamera-badan">
                <g className="kamera-kartu">
                    <rect x="50" y="60" width="60" height="40" rx="4" fill="#fff" stroke="#d4d4d4" strokeWidth="2" />
                    <rect className="kamera-cetakan" x="55" y="65" width="50" height="23" rx="2" />
                    <rect x="55" y="92" width="28" height="3" rx="1.5" fill="#d4d4d4" />
                </g>
                <rect x="50" y="15" width="30" height="12" rx="4" fill="#f5f5f5" stroke="#d4d4d4" strokeWidth="2" />
                <rect x="22" y="25" width="116" height="75" rx="12" fill="#fff" stroke="#d4d4d4" strokeWidth="2" />
                <rect x="98" y="34" width="20" height="10" rx="3" fill="#f5f5f5" stroke="#d4d4d4" strokeWidth="2" />
                <circle className="kamera-blitz" cx="108" cy="39" r="7" fill="#fbbf24" />
                <circle cx="80" cy="64" r="25" fill="#f5f5f5" stroke="#d4d4d4" strokeWidth="2" />
                <circle cx="80" cy="64" r="16" fill="#2563eb" opacity="0.16" />
                <circle className="kamera-iris" cx="80" cy="64" r="9" fill="#2563eb" />
                <rect x="46" y="92" width="68" height="4" rx="2" fill="#e5e5e5" />
            </g>
        </svg>
    );
}
