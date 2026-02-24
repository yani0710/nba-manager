TODO (not implemented in this pass)

- Import salary CSV as separate ETL stage (`etl:import:salary`).
- Extend `Contract` with cap-era metadata:
  - `capHit`, `luxuryTaxHit`, `birdRights`, `tradeKickerPct`.
- Add `TeamCapSheet` model by season:
  - `season`, `teamId`, `salaryTotal`, `capSpace`, `taxRoom`, `exceptions`.
- Add contract negotiation tables:
  - `Negotiation`, `NegotiationOffer`, `NegotiationEvent`.
- Add trade rules validator service:
  - salary matching, hard cap checks, roster size checks.

These items are intentionally deferred.

