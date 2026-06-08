'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { PublishReportModal } from '@/components/ui/PublishReportModal';

/** Halaman Review/Publish laporan harian (full-screen, punya URL sendiri).
 *  Metadata laporan dibawa lewat query: id, date, group, sup (supervisor). */
function PublishHarianInner() {
    const router = useRouter();
    const sp = useSearchParams();
    const { operator, canReviewReport } = useOperator();

    const reportId = sp.get('id') ?? '';
    const date = sp.get('date') ?? '';
    const group = sp.get('group') ?? undefined;
    const supervisor = sp.get('sup') ?? '';

    if (!reportId) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0e1621] text-slate-300">
                <span className="material-symbols-outlined text-5xl text-slate-600">error</span>
                <p className="text-sm">Laporan tidak ditemukan (parameter <code>id</code> kosong).</p>
                <button onClick={() => router.back()} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider">Kembali</button>
            </div>
        );
    }

    return (
        <PublishReportModal
            kind="daily"
            reportId={reportId}
            open
            onClose={() => router.back()}
            reportDate={date}
            reportGroup={group}
            initialSupervisor={supervisor}
            canReview={canReviewReport}
            reviewerName={operator?.name ?? ''}
        />
    );
}

export default function PublishHarianPage() {
    return (
        <Suspense fallback={null}>
            <PublishHarianInner />
        </Suspense>
    );
}
