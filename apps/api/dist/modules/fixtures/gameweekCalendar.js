"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameweekForDate = getGameweekForDate;
exports.getGameweekRanges = getGameweekRanges;
function toUtcDate(year, month, day) {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}
function addDays(date, days) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}
function buildGameweekRanges(season) {
    const startYear = Number(String(season ?? "2025-26").slice(0, 4)) || 2025;
    const out = [];
    out.push({ week: 1, start: toUtcDate(startYear, 10, 21), end: toUtcDate(startYear, 10, 26) });
    let pointer = toUtcDate(startYear, 10, 27);
    for (let week = 2; week <= 16; week += 1) {
        const start = pointer;
        const end = addDays(start, 6);
        out.push({ week, start, end });
        pointer = addDays(end, 1);
    }
    out.push({ week: 17, start: toUtcDate(startYear + 1, 2, 9), end: toUtcDate(startYear + 1, 2, 22) });
    out.push({ week: 18, start: toUtcDate(startYear + 1, 2, 23), end: toUtcDate(startYear + 1, 3, 1) });
    out.push({ week: 19, start: toUtcDate(startYear + 1, 3, 2), end: toUtcDate(startYear + 1, 3, 8) });
    out.push({ week: 20, start: toUtcDate(startYear + 1, 3, 9), end: toUtcDate(startYear + 1, 3, 15) });
    out.push({ week: 21, start: toUtcDate(startYear + 1, 3, 16), end: toUtcDate(startYear + 1, 3, 22) });
    out.push({ week: 22, start: toUtcDate(startYear + 1, 3, 23), end: toUtcDate(startYear + 1, 3, 29) });
    out.push({ week: 23, start: toUtcDate(startYear + 1, 3, 30), end: toUtcDate(startYear + 1, 4, 5) });
    out.push({ week: 24, start: toUtcDate(startYear + 1, 4, 6), end: toUtcDate(startYear + 1, 4, 12) });
    return out;
}
function normalizeDate(input) {
    if (input instanceof Date) {
        return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate(), 0, 0, 0, 0));
    }
    return new Date(`${String(input).slice(0, 10)}T00:00:00.000Z`);
}
function getGameweekForDate(season, date) {
    const ranges = buildGameweekRanges(season);
    const value = normalizeDate(date);
    for (const range of ranges) {
        if (value >= range.start && value <= range.end) {
            return range.week;
        }
    }
    if (value < ranges[0].start)
        return 1;
    return 24;
}
function getGameweekRanges(season) {
    return buildGameweekRanges(season).map((range) => ({
        week: range.week,
        start: range.start.toISOString().slice(0, 10),
        end: range.end.toISOString().slice(0, 10),
    }));
}
//# sourceMappingURL=gameweekCalendar.js.map