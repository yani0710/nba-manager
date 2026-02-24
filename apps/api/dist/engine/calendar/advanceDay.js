"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.advanceDateByOneDay = advanceDateByOneDay;
function advanceDateByOneDay(currentDate) {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    return next;
}
//# sourceMappingURL=advanceDay.js.map