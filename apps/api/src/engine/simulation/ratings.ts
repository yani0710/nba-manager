// Ratings - Player/team rating system (to be implemented)

export function calculatePlayerRating(player: any) {
  // Based on salary, position, performance
  return Math.min(99, Math.max(1, Math.floor(player.salary / 1500000)));
}

export function calculateTeamRating(players: any[]) {
  if (players.length === 0) return 50;
  const avgRating = players.reduce((sum, p) => sum + calculatePlayerRating(p), 0) / players.length;
  return Math.round(avgRating);
}
