import { normalizeFixtureStatus } from "./fixtureStatus";

type TeamLike = {
  id: number;
  name: string;
  shortName: string;
  city?: string | null;
  logoPath?: string | null;
};

type GameLike = {
  id: number;
  saveId?: number | null;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  gameDate: Date;
  status: string;
  homeTeam: TeamLike;
  awayTeam: TeamLike;
};

export type FixtureModel = {
  id: number;
  saveId: number | null;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  gameDate: Date;
  status: string;
  homeTeam: TeamLike;
  awayTeam: TeamLike;
};

export function toFixtureModel(game: GameLike): FixtureModel {
  return {
    id: game.id,
    saveId: game.saveId ?? null,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    gameDate: game.gameDate,
    status: normalizeFixtureStatus(game.status),
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
  };
}

