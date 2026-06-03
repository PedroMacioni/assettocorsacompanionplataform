-- Tabela principal de telemetria por volta
CREATE TABLE lap_telemetry (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_source_id  text NOT NULL,
  lap_number         integer NOT NULL,
  data               jsonb NOT NULL,
  sample_hz          smallint NOT NULL DEFAULT 20,
  synced_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_source_id, lap_number)
);

CREATE INDEX idx_lap_telemetry_session
  ON lap_telemetry (user_id, session_source_id);

ALTER TABLE lap_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lap_telemetry_owner" ON lap_telemetry
  FOR ALL USING (auth.uid() = user_id);
