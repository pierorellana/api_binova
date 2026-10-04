CREATE TABLE "profile_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "hide_balance" BOOLEAN NOT NULL DEFAULT false,
    "reduce_motion" BOOLEAN NOT NULL DEFAULT false,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profile_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_configs" (
    "id" UUID NOT NULL,
    "segment" VARCHAR(40) NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dashboard_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(240) NOT NULL,
    "resource_type" VARCHAR(40),
    "resource_id" UUID,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "device_registrations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" VARCHAR(16) NOT NULL,
    "push_token" TEXT NOT NULL,
    "device_label" VARCHAR(100),
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    CONSTRAINT "device_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profile_preferences_user_id_key" ON "profile_preferences"("user_id");
CREATE INDEX "dashboard_configs_segment_is_active_idx" ON "dashboard_configs"("segment", "is_active");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);
CREATE UNIQUE INDEX "device_registrations_user_id_push_token_key" ON "device_registrations"("user_id", "push_token");

ALTER TABLE "profile_preferences"
  ADD CONSTRAINT "profile_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "device_registrations"
  ADD CONSTRAINT "device_registrations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
