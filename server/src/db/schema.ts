export const sqliteSchema = `
CREATE TABLE IF NOT EXISTS robot_status (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  token TEXT NOT NULL,
  battery_percent INTEGER NOT NULL,
  is_charging INTEGER NOT NULL,
  is_connected INTEGER NOT NULL,
  last_seen TEXT NOT NULL,
  firmware_version TEXT NOT NULL,
  mood TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_value TEXT NOT NULL,
  conditions_json TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  delay_ms INTEGER NOT NULL,
  repeat_value TEXT NOT NULL,
  last_run_at TEXT
);

CREATE TABLE IF NOT EXISTS command_logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  result_message TEXT NOT NULL
);
`;

