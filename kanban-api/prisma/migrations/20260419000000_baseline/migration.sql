-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL,
    "account_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "color" TEXT,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "account_id" INTEGER NOT NULL,
    "stage_id" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "conversation_id" INTEGER,
    "channel_type" TEXT,
    "assignee_id" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "deal_value" DOUBLE PRECISION,
    "priority" TEXT,
    "next_follow_up" TIMESTAMP(3),
    "agent_name" TEXT,
    "agent_avatar" TEXT,
    "custom_fields" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_notes" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_activities" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_stage" TEXT,
    "to_stage" TEXT,
    "agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "account_id" INTEGER NOT NULL,
    "key_hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stages_account_id_idx" ON "stages"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "stages_account_id_position_key" ON "stages"("account_id", "position");

-- CreateIndex
CREATE INDEX "cards_account_id_stage_id_idx" ON "cards"("account_id", "stage_id");

-- CreateIndex
CREATE INDEX "cards_account_id_conversation_id_idx" ON "cards"("account_id", "conversation_id");

-- CreateIndex
CREATE INDEX "cards_account_id_deleted_at_idx" ON "cards"("account_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cards_account_id_conversation_id_key" ON "cards"("account_id", "conversation_id");

-- CreateIndex
CREATE INDEX "card_notes_card_id_idx" ON "card_notes"("card_id");

-- CreateIndex
CREATE INDEX "card_activities_card_id_idx" ON "card_activities"("card_id");

-- CreateIndex
CREATE INDEX "api_keys_account_id_idx" ON "api_keys"("account_id");

-- CreateIndex
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_notes" ADD CONSTRAINT "card_notes_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_activities" ADD CONSTRAINT "card_activities_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

