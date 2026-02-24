import './PlayerCard.css';

const display = (value) => (value === null || value === undefined ? '--' : value);

export function PlayerCard({ player, onOpen }) {
  const play = player?.attributes?.play;
  const derive = () => {
    const src = [
      ['Scoring pressure', player?.attributes?.att],
      ['On-ball creation', player?.attributes?.play],
      ['Defensive impact', player?.attributes?.def],
      ['Physical profile', player?.attributes?.phy],
      ['Game IQ', player?.attributes?.iq],
    ].filter((x) => typeof x[1] === 'number');
    const sorted = [...src].sort((a, b) => b[1] - a[1]);
    return {
      strengths: sorted.slice(0, 3).map((x) => x[0]),
      weaknesses: sorted.slice(-2).map((x) => x[0]),
    };
  };
  const inferred = derive();
  const strengths = player?.scouting?.strengths ?? inferred.strengths;
  const weaknesses = player?.scouting?.weaknesses ?? inferred.weaknesses;

  return (
    <button type="button" className="player-card" onClick={() => onOpen(player)} aria-label={`Open ${player.name}`}>
      <div className="player-card-inner">
        <div className="player-card-face player-card-front">
          <div className="overall-chip">{display(player.overallCurrent ?? player.effectiveOverall ?? player.overall)}</div>
          <h3>{player.name}</h3>
          <p>{player.team?.shortName || '--'} · {player.position || '--'}</p>
          <div className="badge-row">
            <span>ATT {display(player.offensiveRating)}</span>
            <span>DEF {display(player.defensiveRating)}</span>
            <span>PHY {display(player.physicalRating)}</span>
            <span>PLAY {display(play)}</span>
          </div>
        </div>
        <div className="player-card-face player-card-back">
          <h4>Strengths</h4>
          {strengths.length === 0 ? <p>Scouting not ready</p> : strengths.map((s) => <p key={s}>+ {s}</p>)}
          <h4 style={{ marginTop: 8 }}>Weaknesses</h4>
          {weaknesses.length === 0 ? <p>No clear weakness</p> : weaknesses.map((s) => <p key={s}>- {s}</p>)}
        </div>
      </div>
    </button>
  );
}
