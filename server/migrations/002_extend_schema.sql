-- Migration: extend schema to support full pod snapshots and per-player curated deck lists.

ALTER TABLE weeks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE pods ADD COLUMN IF NOT EXISTS winner_id TEXT REFERENCES players(id) ON DELETE SET NULL;

-- Mirrors the arbitrary per-player deck payload previously stored in data/playerDecks.json (cards, types, swap history).
CREATE TABLE IF NOT EXISTS player_full_decks (
  player_name  TEXT PRIMARY KEY,
  deck         JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
