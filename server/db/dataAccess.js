const pool = require('../config/db');

const DEFAULT_PLAYER_PASSWORD = 'CommanderLeague2026';
const DEFAULT_TOTAL_WEEKS = 8;

function getAchievementPointsByRarity(rarity) {
    switch (typeof rarity === 'string' ? rarity.toLowerCase() : '') {
        case 'common':
            return 5;
        case 'uncommon':
            return 8;
        case 'rare':
            return 12;
        case 'epic':
            return 20;
        default:
            return 5;
    }
}

// ---- Players / signups ----

async function readSignups() {
    const [playersResult, decksResult, deckCardsResult, achievementsResult] = await Promise.all([
        pool.query('SELECT * FROM players ORDER BY created_at'),
        pool.query('SELECT * FROM decks'),
        pool.query('SELECT * FROM deck_cards ORDER BY deck_id, position'),
        pool.query('SELECT * FROM player_achievements'),
    ]);

    const deckByPlayerId = new Map(decksResult.rows.map((deck) => [deck.player_id, deck]));

    const cardsByDeckId = new Map();
    for (const card of deckCardsResult.rows) {
        if (!cardsByDeckId.has(card.deck_id)) cardsByDeckId.set(card.deck_id, []);
        cardsByDeckId.get(card.deck_id).push(card);
    }

    const achievementsByPlayerId = new Map();
    for (const row of achievementsResult.rows) {
        if (!achievementsByPlayerId.has(row.player_id)) achievementsByPlayerId.set(row.player_id, []);
        achievementsByPlayerId.get(row.player_id).push(row.achievement_id);
    }

    return playersResult.rows.map((player) => {
        const deck = deckByPlayerId.get(player.id);
        const cards = deck ? (cardsByDeckId.get(deck.id) || []) : [];
        const password = typeof player.password === 'string' && player.password.trim() !== ''
            ? player.password
            : DEFAULT_PLAYER_PASSWORD;

        return {
            id: player.id,
            playerName: player.player_name,
            email: player.email,
            discordUsername: player.discord_username,
            password,
            deckName: deck ? deck.name : '',
            deck: {
                name: deck ? deck.name : '',
                cards: cards.map((card) => (card.card_id || card.description || card.image_url || card.type
                    ? { id: card.card_id, name: card.name, description: card.description, imageUrl: card.image_url, type: card.type }
                    : card.name)),
                commander: deck ? deck.commander : '',
            },
            commander: deck ? deck.commander : '',
            points: player.points,
            absent: player.absent === true,
            completedAchievements: achievementsByPlayerId.get(player.id) || [],
            createdAt: player.created_at.toISOString(),
        };
    });
}

async function writeSignups(signups) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ids = signups.map((player) => player.id);
        if (ids.length > 0) {
            await client.query('DELETE FROM players WHERE id <> ALL($1::text[])', [ids]);
        } else {
            await client.query('DELETE FROM players');
        }

        for (const player of signups) {
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

            if (player.deck && player.deck.name) {
                const deckResult = await client.query(
                    `INSERT INTO decks (player_id, name, commander)
           VALUES ($1, $2, $3)
           ON CONFLICT (player_id) DO UPDATE SET name = excluded.name, commander = excluded.commander
           RETURNING id`,
                    [player.id, player.deck.name, player.deck.commander || player.commander || ''],
                );
                const deckId = deckResult.rows[0].id;

                await client.query('DELETE FROM deck_cards WHERE deck_id = $1', [deckId]);

                const cards = Array.isArray(player.deck.cards) ? player.deck.cards : [];
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
            } else {
                await client.query('DELETE FROM decks WHERE player_id = $1', [player.id]);
            }

            await client.query('DELETE FROM player_achievements WHERE player_id = $1', [player.id]);
            const completed = Array.isArray(player.completedAchievements) ? player.completedAchievements : [];
            for (const achievementId of completed) {
                await client.query(
                    'INSERT INTO player_achievements (player_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [player.id, achievementId],
                );
            }
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error writing signups:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ---- Week state ----

async function readWeekState() {
    const result = await pool.query('SELECT * FROM week_state WHERE id = 1');
    if (result.rows.length === 0) {
        return {
            currentWeek: null,
            startedWeeks: [],
            totalWeeks: DEFAULT_TOTAL_WEEKS,
            updatedAt: new Date().toISOString(),
        };
    }

    const row = result.rows[0];
    return {
        currentWeek: row.current_week,
        startedWeeks: row.started_weeks || [],
        totalWeeks: row.total_weeks,
        updatedAt: row.updated_at.toISOString(),
    };
}

async function writeWeekState(weekState) {
    await pool.query(
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

// ---- Pods ----

async function readPods() {
    const [weeksResult, podsResult] = await Promise.all([
        pool.query('SELECT week_number, created_at FROM weeks ORDER BY week_number'),
        pool.query('SELECT week_number, group_number, winner_id, player_snapshots FROM pods ORDER BY week_number, group_number'),
    ]);

    const groupsByWeek = new Map();
    for (const pod of podsResult.rows) {
        if (!groupsByWeek.has(pod.week_number)) groupsByWeek.set(pod.week_number, []);
        groupsByWeek.get(pod.week_number).push({
            groupNumber: pod.group_number,
            players: pod.player_snapshots || [],
            winnerId: pod.winner_id,
        });
    }

    return weeksResult.rows.map((week) => ({
        week: week.week_number,
        groups: (groupsByWeek.get(week.week_number) || []).sort((a, b) => a.groupNumber - b.groupNumber),
        createdAt: week.created_at.toISOString(),
    }));
}

async function writePods(pods) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Weeks cascade-delete their pods.
        await client.query('DELETE FROM weeks');

        for (const weekEntry of pods) {
            await client.query(
                'INSERT INTO weeks (week_number, created_at) VALUES ($1, $2)',
                [weekEntry.week, weekEntry.createdAt || new Date().toISOString()],
            );

            for (const group of weekEntry.groups || []) {
                await client.query(
                    `INSERT INTO pods (week_number, group_number, winner_id, player_snapshots)
           VALUES ($1, $2, $3, $4)`,
                    [weekEntry.week, group.groupNumber, group.winnerId || null, JSON.stringify(group.players || [])],
                );
            }
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error writing pods:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ---- Achievements ----

async function readAchievements() {
    const result = await pool.query('SELECT * FROM achievements ORDER BY id');
    return result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        rarity: row.rarity,
        category: row.category,
        points: Number.isInteger(row.points) ? row.points : getAchievementPointsByRarity(row.rarity),
        createdAt: row.created_at.toISOString(),
    }));
}

async function writeAchievements(achievements) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const ids = achievements.map((achievement) => achievement.id);
        if (ids.length > 0) {
            await client.query('DELETE FROM achievements WHERE id <> ALL($1::text[])', [ids]);
        } else {
            await client.query('DELETE FROM achievements');
        }

        for (const achievement of achievements) {
            await client.query(
                `INSERT INTO achievements (id, title, description, rarity, category, points, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           rarity = excluded.rarity,
           category = excluded.category,
           points = excluded.points`,
                [
                    achievement.id,
                    achievement.title,
                    achievement.description,
                    achievement.rarity,
                    achievement.category,
                    achievement.points,
                    achievement.createdAt || new Date().toISOString(),
                ],
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error writing achievements:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ---- Admin credentials ----

async function readAdminCredentials() {
    const result = await pool.query('SELECT username, password FROM admins ORDER BY created_at ASC LIMIT 1');
    if (result.rows.length === 0) {
        throw new Error('Admin credentials not found');
    }
    return { username: result.rows[0].username, password: result.rows[0].password };
}

async function writeAdminCredentials(credentials) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM admins WHERE username <> $1', [credentials.username]);
        await client.query(
            `INSERT INTO admins (username, password)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password = excluded.password`,
            [credentials.username, credentials.password],
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error writing admin credentials:', error);
        throw error;
    } finally {
        client.release();
    }
}

// ---- Per-player curated deck lists (cards/types/swap history) ----

async function getDeckByPlayer(playerName) {
    const result = await pool.query('SELECT deck FROM player_full_decks WHERE player_name = $1', [playerName]);
    return result.rows.length > 0 ? result.rows[0].deck : null;
}

async function saveDeckForPlayer(playerName, deck) {
    await pool.query(
        `INSERT INTO player_full_decks (player_name, deck, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (player_name) DO UPDATE SET deck = excluded.deck, updated_at = now()`,
        [playerName, JSON.stringify(deck)],
    );
}

async function readPlayerFullDecks() {
    const result = await pool.query('SELECT deck FROM player_full_decks');
    return result.rows.map((row) => row.deck).filter(Boolean);
}

module.exports = {
    DEFAULT_PLAYER_PASSWORD,
    DEFAULT_TOTAL_WEEKS,
    getAchievementPointsByRarity,
    readSignups,
    writeSignups,
    readWeekState,
    writeWeekState,
    readPods,
    writePods,
    readAchievements,
    writeAchievements,
    readAdminCredentials,
    writeAdminCredentials,
    getDeckByPlayer,
    saveDeckForPlayer,
    readPlayerFullDecks,
};
