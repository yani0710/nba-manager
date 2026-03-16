function pad(v) {
  return String(v).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function fromKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getGameweekForDate(season, dateKey) {
  const startYear = Number(String(season || '2025-26').slice(0, 4)) || 2025;
  const ranges = [];

  ranges.push({ week: 1, start: `${startYear}-10-21`, end: `${startYear}-10-26` });

  let pointer = fromKey(`${startYear}-10-27`);
  for (let week = 2; week <= 16; week += 1) {
    const start = pointer;
    const end = addDays(start, 6);
    ranges.push({ week, start: toDateKey(start), end: toDateKey(end) });
    pointer = addDays(end, 1);
  }

  ranges.push({ week: 17, start: `${startYear + 1}-02-09`, end: `${startYear + 1}-02-22` });
  ranges.push({ week: 18, start: `${startYear + 1}-02-23`, end: `${startYear + 1}-03-01` });
  ranges.push({ week: 19, start: `${startYear + 1}-03-02`, end: `${startYear + 1}-03-08` });
  ranges.push({ week: 20, start: `${startYear + 1}-03-09`, end: `${startYear + 1}-03-15` });
  ranges.push({ week: 21, start: `${startYear + 1}-03-16`, end: `${startYear + 1}-03-22` });
  ranges.push({ week: 22, start: `${startYear + 1}-03-23`, end: `${startYear + 1}-03-29` });
  ranges.push({ week: 23, start: `${startYear + 1}-03-30`, end: `${startYear + 1}-04-05` });
  ranges.push({ week: 24, start: `${startYear + 1}-04-06`, end: `${startYear + 1}-04-12` });

  for (const range of ranges) {
    if (dateKey >= range.start && dateKey <= range.end) return range.week;
  }
  if (dateKey < ranges[0].start) return 1;
  return 24;
}

