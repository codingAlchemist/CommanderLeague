-- Migration: decouple historical pod snapshots from the live players table.
-- Pod entries are point-in-time snapshots (players may since have changed or been removed),
-- so they should not be joined against the live roster via foreign key.

ALTER TABLE pods ADD COLUMN IF NOT EXISTS player_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb;
DROP TABLE IF EXISTS pod_players;
