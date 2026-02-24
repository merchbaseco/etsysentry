export type ScrollAnchor = {
    offsetTop: number;
    rowId: string;
};

const getRows = (container: HTMLElement): HTMLElement[] => {
    return Array.from(container.querySelectorAll<HTMLElement>('[data-row-id]'));
};

export const captureScrollAnchor = (container: HTMLElement): ScrollAnchor | null => {
    const containerRect = container.getBoundingClientRect();

    for (const row of getRows(container)) {
        const rowRect = row.getBoundingClientRect();

        if (rowRect.bottom <= containerRect.top) {
            continue;
        }

        const rowId = row.dataset.rowId;

        if (!rowId) {
            continue;
        }

        return {
            offsetTop: rowRect.top - containerRect.top,
            rowId
        };
    }

    return null;
};

export const restoreScrollAnchor = (container: HTMLElement, anchor: ScrollAnchor | null): void => {
    if (!anchor) {
        return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRow = getRows(container).find((row) => row.dataset.rowId === anchor.rowId);

    if (!targetRow) {
        return;
    }

    const rowRect = targetRow.getBoundingClientRect();
    const offsetDelta = rowRect.top - containerRect.top - anchor.offsetTop;

    container.scrollTop += offsetDelta;
};

export const isScrollNearTop = (container: HTMLElement, thresholdPx = 24): boolean => {
    return container.scrollTop <= thresholdPx;
};
