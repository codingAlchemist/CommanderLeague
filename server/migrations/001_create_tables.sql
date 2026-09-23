-- Migration: create core tables mirroring server/models (Player, Deck, Card, Achievement, Admin)
-- Also models the weekly signup structure (weeks -> groups -> players) and week-state.

CREATE TABLE IF NOT EXISTS admins (
  username    TEXT PRIMARY KEY,
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS achievements (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  rarity      TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic')),
  category    TEXT NOT NULL,
  points      INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS week_state (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_week   INTEGER NOT NULL DEFAULT 1,
  started_weeks  INTEGER[] NOT NULL DEFAULT '{}',
  total_weeks    INTEGER NOT NULL DEFAULT 8,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id                  TEXT PRIMARY KEY,
  player_name         TEXT NOT NULL,
  email               TEXT NOT NULL,
  discord_username    TEXT NOT NULL,
  password            TEXT NOT NULL,
  points              INTEGER NOT NULL DEFAULT 0,
  absent              BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decks (
  id           SERIAL PRIMARY KEY,
  player_id    TEXT NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  commander    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS deck_cards (
  id           SERIAL PRIMARY KEY,
  deck_id      INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  card_id      TEXT,
  name         TEXT NOT NULL,
  description  TEXT,
  image_url    TEXT,
  type         TEXT,
  position     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS player_achievements (
  player_id       TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id  TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS weeks (
  week_number  INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS pods (
  id            SERIAL PRIMARY KEY,
  week_number   INTEGER NOT NULL REFERENCES weeks(week_number) ON DELETE CASCADE,
  group_number  INTEGER NOT NULL,
  UNIQUE (week_number, group_number)
);

CREATE TABLE IF NOT EXISTS pod_players (
  pod_id     INTEGER NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (pod_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_cards_deck_id ON deck_cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_pod_players_player_id ON pod_players(player_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_player_id ON player_achievements(player_id);
