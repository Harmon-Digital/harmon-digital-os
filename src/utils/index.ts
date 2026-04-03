


export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

/**
 * Parse a date-only string (YYYY-MM-DD) as local midnight instead of UTC.
 * new Date("2026-04-03") treats it as UTC midnight, which shifts back a day
 * in western timezones. This appends T00:00:00 to force local interpretation.
 */
export function parseLocalDate(dateStr: string): Date {
    if (!dateStr) return new Date(NaN);
    // If it's already a full ISO string or has a time component, parse as-is
    if (dateStr.includes('T') || dateStr.includes(' ')) return new Date(dateStr);
    return new Date(dateStr + 'T00:00:00');
}
