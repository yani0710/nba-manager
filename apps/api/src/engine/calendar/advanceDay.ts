export function advanceDateByOneDay(currentDate: Date): Date {
  const next = new Date(currentDate);
  next.setDate(next.getDate() + 1);
  return next;
}
