"use strict";
// API utility functions
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginate = paginate;
exports.sortBy = sortBy;
function paginate(items, page, limit) {
    const skip = (page - 1) * limit;
    return {
        data: items.slice(skip, skip + limit),
        total: items.length,
        page,
        limit,
        totalPages: Math.ceil(items.length / limit),
    };
}
function sortBy(items, key, direction = 'asc') {
    const sorted = [...items].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal < bVal)
            return direction === 'asc' ? -1 : 1;
        if (aVal > bVal)
            return direction === 'asc' ? 1 : -1;
        return 0;
    });
    return sorted;
}
//# sourceMappingURL=helpers.js.map