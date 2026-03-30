-- Nuevos campos en user_profiles para calcular macros
ALTER TABLE "user_profiles"
  ADD COLUMN IF NOT EXISTS "age"       INTEGER,
  ADD COLUMN IF NOT EXISTS "gender"    VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "height_cm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "weight_kg" DOUBLE PRECISION;

-- Tabla de sesiones de entrenamiento
CREATE TABLE IF NOT EXISTS "workout_sessions" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      UUID        NOT NULL,
  "plan_id"      UUID        NOT NULL,
  "day_name"     VARCHAR(20) NOT NULL,
  "notes"        TEXT,
  "completed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workout_sessions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_workout_sessions_user_id"
  ON "workout_sessions"("user_id");

-- Tabla de ejercicios por sesión
CREATE TABLE IF NOT EXISTS "session_exercises" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "session_id"     UUID         NOT NULL,
  "exercise_name"  VARCHAR(100) NOT NULL,
  "sets_completed" INTEGER      NOT NULL,
  "reps_completed" VARCHAR(50)  NOT NULL,
  "weight_kg"      DOUBLE PRECISION,
  "rpe_actual"     INTEGER,

  CONSTRAINT "session_exercises_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_exercises_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_session_exercises_session_id"
  ON "session_exercises"("session_id");

-- Tabla de metas nutricionales
CREATE TABLE IF NOT EXISTS "nutrition_goals" (
  "user_id"         UUID    NOT NULL,
  "calories_target" INTEGER NOT NULL,
  "protein_g"       INTEGER NOT NULL,
  "carbs_g"         INTEGER NOT NULL,
  "fat_g"           INTEGER NOT NULL,
  "calculated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "nutrition_goals_pkey" PRIMARY KEY ("user_id")
);
