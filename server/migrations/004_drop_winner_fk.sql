-- winner_id refers to a player snapshot within player_snapshots, which may no longer
-- exist in the live players table; it should not be foreign-key constrained.
ALTER TABLE pods DROP CONSTRAINT IF EXISTS pods_winner_id_fkey;
