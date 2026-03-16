const ET_TIMEZONE = 'America/New_York';

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  live: 'Live',
  simulated: 'Simulated',
  completed: 'Completed',
  postponed: 'Postponed',
  final: 'Completed',
};

export function normalizeFixtureStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized) return 'scheduled';
  if (normalized === 'final') return 'completed';
  return normalized;
}

export function isFixtureCompleted(fixture) {
  const status = normalizeFixtureStatus(fixture?.status);
  return status === 'simulated' || status === 'completed';
}

export function formatFixtureStatus(status) {
  return STATUS_LABELS[normalizeFixtureStatus(status)] || 'Scheduled';
}

export function getFixtureDateKeyEt(dateValue) {
  if (!dateValue) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateValue));
}

export function formatFixtureDate(dateValue) {
  if (!dateValue) return '-';
  return new Intl.DateTimeFormat(undefined, {
    timeZone: ET_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateValue));
}

export function formatFixtureDateTime(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  const datePart = formatFixtureDate(date);
  const timePart = new Intl.DateTimeFormat(undefined, {
    timeZone: ET_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
  return `${datePart}, ${timePart} ET`;
}

export function isFixtureSimulatable(fixture, currentDate) {
  if (!fixture || normalizeFixtureStatus(fixture.status) !== 'scheduled' || !currentDate) {
    return false;
  }
  const fixtureDay = getFixtureDateKeyEt(fixture.gameDate);
  if (!fixtureDay) return false;
  return fixtureDay <= String(currentDate);
}

