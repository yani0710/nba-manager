-- Phase 1 transfer foundation

ALTER TABLE "Team"
ADD COLUMN IF NOT EXISTS "dummy_transfer_marker" integer;

-- Prisma-managed relation fields on Team/Save/Player are virtual in client and do not require columns.
ALTER TABLE "InboxMessage"
ADD COLUMN IF NOT EXISTS "relatedOfferId" integer;

CREATE TABLE IF NOT EXISTS "TransferOffer" (
  "id" serial PRIMARY KEY,
  "saveId" integer NOT NULL,
  "fromTeamId" integer NOT NULL,
  "toTeamId" integer NOT NULL,
  "outgoingPlayerIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
  "incomingPlayerIds" integer[] NOT NULL DEFAULT ARRAY[]::integer[],
  "cashOut" integer NOT NULL DEFAULT 0,
  "cashIn" integer NOT NULL DEFAULT 0,
  "sellOnPct" integer,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "createdDay" integer NOT NULL,
  "resolveDay" integer NOT NULL,
  "aiReason" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" timestamp(3),
  CONSTRAINT "TransferOffer_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TransferOffer_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TransferOffer_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlayerContractProposal" (
  "id" serial PRIMARY KEY,
  "offerId" integer NOT NULL,
  "playerId" integer NOT NULL,
  "proposedSalary" integer NOT NULL,
  "years" integer NOT NULL,
  "role" text NOT NULL,
  "responseDeadlineDay" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'OFFERED',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerContractProposal_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TransferOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlayerContractProposal_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TransferOffer_saveId_status_resolveDay_idx"
ON "TransferOffer" ("saveId", "status", "resolveDay");

CREATE INDEX IF NOT EXISTS "TransferOffer_saveId_createdDay_idx"
ON "TransferOffer" ("saveId", "createdDay");

CREATE INDEX IF NOT EXISTS "PlayerContractProposal_offerId_status_idx"
ON "PlayerContractProposal" ("offerId", "status");

CREATE INDEX IF NOT EXISTS "PlayerContractProposal_playerId_idx"
ON "PlayerContractProposal" ("playerId");

CREATE INDEX IF NOT EXISTS "InboxMessage_relatedOfferId_idx"
ON "InboxMessage" ("relatedOfferId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InboxMessage_relatedOfferId_fkey'
  ) THEN
    ALTER TABLE "InboxMessage"
    ADD CONSTRAINT "InboxMessage_relatedOfferId_fkey"
    FOREIGN KEY ("relatedOfferId") REFERENCES "TransferOffer"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Cleanup no-op marker if it was added
ALTER TABLE "Team" DROP COLUMN IF EXISTS "dummy_transfer_marker";

