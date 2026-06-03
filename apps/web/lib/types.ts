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

export type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  country: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  profile_visibility: "private" | "friends" | "public";
  favorite_track_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  created_at: string;
  responded_at: string | null;
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
  synced_at: string;
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

export type Track = {
  track_id: string;
  name: string;
  country: string | null;
  city: string | null;
  length_km: number | null;
  pitboxes: number | null;
  run: string | null;
  tags: string[] | null;
  description: string | null;
  outline_url: string | null;
};

export type Lap = {
  id: string;
  session_source_id: string;
  lap_number: number;
  time_ms: number;
  s1_ms: number | null;
  s2_ms: number | null;
  s3_ms: number | null;
  cuts: number;
  tyre: string | null;
};

export type AgentStatus = {
  user_id: string;
  last_synced_at: string | null;
  last_sync_sessions_count: number;
  sync_requested_at: string | null;
};

export type UserCarPreference = {
  user_id: string;
  car_id: string;
  display_name: string | null;
  is_favorite: boolean;
  updated_at: string;
};

export type CarSpecs = {
  car_id: string;
  name: string;
  brand: string | null;
  class: string | null;
  year: number | null;
  bhp: number | null;
  torque: number | null;
  weight: number | null;
  top_speed: number | null;
  drivetrain: string | null;
  acceleration: number | null;
  updated_at: string;
};

export type SetupData = {
  [section: string]: {
    VALUE?: number;
    [key: string]: number | string | undefined;
  };
};

export type CarSetup = {
  id: string;
  user_id: string;
  car_id: string;
  track_id: string;
  name: string;
  data: SetupData;
  best_lap_ms: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SessionBadge = "new_pb" | "consistent" | null;

export type SessionWithMeta = Session & {
  deltaPbMs: number | null;
  badge: SessionBadge;
};

export type TelemetryPoint = [
  number,  // 0: x (world coord ×10)
  number,  // 1: y (world coord ×10) — AC longitudinal axis
  number,  // 2: z (world coord ×10) — AC height (≈0 on flat track)
  number,  // 3: speed km/h
  number,  // 4: throttle 0-100
  number,  // 5: brake 0-100
];

export type LapTelemetryData = {
  p: TelemetryPoint[];   // points array
  s: number[];           // normalizedCarPosition dos limites de setor [s1_end, s2_end]
  mv: number;            // max speed
  dur: number;           // duration ms
};

export type LapTelemetry = {
  id: string;
  session_source_id: string;
  lap_number: number;
  data: LapTelemetryData;
  sample_hz: number;
  synced_at: string;
};
