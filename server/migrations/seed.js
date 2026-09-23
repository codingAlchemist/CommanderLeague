const pool = require('../config/db');

const achievements = require('../data/achievements.json');
const adminCredentials = require('../data/admin-credentials.json');
const weekState = require('../data/week-state.json');
const signups = require('../data/signups.json');
const pods = require('../data/pods.json');
const playerDecks = require('../data/playerDecks.json');

async function seedAdmin(client) {
  await client.query(
    `INSERT INTO admins (username, password)
     VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password = excluded.password`,
    [adminCredentials.username, adminCredentials.password],
  );
}

async function seedAchievements(client) {
  for (const achievement of achievements) {
    await client.query(
      `INSERT INTO achievements (id, title, description, rarity, category, points)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         rarity = excluded.rarity,
         category = excluded.category,
         points = excluded.points`,
      [achievement.id, achievement.title, achievement.description, achievement.rarity, achievement.category, achievement.points],
    );
  }
}

async function seedWeekState(client) {
  await client.query(
    `INSERT INTO week_state (id, current_week, started_weeks, total_weeks, updated_at)
     VALUES (1, $1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       current_week = excluded.current_week,
       started_weeks = excluded.started_weeks,
       total_weeks = excluded.total_weeks,
       updated_at = excluded.updated_at`,
    [weekState.currentWeek, weekState.startedWeeks, weekState.totalWeeks, weekState.updatedAt],
  );
}

async function upsertPlayer(client, player) {
  await client.query(
    `INSERT INTO players (id, player_name, email, discord_username, password, points, absent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       player_name = excluded.player_name,
       email = excluded.email,
       discord_username = excluded.discord_username,
       password = excluded.password,
       points = excluded.points,
       absent = excluded.absent,
       created_at = excluded.created_at`,
    [
      player.id,
      player.playerName,
      player.email,
      player.discordUsername,
      player.password || '',
      player.points || 0,
      player.absent === true,
      player.createdAt || new Date().toISOString(),
    ],
  );
}

async function seedDeck(client, playerId, deck) {
  if (!deck || !deck.name) return;

  const deckResult = await client.query(
    `INSERT INTO decks (player_id, name, commander)
     VALUES ($1, $2, $3)
     ON CONFLICT (player_id) DO UPDATE SET
       name = excluded.name,
       commander = excluded.commander
     RETURNING id`,
    [playerId, deck.name, deck.commander || ''],
  );
  const deckId = deckResult.rows[0].id;

  await client.query('DELETE FROM deck_cards WHERE deck_id = $1', [deckId]);

  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const isObject = card && typeof card === 'object';
    await client.query(
      `INSERT INTO deck_cards (deck_id, card_id, name, description, image_url, type, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        deckId,
        isObject ? card.id || null : null,
        isObject ? card.name : card,
        isObject ? card.description || null : null,
        isObject ? card.imageUrl || null : null,
        isObject ? card.type || null : null,
        i,
      ],
    );
  }
}

async function seedPlayerAchievements(client, playerId, completedAchievements) {
  await client.query('DELETE FROM player_achievements WHERE player_id = $1', [playerId]);

  const ids = Array.isArray(completedAchievements) ? completedAchievements : [];
  for (const achievementId of ids) {
    await client.query(
      `INSERT INTO player_achievements (player_id, achievement_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [playerId, achievementId],
    );
  }
}

async function seedSignups(client) {
  for (const player of signups) {
    await upsertPlayer(client, player);
    await seedDeck(client, player.id, player.deck);
    await seedPlayerAchievements(client, player.id, player.completedAchievements);
  }
}

async function seedPlayerFullDecks(client) {
  for (const [playerName, deck] of Object.entries(playerDecks)) {
    await client.query(
      `INSERT INTO player_full_decks (player_name, deck)
       VALUES ($1, $2)
       ON CONFLICT (player_name) DO UPDATE SET deck = excluded.deck, updated_at = now()`,
      [playerName, JSON.stringify(deck)],
    );
  }
}

async function seedPods(client) {
  for (const weekEntry of pods) {
    await client.query(
      `INSERT INTO weeks (week_number, created_at)
       VALUES ($1, $2)
       ON CONFLICT (week_number) DO UPDATE SET created_at = excluded.created_at`,
      [weekEntry.week, weekEntry.createdAt || new Date().toISOString()],
    );

    for (const group of weekEntry.groups || []) {
      await client.query(
        `INSERT INTO pods (week_number, group_number, winner_id, player_snapshots)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (week_number, group_number) DO UPDATE SET
           winner_id = excluded.winner_id,
           player_snapshots = excluded.player_snapshots`,
        [weekEntry.week, group.groupNumber, group.winnerId || null, JSON.stringify(group.players || [])],
      );
    }
  }
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seedAdmin(client);
    await seedAchievements(client);
    await seedWeekState(client);
    await seedSignups(client);
    await seedPlayerFullDecks(client);
    await seedPods(client);
    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
