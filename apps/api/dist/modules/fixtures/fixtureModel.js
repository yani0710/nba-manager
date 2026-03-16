"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFixtureModel = toFixtureModel;
const fixtureStatus_1 = require("./fixtureStatus");
function toFixtureModel(game) {
    return {
        id: game.id,
        saveId: game.saveId ?? null,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        gameDate: game.gameDate,
        status: (0, fixtureStatus_1.normalizeFixtureStatus)(game.status),
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
    };
}
//# sourceMappingURL=fixtureModel.js.map