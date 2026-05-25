-- Migration: Garage Redesign
-- Tabela car_specs: especificações técnicas importadas do ui_car.json do AC

CREATE TABLE IF NOT EXISTS car_specs (
  car_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  class TEXT,
  year INTEGER,
  bhp INTEGER,
  torque INTEGER,
  weight INTEGER,
  top_speed INTEGER,
  drivetrain TEXT,
  acceleration INTEGER, -- décimos de segundo (31 = 3.1s)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE car_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Car specs são públicas para leitura"
  ON car_specs FOR SELECT
  USING (true);

CREATE POLICY "Apenas sistema pode inserir specs"
  ON car_specs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Apenas sistema pode atualizar specs"
  ON car_specs FOR UPDATE
  USING (true);

-- Tabela car_setups: setups salvos por usuário/carro/pista

CREATE TABLE IF NOT EXISTS car_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  car_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  best_lap_ms INTEGER,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, car_id, track_id, name)
);

CREATE INDEX IF NOT EXISTS idx_car_setups_user_car ON car_setups(user_id, car_id);
CREATE INDEX IF NOT EXISTS idx_car_setups_user_car_track ON car_setups(user_id, car_id, track_id);

ALTER TABLE car_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas seus setups"
  ON car_setups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários inserem apenas seus setups"
  ON car_setups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários atualizam apenas seus setups"
  ON car_setups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários deletam apenas seus setups"
  ON car_setups FOR DELETE
  USING (auth.uid() = user_id);

-- Alteração: user_car_preferences — adicionar campo is_favorite

ALTER TABLE user_car_preferences
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
