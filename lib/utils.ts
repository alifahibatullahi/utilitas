import { DEFAULT_THRESHOLDS, ALERT_COLORS } from './constants';

// Get alert status based on level percentage
export function getAlertStatus(level: number, thresholds = DEFAULT_THRESHOLDS) {
    if (level < thresholds.critical_low || level > thresholds.critical_high) {
        return 'critical';
    }
    if (level < thresholds.warning_low || level > thresholds.warning_high) {
        return 'warning';
    }
    return 'normal';
}

// Get alert visual config
export function getAlertConfig(level: number) {
    const status = getAlertStatus(level);
    return ALERT_COLORS[status];
}

// Format relative time (e.g., "2 menit lalu")
export function formatRelativeTime(date: Date | string): string {
    const now = new Date();
    const target = new Date(date);
    const diffMs = now.getTime() - target.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    return `${diffDay} hari lalu`;
}

// Format date time to locale string
export function formatDateTime(date: Date | string): string {
    return new Date(date).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Format date only
export function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
}

// Generate dummy trend data (1 hour, every 5 min = 12 points)
export function generateTrendData(currentLevel: number): { time: string; level: number }[] {
    const data = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 5 * 60 * 1000);
        const variation = (Math.random() - 0.5) * 10;
        data.push({
            time: time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            level: Math.max(0, Math.min(100, currentLevel + variation)),
        });
    }
    // Last point is the current level
    data[data.length - 1].level = currentLevel;
    return data;
}
