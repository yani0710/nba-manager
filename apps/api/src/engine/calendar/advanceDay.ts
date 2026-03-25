export function advanceDateByOneDay(currentDate: Date): Date {
  const next = new Date(currentDate);
  // Use UTC day math to avoid DST/local-time rollover bugs.
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
