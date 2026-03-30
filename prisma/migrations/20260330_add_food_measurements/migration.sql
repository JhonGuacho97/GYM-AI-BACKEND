-- Tabla de registro de comidas
CREATE TABLE IF NOT EXISTS "food_logs" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"   UUID         NOT NULL,
  "name"      VARCHAR(200) NOT NULL,
  "calories"  INTEGER      NOT NULL,
  "protein_g" DOUBLE PRECISION NOT NULL,
  "carbs_g"   DOUBLE PRECISION NOT NULL,
  "fat_g"     DOUBLE PRECISION NOT NULL,
  "meal_type" VARCHAR(20)  NOT NULL,
  "logged_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_food_logs_user_id" ON "food_logs"("user_id");

-- Tabla de mediciones corporales mensuales
CREATE TABLE IF NOT EXISTS "body_measurements" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      UUID        NOT NULL,
  "weight_kg"    DOUBLE PRECISION NOT NULL,
  "body_fat_pct" DOUBLE PRECISION,
  "waist_cm"     DOUBLE PRECISION,
  "notes"        TEXT,
  "measured_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "body_measurements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_body_measurements_user_id" ON "body_measurements"("user_id");
