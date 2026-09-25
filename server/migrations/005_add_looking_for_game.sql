-- Migration: track whether a player is currently looking for a game.
ALTER TABLE players ADD COLUMN IF NOT EXISTS looking_for_game BOOLEAN NOT NULL DEFAULT false;
