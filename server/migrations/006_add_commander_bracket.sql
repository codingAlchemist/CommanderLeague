-- Migration: track each player's commander bracket rating separately from looking_for_game.
CREATE TABLE IF NOT EXISTS players_looking_for_game (
  player_id         TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  commander_bracket INTEGER NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
