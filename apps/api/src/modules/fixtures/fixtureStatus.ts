export const FIXTURE_STATUSES = [
  "scheduled",
  "live",
  "simulated",
  "completed",
  "postponed",
  // Legacy status still present in existing saves.
  "final",
] as const;

export type FixtureStatus = (typeof FIXTURE_STATUSES)[number];

export const SIMULATABLE_GAME_STATUSES: FixtureStatus[] = ["scheduled"];
export const UPCOMING_GAME_STATUSES: FixtureStatus[] = ["scheduled", "live", "postponed"];
export const COMPLETED_GAME_STATUSES: FixtureStatus[] = ["simulated", "completed", "final"];

export function normalizeFixtureStatus(value: string | null | undefined): FixtureStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "final") return "completed";
  if (FIXTURE_STATUSES.includes(normalized as FixtureStatus)) {
    return normalized as FixtureStatus;
  }
  return "scheduled";
}

export function isCompletedFixtureStatus(value: string | null | undefined): boolean {
  return COMPLETED_GAME_STATUSES.includes(String(value ?? "").trim().toLowerCase() as FixtureStatus);
}

