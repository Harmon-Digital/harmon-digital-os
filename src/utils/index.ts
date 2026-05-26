


export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

const ALLOWED_TAGS = new Set([
    "a", "b", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3",
    "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p", "pre", "s",
    "span", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead",
    "tr", "u", "ul",
]);
const ALLOWED_ATTRS = new Set([
    "href", "src", "alt", "title", "class", "target", "rel",
    "width", "height", "colspan", "rowspan",
]);

export function sanitizeHtml(dirty: string): string {
    const doc = new DOMParser().parseFromString(dirty, "text/html");
    const walk = (node: Node) => {
        for (const child of Array.from(node.childNodes)) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const el = child as Element;
                if (!ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
                    walk(el);
                    el.replaceWith(...Array.from(el.childNodes));
                    continue;
                }
                for (const attr of Array.from(el.attributes)) {
                    if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
                        el.removeAttribute(attr.name);
                    } else if (attr.name === "href" || attr.name === "src") {
                        const val = attr.value.trim().toLowerCase();
                        if (val.startsWith("javascript:") || val.startsWith("data:")) {
                            el.removeAttribute(attr.name);
                        }
                    }
                }
                if (el.tagName === "A") {
                    el.setAttribute("rel", "noopener noreferrer");
                }
                walk(el);
            }
        }
    };
    walk(doc.body);
    return doc.body.innerHTML;
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

export function formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
