"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSeasonSchedule = generateSeasonSchedule;
function generateSeasonSchedule(teamIds, seasonStartDate) {
    const schedule = [];
    const ids = [...teamIds];
    if (ids.length < 2) {
        return schedule;
    }
    // Simplified round-robin style over ~26 weeks.
    for (let day = 0; day < 180; day++) {
        const gameDate = new Date(seasonStartDate);
        gameDate.setDate(seasonStartDate.getDate() + day);
        // 3-5 games per day
        const gameCount = 3 + (day % 3);
        for (let i = 0; i < gameCount; i++) {
            const home = ids[(day + i * 2) % ids.length];
            const away = ids[(day + i * 2 + 7) % ids.length];
            if (home === away) {
                continue;
            }
            schedule.push({
                homeTeamId: home,
                awayTeamId: away,
                gameDate,
                status: "scheduled",
                homeScore: 0,
                awayScore: 0,
            });
        }
    }
    return schedule;
}
//# sourceMappingURL=scheduleGenerator.js.map