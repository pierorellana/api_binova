CREATE TABLE "beneficiaries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "bank_name" VARCHAR(120) NOT NULL,
    "masked_account_number" VARCHAR(32) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_operations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "operation_type" VARCHAR(24) NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "amount" DECIMAL(18,2),
    "currency" CHAR(3),
    "request_json" JSONB NOT NULL DEFAULT '{}',
    "result_json" JSONB NOT NULL DEFAULT '{}',
    "resource_id" UUID,
    "provider_reference" VARCHAR(120),
    "failure_code" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_operations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "operation" VARCHAR(40) NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "operation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "beneficiaries_user_id_status_display_name_idx"
  ON "beneficiaries"("user_id", "status", "display_name");
CREATE INDEX "financial_operations_user_id_created_at_idx"
  ON "financial_operations"("user_id", "created_at" DESC);
CREATE INDEX "financial_operations_resource_id_idx"
  ON "financial_operations"("resource_id");
CREATE UNIQUE INDEX "idempotency_keys_user_id_operation_key_key"
  ON "idempotency_keys"("user_id", "operation", "key");

ALTER TABLE "beneficiaries"
  ADD CONSTRAINT "beneficiaries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_operations"
  ADD CONSTRAINT "financial_operations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_operation_id_fkey"
  FOREIGN KEY ("operation_id") REFERENCES "financial_operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
