'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCriticalMaintenance } from '@/hooks/useCriticalMaintenance';
import { useOperator } from '@/hooks/useOperator';
import { detectCurrentShift } from '@/lib/constants';
import type { CriticalWithMaintenance, MaintenanceWithCritical, MaintenanceLogRow, PhotoRow, WorkOrderWithPekerjaan, WorkOrderRow } from '@/lib/supabase/types';
import KanbanBoardModal from './KanbanBoardModal';
import CriticalTableView from './CriticalTableView';
import MaintenanceTableView from './MaintenanceTableView';
import CriticalFormModal from './CriticalFormModal';
import MaintenanceFormModal from './MaintenanceFormModal';
import WorkOrderFormModal from './WorkOrderFormModal';
import CloseCriticalModal from './CloseCriticalModal';
import CloseWorkOrderModal from './CloseWorkOrderModal';
import CriticalDetailModal from './CriticalDetailModal';
import WorkOrderDetailModal from './WorkOrderDetailModal';

function HeaderOperatorSelect() {
    const { operator, operators, login } = useOperator();
    const sorted = [...operators].sort((a,b) => a.name.localeCompare(b.name));
    
    return (
        <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 shadow-sm transition-colors hover:bg-gray-200 focus-within:ring-2 focus-within:ring-blue-500/20">
            <span className="material-symbols-outlined text-gray-500" style={{ fontSize: 16 }}>person</span>
            <select
                value={operator?.name || ''}
                onChange={e => {
                    const op = operators.find(o => o.name === e.target.value);
                    if (op) login(op);
                }}
                className="bg-transparent text-xs font-bold text-gray-700 outline-none cursor-pointer pr-4 appearance-none hover:text-gray-900"
            >
                <option value="" disabled>Login Sebagai...</option>
                {sorted.map(op => (
                    <option key={op.name} value={op.name}>{op.name}</option>
                ))}
            </select>
            <span className="material-symbols-outlined absolute right-2 text-gray-400 pointer-events-none hidden sm:block" style={{ fontSize: 14, right: 8 }}>expand_more</span>
        </div>
    );
}

export default function CriticalPage() {
    const router = useRouter();
    const { operator } = useOperator();
    const cm = useCriticalMaintenance();

    const [view, setView] = useState<'critical' | 'maintenance'>('critical');
    const [showBoardModal, setShowBoardModal] = useState(false);

    // Shift selector for board view
    const defaultShift = detectCurrentShift();
    const [boardDate, setBoardDate] = useState(defaultShift.date);
    const [boardShift, setBoardShift] = useState<'pagi' | 'sore' | 'malam'>(defaultShift.shift);

    // Modal state
    const [showCriticalForm, setShowCriticalForm] = useState(false);
    const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
    const [maintenanceRestrictTipe, setMaintenanceRestrictTipe] = useState<'preventifModifikasi' | undefined>(undefined);
    // Edit state
    const [editingCritical, setEditingCritical] = useState<CriticalWithMaintenance | null>(null);
    const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceWithCritical | null>(null);
    const [maintenanceInitial, setMaintenanceInitial] = useState<Partial<Omit<MaintenanceLogRow, 'id' | 'created_at' | 'updated_at'>> | undefined>(undefined);
    const [expandedCriticalId, setExpandedCriticalId] = useState<string | null>(null);
    const [returnToDetailId, setReturnToDetailId] = useState<string | null>(null);
    const [expandedWOId, setExpandedWOId] = useState<string | null>(null);
    const [showWorkOrderForm, setShowWorkOrderForm] = useState(false);
    const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrderWithPekerjaan | null>(null);
    const [returnToWOId, setReturnToWOId] = useState<string | null>(null);
    const [activeWorkOrderContext, setActiveWorkOrderContext] = useState<WorkOrderWithPekerjaan | null>(null);

    // Close confirmation modal state
    const [closingCritical, setClosingCritical] = useState<CriticalWithMaintenance | null>(null);
    const [closingWorkOrder, setClosingWorkOrder] = useState<WorkOrderWithPekerjaan | null>(null);

    // Apply basic Kanban filters — exclude notes (they only appear in detail modal)
    const filteredKanban = cm.maintenances.filter(m => m.keterangan !== 'IS_NOTE' && m.item !== 'NOTE');

    // Build map: maintenance_id → ISO timestamp of when its status reached its current value
    // Sumber: activity logs (critical_activity_logs + work_order_activity_logs).
    // Untuk OPEN: pakai waktu maintenance_added (fallback ke created_at maintenance).
    // Untuk IP/OK: cari activity log terbaru dengan metadata.maintenance_id == m.id dan metadata.new_status == m.status.
    const statusTimeByMaintId = useMemo(() => {
        const map: Record<string, string> = {};
        // Walk all activity logs from criticals + workOrders
        const allLogs = [
            ...cm.criticals.flatMap(c => c.critical_activity_logs ?? []),
            ...cm.workOrders.flatMap(w => w.work_order_activity_logs ?? []),
        ];
        // For each maintenance, scan logs
        for (const m of cm.maintenances) {
            let bestIso: string | null = null;
            if (m.status === 'OPEN') {
                // Find maintenance_added with this maintenance_id
                for (const l of allLogs) {
                    const meta = l.metadata as Record<string, unknown> | null | undefined;
                    if (l.action_type === 'maintenance_added' && meta?.maintenance_id === m.id) {
                        if (!bestIso || new Date(l.created_at).getTime() > new Date(bestIso).getTime()) {
                            bestIso = l.created_at;
                        }
                    }
                }
            } else {
                // Find latest maintenance_updated where new_status == current status
                for (const l of allLogs) {
                    const meta = l.metadata as Record<string, unknown> | null | undefined;
                    if (l.action_type === 'maintenance_updated' && meta?.maintenance_id === m.id && meta?.new_status === m.status) {
                        if (!bestIso || new Date(l.created_at).getTime() > new Date(bestIso).getTime()) {
                            bestIso = l.created_at;
                        }
                    }
                }
            }
            map[m.id] = bestIso ?? m.updated_at ?? m.created_at;
        }
        return map;
    }, [cm.maintenances, cm.criticals, cm.workOrders]);

    // Photos for Kanban board
    const [photosByMaintId, setPhotosByMaintId] = useState<Record<string, PhotoRow[]>>({});
    useEffect(() => {
        if (!showBoardModal) return;
        const ids = cm.maintenances.map(m => m.id);
        cm.fetchPhotosForMaintList(ids).then(setPhotosByMaintId);
    }, [showBoardModal, cm.maintenances]); // eslint-disable-line react-hooks/exhaustive-deps

    const today = new Date();
    const dateStr = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-[#f8f9fb]">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
                <div className="max-w-[1600px] mx-auto px-4 py-3">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        {/* Left: logos + title */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo/Danantara_Indonesia_(no_SW).png" alt="Danantara" className="h-7 w-auto object-contain hidden lg:block" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo/Logo_Pupuk_Indonesia__Persero_-removebg-preview.png" alt="Pupuk Indonesia" className="h-7 w-auto object-contain" />
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo/logo-PG-agro-trans-small-removebg-preview.png" alt="PG" className="h-7 w-auto object-contain" />
                            </div>
                            <div className="hidden sm:block h-8 w-px bg-gray-200" />
                            <div>
                                <h1 className="text-base md:text-lg font-extrabold tracking-tight text-gray-800 leading-tight">Critical & Maintenance</h1>
                                <p className="text-[10px] md:text-xs font-semibold text-gray-500">{dateStr}</p>
                            </div>
                        </div>

                        {/* Middle: Tab Toggle */}
                        <div className="flex bg-gray-100/80 p-1.5 rounded-xl border border-gray-200/60 shadow-inner max-w-fit mx-auto xl:mx-0">
                            <button
                                onClick={() => setView('critical')}
                                className={`flex items-center px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                    view === 'critical' ? 'bg-white text-rose-600 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 shadow-transparent'
                                }`}
                            >
                                <span className="material-symbols-outlined mr-2" style={{ fontSize: 18 }}>warning</span>
                                Critical
                            </button>
                            <button
                                onClick={() => setView('maintenance')}
                                className={`flex items-center px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                                    view === 'maintenance' ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50' : 'text-gray-500 hover:text-gray-700 shadow-transparent'
                                }`}
                            >
                                <span className="material-symbols-outlined mr-2" style={{ fontSize: 18 }}>build</span>
                                Maintenance
                            </button>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar justify-end">
                            <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>
                            
                            {/* NEW: Operator Select */}
                            <div className="relative flex items-center">
                                <HeaderOperatorSelect />
                            </div>

                            <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>

                            <button
                                onClick={() => router.push('/dashboard')}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                                title="Kembali ke PowerOps"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
                                <span className="hidden sm:inline">PowerOps</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-[1920px] mx-auto px-4 py-6 min-h-[calc(100vh-100px)] flex flex-col">
                {cm.loading ? (
                    <div className="flex flex-col flex-1 items-center justify-center text-gray-400">
                        <span className="material-symbols-outlined animate-spin text-4xl mb-3 text-blue-500">progress_activity</span>
                        <span className="text-sm font-bold">Memuat data...</span>
                    </div>
                ) : (
                    <>
                        {view === 'critical' && (
                            <div className="w-full flex-1 transition-all animate-in fade-in zoom-in-95 duration-300">
                                <CriticalTableView
                                    criticals={cm.criticals}
                                    workOrders={cm.workOrders}
                                    expandedWOId={expandedWOId}
                                    onSetExpandedWOId={setExpandedWOId}
                                    onAddWorkOrder={() => {
                                        setMaintenanceInitial({ date: new Date().toISOString().split('T')[0] });
                                        setMaintenanceRestrictTipe('preventifModifikasi');
                                        setShowMaintenanceForm(true);
                                    }}
                                    onEditWorkOrder={(wo) => setEditingWorkOrder(wo)}
                                    onDeleteWorkOrder={async (id) => { await cm.deleteWorkOrder(id); }}
                                    onAddPekerjaanToWO={(wo) => {
                                        setMaintenanceInitial({
                                            work_order_id: wo.id,
                                            item: wo.item,
                                            scope: wo.scope,
                                            foreman: wo.foreman,
                                            date: new Date().toISOString().split('T')[0],
                                        });
                                        setActiveWorkOrderContext(wo);
                                        setReturnToWOId(wo.id);
                                        setExpandedWOId(null);
                                        setShowMaintenanceForm(true);
                                    }}
                                    onEditCritical={(c) => setEditingCritical(c)}
                                    onDeleteCritical={async (id) => { await cm.deleteCritical(id); }}
                                    onAddCritical={() => setShowCriticalForm(true)}
                                    onEditMaintenance={(m) => setEditingMaintenance({ ...m, critical_equipment: null })}
                                    onDeleteMaintenance={async (id) => { await cm.deleteMaintenance(id, operator?.name); }}
                                    onAddMaintenance={(critical) => {
                                        setMaintenanceInitial(critical ? {
                                            critical_id: critical.id,
                                            item: critical.item,
                                            scope: critical.scope,
                                            foreman: critical.foreman,
                                            date: new Date().toISOString().split('T')[0],
                                        } : {
                                            date: new Date().toISOString().split('T')[0],
                                        });
                                        if (critical?.id) {
                                            setReturnToDetailId(critical.id);
                                            setExpandedCriticalId(null);
                                        }
                                        setShowMaintenanceForm(true);
                                    }}
                                    onRefresh={cm.refetch}
                                    expandedId={expandedCriticalId}
                                    onSetExpandedId={setExpandedCriticalId}
                                    fetchPhotos={cm.fetchPhotos}
                                    deletePhoto={cm.deletePhoto}
                                    operatorName={operator?.name}
                                    onChangeCriticalStatus={async (id, newStatus) => {
                                        if (newStatus === 'CLOSED') {
                                            const crit = cm.criticals.find(c => c.id === id);
                                            if (crit) { setClosingCritical(crit); return; }
                                        }
                                        await cm.moveCriticalStatus(id, newStatus, operator?.name);
                                    }}
                                    onChangeWorkOrderStatus={async (id, newStatus) => {
                                        if (newStatus === 'OK') {
                                            const wo = cm.workOrders.find(w => w.id === id);
                                            if (wo) { setClosingWorkOrder(wo); return; }
                                        }
                                        await cm.moveWorkOrderStatus(id, newStatus, operator?.name);
                                    }}
                                    addActivityNote={cm.addActivityNote}
                                    addWOActivityNote={cm.addWOActivityNote}
                                    fetchWOPhotos={cm.fetchWOPhotos}
                                    onChangeMaintenanceStatus={async (id, newStatus, actor) => {
                                        return await cm.moveMaintenanceStatus(id, newStatus, actor);
                                    }}
                                />
                            </div>
                        )}

                        {view === 'maintenance' && (
                            <div className="w-full flex-1 flex flex-col transition-all animate-in fade-in zoom-in-95 duration-300">
                                {/* Action buttons */}
                                <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
                                    <button
                                        onClick={() => setShowBoardModal(true)}
                                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-blue-600 border-2 border-blue-200 text-sm font-black hover:bg-blue-50 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>view_kanban</span>
                                        Buka Board
                                    </button>
                                    <button
                                        onClick={() => {
                                            setMaintenanceInitial({ date: new Date().toISOString().split('T')[0] });
                                            setMaintenanceRestrictTipe(undefined);
                                            setShowMaintenanceForm(true);
                                        }}
                                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-50 text-blue-600 border-2 border-blue-200 text-sm font-black hover:bg-blue-100 transition-all shadow-sm cursor-pointer whitespace-nowrap"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                                        + Tambah Maintenance
                                    </button>
                                </div>

                                <MaintenanceTableView
                                    maintenances={cm.maintenances}
                                    workOrders={cm.workOrders}
                                    onEdit={(m) => setEditingMaintenance(m)}
                                    onDelete={async (id) => { await cm.deleteMaintenance(id, operator?.name); }}
                                    onChangeStatus={async (id, newStatus) => {
                                        await cm.moveMaintenanceStatus(id, newStatus, operator?.name);
                                    }}
                                    onToggleExpand={(id, type) => {
                                        if (type === 'critical') setExpandedCriticalId(id);
                                        else setExpandedWOId(id);
                                    }}
                                />

                                {/* Detail Modals for Maintenance View */}
                                {expandedCriticalId && cm.criticals.find(c => c.id === expandedCriticalId) && (() => {
                                    const critical = cm.criticals.find(c => c.id === expandedCriticalId)!;
                                    return (
                                        <CriticalDetailModal
                                            critical={critical}
                                            rowIndex={0}
                                            onClose={() => setExpandedCriticalId(null)}
                                            onEditMaintenance={(m) => setEditingMaintenance({ ...m, critical_equipment: null })}
                                            onDeleteMaintenance={async (id) => { await cm.deleteMaintenance(id, operator?.name); }}
                                            onAddMaintenance={(c) => {
                                                setMaintenanceInitial(c ? {
                                                    critical_id: c.id,
                                                    item: c.item,
                                                    scope: c.scope,
                                                    foreman: c.foreman,
                                                    date: new Date().toISOString().split('T')[0],
                                                } : { date: new Date().toISOString().split('T')[0] });
                                                if (c?.id) { setReturnToDetailId(c.id); setExpandedCriticalId(null); }
                                                setShowMaintenanceForm(true);
                                            }}
                                            onRefresh={cm.refetch}
                                            fetchPhotos={cm.fetchPhotos}
                                            deletePhoto={cm.deletePhoto}
                                            operatorName={operator?.name}
                                            addActivityNote={cm.addActivityNote}
                                            onChangeMaintenanceStatus={async (id, newStatus, actor) => {
                                                return await cm.moveMaintenanceStatus(id, newStatus, actor);
                                            }}
                                        />
                                    );
                                })()}

                                {expandedWOId && cm.workOrders.find(w => w.id === expandedWOId) && (() => {
                                    const wo = cm.workOrders.find(w => w.id === expandedWOId)!;
                                    return (
                                        <WorkOrderDetailModal
                                            workOrder={wo}
                                            rowIndex={0}
                                            onClose={() => setExpandedWOId(null)}
                                            onEditPekerjaan={(m) => setEditingMaintenance({ ...m, critical_equipment: null })}
                                            onDeletePekerjaan={async (id) => { await cm.deleteMaintenance(id, operator?.name); }}
                                            onAddPekerjaan={(wData) => {
                                                setMaintenanceInitial({
                                                    work_order_id: wData.id,
                                                    item: wData.item,
                                                    scope: wData.scope,
                                                    foreman: wData.foreman,
                                                    date: new Date().toISOString().split('T')[0],
                                                });
                                                setActiveWorkOrderContext(wData);
                                                setReturnToWOId(wData.id);
                                                setExpandedWOId(null);
                                                setShowMaintenanceForm(true);
                                            }}
                                            onRefresh={cm.refetch}
                                            fetchPhotos={cm.fetchWOPhotos}
                                            deletePhoto={cm.deletePhoto}
                                            operatorName={operator?.name}
                                            addActivityNote={cm.addWOActivityNote}
                                            onChangePekerjaanStatus={async (id, newStatus, actor) => {
                                                return await cm.moveMaintenanceStatus(id, newStatus, actor);
                                            }}
                                        />
                                    );
                                })()}
                            </div>
                        )}


                    </>
                )}
            </main>

            {/* Close Critical confirmation popup */}
            {closingCritical && (
                <CloseCriticalModal
                    open={true}
                    critical={closingCritical}
                    operatorName={operator?.name}
                    onClose={() => setClosingCritical(null)}
                    onConfirm={async (actor) => {
                        const res = await cm.moveCriticalStatus(closingCritical.id, 'CLOSED', actor);
                        setClosingCritical(null);
                        return { error: res ? null : null };
                    }}
                />
            )}

            {/* Close Work Order confirmation popup */}
            {closingWorkOrder && (
                <CloseWorkOrderModal
                    open={true}
                    workOrder={closingWorkOrder}
                    operatorName={operator?.name}
                    onClose={() => setClosingWorkOrder(null)}
                    onConfirm={async (actor) => {
                        const res = await cm.moveWorkOrderStatus(closingWorkOrder.id, 'OK', actor);
                        setClosingWorkOrder(null);
                        return { error: res?.error ?? null };
                    }}
                />
            )}

            {/* Kanban Board pop-up */}
            <KanbanBoardModal
                open={showBoardModal}
                onClose={() => setShowBoardModal(false)}
                maintenances={filteredKanban}
                boardDate={boardDate}
                boardShift={boardShift}
                onChangeBoardDate={setBoardDate}
                onChangeBoardShift={setBoardShift}
                onMoveStatus={cm.moveMaintenanceStatus}
                onKonfirmasiShift={cm.konfirmasiShift}
                photosByMaintId={photosByMaintId}
                statusTimeByMaintId={statusTimeByMaintId}
            />

            {/* Modals — create */}
            <CriticalFormModal
                key={showCriticalForm ? 'critical-open' : 'critical-closed'}
                open={showCriticalForm}
                onClose={() => setShowCriticalForm(false)}
                onSubmit={cm.createCritical}
                operatorName={operator?.name}
            />
            <MaintenanceFormModal
                key={showMaintenanceForm ? `open-${maintenanceInitial?.critical_id ?? maintenanceInitial?.work_order_id ?? 'none'}` : 'closed'}
                open={showMaintenanceForm}
                onClose={() => {
                    setShowMaintenanceForm(false);
                    setMaintenanceInitial(undefined);
                    setMaintenanceRestrictTipe(undefined);
                    setActiveWorkOrderContext(null);
                    if (returnToDetailId) {
                        setExpandedCriticalId(returnToDetailId);
                        setReturnToDetailId(null);
                    }
                    if (returnToWOId) {
                        setExpandedWOId(returnToWOId);
                        setReturnToWOId(null);
                    }
                }}
                onSubmit={async (data) => {
                    const res = await cm.createMaintenance(data);
                    if (!res.error) {
                        if (data.critical_id) setReturnToDetailId(data.critical_id);
                        if (data.work_order_id) setReturnToWOId(data.work_order_id);
                    }
                    return res;
                }}
                onSubmitPreventifModifikasi={async (woData, uraian) => {
                    return await cm.createPreventifModifikasi(woData, uraian);
                }}
                activeCriticals={cm.criticals}
                workOrderContext={activeWorkOrderContext ?? undefined}
                initial={maintenanceInitial}
                operatorName={operator?.name}
                restrictTipe={maintenanceRestrictTipe}
            />
            {/* Modals — edit */}
            {editingCritical && (
                <CriticalFormModal
                    open={true}
                    onClose={() => setEditingCritical(null)}
                    initial={editingCritical}
                    onSubmit={async (data) => {
                        const res = await cm.updateCritical(editingCritical.id, data, operator?.name);
                        if (!res.error) setEditingCritical(null);
                        return res;
                    }}
                    operatorName={operator?.name}
                />
            )}
            {editingMaintenance && (
                <MaintenanceFormModal
                    open={true}
                    onClose={() => setEditingMaintenance(null)}
                    initial={editingMaintenance}
                    activeCriticals={cm.criticals}
                    onSubmit={async (data) => {
                        const res = await cm.updateMaintenance(editingMaintenance.id, data, operator?.name);
                        if (!res.error) setEditingMaintenance(null);
                        return res;
                    }}
                    operatorName={operator?.name}
                />
            )}
            {/* Work Order modals */}
            <WorkOrderFormModal
                key={showWorkOrderForm ? 'wo-open' : 'wo-closed'}
                open={showWorkOrderForm}
                onClose={() => setShowWorkOrderForm(false)}
                onSubmit={cm.createWorkOrder}
            />
            {editingWorkOrder && (
                <WorkOrderFormModal
                    open={true}
                    onClose={() => setEditingWorkOrder(null)}
                    initial={editingWorkOrder}
                    onSubmit={async (data) => {
                        const res = await cm.updateWorkOrder(editingWorkOrder.id, data as Partial<WorkOrderRow>, operator?.name);
                        if (!res.error) setEditingWorkOrder(null);
                        return res;
                    }}
                />
            )}
        </div>
    );
}
