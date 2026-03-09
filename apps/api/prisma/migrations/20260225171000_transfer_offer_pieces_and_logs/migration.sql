-- Phase 1 architecture refactor: join-table pieces + transaction logs

CREATE TABLE IF NOT EXISTS "TransferOfferPlayerPiece" (
  "id" serial PRIMARY KEY,
  "offerId" integer NOT NULL,
  "playerId" integer NOT NULL,
  "side" text NOT NULL,
  "direction" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransferOfferPlayerPiece_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TransferOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TransferOfferPlayerPiece_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TransferOfferPlayerPiece_offerId_playerId_side_direction_key"
ON "TransferOfferPlayerPiece" ("offerId", "playerId", "side", "direction");
CREATE INDEX IF NOT EXISTS "TransferOfferPlayerPiece_offerId_side_idx"
ON "TransferOfferPlayerPiece" ("offerId", "side");
CREATE INDEX IF NOT EXISTS "TransferOfferPlayerPiece_offerId_direction_idx"
ON "TransferOfferPlayerPiece" ("offerId", "direction");

CREATE TABLE IF NOT EXISTS "TransferTransactionLog" (
  "id" serial PRIMARY KEY,
  "saveId" integer NOT NULL,
  "offerId" integer NOT NULL,
  "fromTeamId" integer NOT NULL,
  "toTeamId" integer NOT NULL,
  "day" integer NOT NULL,
  "eventType" text NOT NULL,
  "status" text NOT NULL,
  "message" text,
  "payload" jsonb,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransferTransactionLog_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TransferTransactionLog_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TransferOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TransferTransactionLog_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TransferTransactionLog_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TransferTransactionLog_saveId_day_idx"
ON "TransferTransactionLog" ("saveId", "day");
CREATE INDEX IF NOT EXISTS "TransferTransactionLog_offerId_createdAt_idx"
ON "TransferTransactionLog" ("offerId", "createdAt");

-- Backfill join pieces from existing array fields (safe to rerun due unique index + conflict handling)
INSERT INTO "TransferOfferPlayerPiece" ("offerId", "playerId", "side", "direction")
SELECT t."id", unnest(t."outgoingPlayerIds"), 'FROM', 'OUT'
FROM "TransferOffer" t
WHERE array_length(t."outgoingPlayerIds", 1) IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "TransferOfferPlayerPiece" ("offerId", "playerId", "side", "direction")
SELECT t."id", unnest(t."incomingPlayerIds"), 'TO', 'IN'
FROM "TransferOffer" t
WHERE array_length(t."incomingPlayerIds", 1) IS NOT NULL
ON CONFLICT DO NOTHING;

