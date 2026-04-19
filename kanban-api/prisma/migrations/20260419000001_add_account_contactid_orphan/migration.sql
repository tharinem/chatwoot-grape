-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "contact_id" INTEGER,
ADD COLUMN     "is_orphan" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "accounts" (
    "id" INTEGER NOT NULL,
    "chatwoot_base_url" TEXT NOT NULL,
    "chatwoot_api_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cards_account_id_contact_id_idx" ON "cards"("account_id", "contact_id");

