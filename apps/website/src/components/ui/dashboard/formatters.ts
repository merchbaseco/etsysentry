export function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 1) {
        return 'just now';
    }

    if (mins < 60) {
        return `${mins}m ago`;
    }

    const hrs = Math.floor(mins / 60);

    if (hrs < 24) {
        return `${hrs}h ago`;
    }

    const days = Math.floor(hrs / 24);

    return `${days}d ago`;
}

export function timeUntil(dateStr: string): string {
    const diff = new Date(dateStr).getTime() - Date.now();

    if (diff <= 60000) {
        return 'Now';
    }

    const mins = Math.floor(diff / 60000);

    if (mins < 60) {
        return `in ${mins}m`;
    }

    const hrs = Math.floor(mins / 60);

    if (hrs < 24) {
        return `in ${hrs}h`;
    }

    const days = Math.floor(hrs / 24);

    return `in ${days}d`;
}

export function formatNumber(value: number): string {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
    }

    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
    }

    return value.toLocaleString();
}
