'use client';

import CriticalPage from '@/components/critical/CriticalPage';
import FeatureDisabled from '@/components/ui/FeatureDisabled';
import { DISABLED_FEATURES } from '@/lib/feature-flags';

export default function CriticalRoute() {
    if (DISABLED_FEATURES.critical) return <FeatureDisabled name="Critical & Maintenance" />;
    return <CriticalPage />;
}
