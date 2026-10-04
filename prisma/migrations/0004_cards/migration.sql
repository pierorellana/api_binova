CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID,
    "type" VARCHAR(24) NOT NULL,
    "product_name" VARCHAR(80) NOT NULL,
    "masked_pan" VARCHAR(32) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'active',
    "is_virtual" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frozen_at" TIMESTAMP(3),
    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "card_limits" (
    "id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "daily_purchase_limit" DECIMAL(18,2) NOT NULL,
    "daily_withdrawal_limit" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "card_limits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_provisioning" (
    "id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "wallet" VARCHAR(32) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'processing',
    "provider_reference" VARCHAR(120),
    "provisioning_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wallet_provisioning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "card_limits_card_id_key" ON "card_limits"("card_id");
CREATE INDEX "cards_user_id_status_idx" ON "cards"("user_id", "status");
CREATE INDEX "wallet_provisioning_card_id_created_at_idx"
  ON "wallet_provisioning"("card_id", "created_at" DESC);

ALTER TABLE "cards"
  ADD CONSTRAINT "cards_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cards"
  ADD CONSTRAINT "cards_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "card_limits"
  ADD CONSTRAINT "card_limits_card_id_fkey"
  FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_provisioning"
  ADD CONSTRAINT "wallet_provisioning_card_id_fkey"
  FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_provisioning"
  ADD CONSTRAINT "wallet_provisioning_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
