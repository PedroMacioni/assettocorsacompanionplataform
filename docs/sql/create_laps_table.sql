-- Run this in the Supabase SQL Editor
-- Creates the laps table with per-lap and per-sector data

CREATE TABLE IF NOT EXISTS laps (
    id              uuid            DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_source_id text          NOT NULL,
    lap_number      integer         NOT NULL,
    time_ms         integer         NOT NULL,
    s1_ms           integer,
    s2_ms           integer,
    s3_ms           integer,
    cuts            integer         NOT NULL DEFAULT 0,
    tyre            text,
    UNIQUE (user_id, session_source_id, lap_number)
);

-- Index for the common query pattern (fetch all laps for a session)
CREATE INDEX IF NOT EXISTS laps_user_session_idx
    ON laps (user_id, session_source_id);

-- Row-level security
ALTER TABLE laps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own laps"
    ON laps FOR ALL
    USING (auth.uid() = user_id);
