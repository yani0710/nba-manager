"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.advanceDateByOneDay = advanceDateByOneDay;
function advanceDateByOneDay(currentDate) {
    const next = new Date(currentDate);
    // Use UTC day math to avoid DST/local-time rollover bugs.
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
}
//# sourceMappingURL=advanceDay.js.map