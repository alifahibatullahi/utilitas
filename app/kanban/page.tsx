'use client';

import KanbanPage from '@/components/critical/KanbanPage';
import FeatureDisabled from '@/components/ui/FeatureDisabled';
import { DISABLED_FEATURES } from '@/lib/feature-flags';

export default function KanbanRoute() {
    if (DISABLED_FEATURES.kanban) return <FeatureDisabled name="Kanban Maintenance" />;
    return <KanbanPage />;
}
