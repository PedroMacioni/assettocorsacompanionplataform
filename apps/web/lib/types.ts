export type ProfileSummary = {
  user_id: string;
  total_sessions: number;
  total_laps: number;
  total_distance_km: number;
  unique_cars: number;
  unique_tracks: number;
  last_session_at: string | null;
  fastest_lap_ms: number | null;
};

export type Session = {
  id: string;
  source_id: string;
  started_at: string;
  driver_name: string | null;
  car_id: string;
  track_id: string;
  session_types: string | null;
  laps: number;
  distance_km: number | null;
  best_lap_ms: number | null;
  last_lap_ms: number | null;
};

export type PersonalBest = {
  id: string;
  car_id: string;
  track_id: string;
  time_ms: number;
  source_date: number | null;
};

export type TopCar = {
  user_id: string;
  car_id: string;
  sessions: number;
  total_laps: number;
  total_distance_km: number;
  best_lap_ms: number | null;
};

export type TopTrack = {
  user_id: string;
  track_id: string;
  sessions: number;
  total_laps: number;
  total_distance_km: number;
  best_lap_ms: number | null;
};

export type AgentStatus = {
  user_id: string;
  last_synced_at: string | null;
  last_sync_sessions_count: number;
  sync_requested_at: string | null;
};
