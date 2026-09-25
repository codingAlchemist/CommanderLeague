const pool = require('../config/db');

const DEFAULT_PLAYER_PASSWORD = 'CommanderLeague2026';

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
      lookingForGame: player.looking_for_game === true,
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
        `INSERT INTO players (id, player_name, email, discord_username, password, points, absent, looking_for_game, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           player_name = excluded.player_name,
           email = excluded.email,
           discord_username = excluded.discord_username,
           password = excluded.password,
           points = excluded.points,
           absent = excluded.absent,
           looking_for_game = excluded.looking_for_game,
           created_at = excluded.created_at`,
        [
          player.id,
          player.playerName,
          player.email,
          player.discordUsername,
          player.password || '',
          player.points || 0,
          player.absent === true,
          player.lookingForGame === true,
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

async function updatePlayerLookingForGame(playerId, lookingForGame, commanderBracket) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'UPDATE players SET looking_for_game = $2 WHERE id = $1 RETURNING id',
      [playerId, lookingForGame === true],
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    if (Number.isInteger(commanderBracket)) {
      await client.query(
        `INSERT INTO players_looking_for_game (player_id, commander_bracket, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (player_id) DO UPDATE SET commander_bracket = excluded.commander_bracket, updated_at = now()`,
        [playerId, commanderBracket],
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating player looking for game status:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function readPlayersLookingForGame() {
  const result = await pool.query(
    `SELECT id, player_name, email, discord_username, points, created_at
     FROM players
     WHERE looking_for_game = true
     ORDER BY player_name`,
  );
  return result.rows.map((player) => ({
    id: player.id,
    playerName: player.player_name,
    email: player.email,
    discordUsername: player.discord_username,
    points: player.points,
    createdAt: player.created_at.toISOString(),
  }));
}

function getCardName(card) {
  return typeof card === 'string' ? card : card?.name;
}

function getCardType(card, cardTypes = {}) {
  return typeof card === 'object' && typeof card?.type === 'string'
    ? card.type
    : cardTypes[getCardName(card)] || 'Other';
}

function getCardObjects(cards, cardTypes = {}) {
  return cards.map((card) => ({
    name: getCardName(card),
    type: getCardType(card, cardTypes),
  }));
}

module.exports = {
  DEFAULT_PLAYER_PASSWORD,
  readSignups,
  writeSignups,
  updatePlayerLookingForGame,
  readPlayersLookingForGame,
  registerPlayerRoutes(app, {
    readSignups,
    writeSignups,
    updatePlayerLookingForGame,
    readPlayersLookingForGame,
    DEFAULT_PLAYER_PASSWORD,
    playerNeedsPasswordReset,
    withDeckList,
    getPlayerDeckList,
    getDeckByPlayer,
    saveDeckForPlayer,
    readWeekState,
    readAchievements
  }) {
    app.post('/api/player/login', async (req, res) => {
      try {
        const { identifier, password } = req.body || {};

        if (typeof identifier !== 'string' || identifier.trim() === '') {
          return res.status(400).json({ error: 'Email or Discord username is required' });
        }

        if (typeof password !== 'string' || password.trim() === '') {
          return res.status(400).json({ error: 'Password is required' });
        }

        const signups = await readSignups();
        const normalizedIdentifier = identifier.trim().toLowerCase();
        const player = signups.find((signup) => {
          const email = typeof signup.email === 'string' ? signup.email.trim().toLowerCase() : '';
          const discord = typeof signup.discordUsername === 'string' ? signup.discordUsername.trim().toLowerCase() : '';
          return email === normalizedIdentifier || discord === normalizedIdentifier;
        });

        if (!player) {
          return res.status(401).json({ error: 'Player not found' });
        }

        const storedPassword = typeof player.password === 'string' ? player.password : '';
        const requiresPasswordReset = playerNeedsPasswordReset(player);

        if (requiresPasswordReset) {
          if (password !== DEFAULT_PLAYER_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
          }

          return res.status(200).json({
            ...withDeckList(player),
            requiresPasswordSetup: true,
            passwordNeedsReset: true,
            message: "Login Successful. Please set a new password to continue.",
            success: true
          });
        }

        if (password !== storedPassword) {
          return res.status(401).json({ error: 'Invalid password' });
        }

        return res.json({
          ...withDeckList(player),
          requiresPasswordSetup: false,
          passwordNeedsReset: false
        });
      } catch (error) {
        console.error('Error authenticating player:', error);
        return res.status(500).json({ error: 'Failed to authenticate player' });
      }
    });

    app.patch('/api/player/:id/password', async (req, res) => {
      try {
        const { id } = req.params;
        const { password } = req.body || {};

        if (typeof password !== 'string' || password.trim().length < 6) {
          return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const signups = await readSignups();
        const playerIndex = signups.findIndex((signup) => signup.id === id);

        if (playerIndex === -1) {
          return res.status(404).json({ error: 'Player not found' });
        }

        signups[playerIndex].password = password;
        await writeSignups(signups);

        return res.json({
          success: true,
          player: withDeckList(signups[playerIndex])
        });
      } catch (error) {
        console.error('Error setting player password:', error);
        return res.status(500).json({ error: 'Failed to save player password' });
      }
    });

    app.get('/api/player/looking-for-game', async (req, res) => {
      try {
        if (typeof readPlayersLookingForGame !== 'function') {
          return res.status(500).json({ error: 'Player lookup service is unavailable' });
        }

        const players = await readPlayersLookingForGame();
        return res.json(players);
      } catch (error) {
        console.error('Error retrieving players looking for a game:', error);
        return res.status(500).json({ error: 'Failed to retrieve players looking for a game' });
      }
    });

    app.patch('/api/player/:id/looking-for-game', async (req, res) => {
      try {
        const { id } = req.params;
        const { lookingForGame, commanderBracket } = req.body || {};

        if (typeof lookingForGame !== 'boolean') {
          return res.status(400).json({ error: 'lookingForGame must be a boolean' });
        }

        if (commanderBracket !== undefined && !Number.isInteger(commanderBracket)) {
          return res.status(400).json({ error: 'commanderBracket must be an integer' });
        }

        if (typeof updatePlayerLookingForGame !== 'function') {
          return res.status(500).json({ error: 'Player update service is unavailable' });
        }

        const updated = await updatePlayerLookingForGame(id, lookingForGame, commanderBracket);
        if (!updated) {
          return res.status(404).json({ error: 'Player not found' });
        }

        const signups = await readSignups();
        const player = signups.find((signup) => signup.id === id);

        return res.json(withDeckList(player));
      } catch (error) {
        console.error('Error updating player looking for game status:', error);
        return res.status(500).json({ error: 'Failed to update looking for game status' });
      }
    });

    app.patch('/api/player/:id/deck', async (req, res) => {
      try {
        const { id } = req.params;
        const { cardIndex, replacementCard, replacementCardType } = req.body || {};

        if (!Number.isInteger(cardIndex) || cardIndex < 0) {
          return res.status(400).json({ error: 'A valid card index is required.' });
        }

        if (typeof replacementCard !== 'string' || replacementCard.trim() === '') {
          return res.status(400).json({ error: 'A replacement card name is required.' });
        }

        if (typeof replacementCardType !== 'string' || replacementCardType.trim() === '') {
          return res.status(400).json({ error: 'A replacement card type is required.' });
        }

        const signups = await readSignups();
        const playerIndex = signups.findIndex((signup) => signup.id === id);

        if (playerIndex === -1) {
          return res.status(404).json({ error: 'Player not found' });
        }

        const player = signups[playerIndex];
        const storedDeck = typeof getDeckByPlayer === 'function'
          ? await getDeckByPlayer(player.playerName)
          : null;
        const storedCardTypes = storedDeck?.cardTypes || {};
        const deckList = Array.isArray(storedDeck?.cards)
          ? storedDeck.cards.map(getCardName)
          : getPlayerDeckList(player);
        if (cardIndex >= deckList.length) {
          return res.status(400).json({ error: 'The selected card index does not exist in this deck.' });
        }

        const replacedCardName = deckList[cardIndex];
        const cardName = replacementCard.trim();
        const cardType = replacementCardType.trim();
        deckList[cardIndex] = cardName;
        player.deckList = deckList;
        const cards = deckList.map((name, index) => ({
          name,
          type: index === cardIndex
            ? cardType
            : getCardType(storedDeck?.cards?.[index], storedCardTypes),
        }));
        if (storedDeck && typeof saveDeckForPlayer === 'function') {
          const weekState = typeof readWeekState === 'function' ? await readWeekState() : null;
          const swaps = Array.isArray(storedDeck.swaps) ? storedDeck.swaps : [];
          const swap = {
            card: cardName,
            cardType,
            date: new Date().toISOString(),
            week: Number.isInteger(weekState?.currentWeek) ? weekState.currentWeek : null,
          };
          await saveDeckForPlayer(player.playerName, {
            ...storedDeck,
            cards,
            swaps: [...swaps, swap],
          });
        }
        await writeSignups(signups);

        const cardsWithCommanderFlag = cards.map((card) => ({
          ...card,
          commander: card.name === player.commander,
        }));

        return res.json({
          ...withDeckList(player),
          deckList: cardsWithCommanderFlag,
        });
      } catch (error) {
        console.error('Error updating player deck:', error);
        return res.status(500).json({ error: 'Failed to update deck list' });
      }
    });

    app.patch('/api/player/:id/commander', async (req, res) => {
      try {
        const { id } = req.params;
        const { replacementCommander, replacementCommanderType } = req.body || {};

        if (typeof replacementCommander !== 'string' || replacementCommander.trim() === '') {
          return res.status(400).json({ error: 'A replacement commander name is required.' });
        }

        if (typeof replacementCommanderType !== 'string' || replacementCommanderType.trim() === '') {
          return res.status(400).json({ error: 'A replacement commander type is required.' });
        }

        const signups = await readSignups();
        const playerIndex = signups.findIndex((signup) => signup.id === id);
        if (playerIndex === -1) {
          return res.status(404).json({ error: 'Player not found' });
        }

        const player = signups[playerIndex];
        const storedDeck = typeof getDeckByPlayer === 'function'
          ? await getDeckByPlayer(player.playerName)
          : null;
        if (!storedDeck || !Array.isArray(storedDeck.cards) || storedDeck.cards.length === 0) {
          return res.status(400).json({ error: 'No deck is available to update its commander.' });
        }

        const commanderName = replacementCommander.trim();
        const commanderType = replacementCommanderType.trim();
        const cardTypes = storedDeck.cardTypes || {};
        const cards = getCardObjects(storedDeck.cards, cardTypes);
        const weekState = typeof readWeekState === 'function' ? await readWeekState() : null;
        const swaps = Array.isArray(storedDeck.swaps) ? storedDeck.swaps : [];

        player.commander = commanderName;
        player.deckList = cards.map((card) => card.name);
        if (player.deck && typeof player.deck === 'object') {
          player.deck.commander = commanderName;
          player.deck.cards = cards;
        }
        await saveDeckForPlayer(player.playerName, {
          ...storedDeck,
          commander: commanderName,
          cards,
          swaps: [...swaps, {
            card: commanderName,
            cardType: commanderType,
            date: new Date().toISOString(),
            week: Number.isInteger(weekState?.currentWeek) ? weekState.currentWeek : null,
          }],
        });
        await writeSignups(signups);

        return res.json(withDeckList(player));
      } catch (error) {
        console.error('Error updating player commander:', error);
        return res.status(500).json({ error: 'Failed to update commander' });
      }
    });

    app.get('/api/player/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const signups = await readSignups();
        const player = signups.find((signup) => signup.id === id);

        if (!player) {
          return res.status(404).json({ error: 'Player not found' });
        }

        return res.json(withDeckList(player));
      } catch (error) {
        console.error('Error retrieving player:', error);
        return res.status(500).json({ error: 'Failed to retrieve player' });
      }
    });

    app.get('/api/player/achievements', async (req, res) => {
      try {
        const signups = await readSignups();
        const playersWithAchievements = signups.map((player) => ({
          id: player.id,
          playerName: player.playerName,
          email: player.email,
          discordUsername: player.discordUsername,
          completedAchievements: Array.isArray(player.completedAchievements)
            ? player.completedAchievements
            : []
        }));

        return res.json(playersWithAchievements);
      } catch (error) {
        console.error('Error retrieving player achievements:', error);
        return res.status(500).json({ error: 'Failed to retrieve player achievements' });
      }
    });

    app.post('/api/player/:id/achievements', async (req, res) => {
      try {
        const { id } = req.params;
        const { achievementId } = req.body || {};

        if (typeof achievementId !== 'string' || achievementId.trim() === '') {
          return res.status(400).json({ error: 'Achievement ID is required' });
        }

        const signups = await readSignups();
        const playerIndex = signups.findIndex((signup) => signup.id === id);

        if (playerIndex === -1) {
          return res.status(404).json({ error: 'Player not found' });
        }

        if (typeof readAchievements !== 'function') {
          return res.status(500).json({ error: 'Achievement service is unavailable' });
        }

        const achievements = await readAchievements();
        const achievement = achievements.find((item) => item.id === achievementId);

        if (!achievement) {
          return res.status(404).json({ error: 'Achievement not found' });
        }

        const player = signups[playerIndex];
        const existingCompleted = Array.isArray(player.completedAchievements)
          ? player.completedAchievements
          : [];

        if (existingCompleted.includes(achievementId)) {
          return res.status(200).json({
            success: true,
            playerId: player.id,
            achievementId,
            completedAchievements: existingCompleted,
            points: Number.isFinite(player.points) ? Number(player.points) : 0,
            message: 'Achievement already completed'
          });
        }

        const nextCompleted = [...existingCompleted, achievementId];
        const nextPoints = (Number.isFinite(player.points) ? Number(player.points) : 0)
          + (Number.isInteger(achievement.points) ? achievement.points : 0);

        player.completedAchievements = nextCompleted;
        player.points = nextPoints;

        await writeSignups(signups);

        return res.status(200).json({
          success: true,
          playerId: player.id,
          achievementId,
          achievement,
          completedAchievements: nextCompleted,
          points: nextPoints
        });
      } catch (error) {
        console.error('Error completing player achievement:', error);
        return res.status(500).json({ error: 'Failed to complete achievement' });
      }
    });

    app.get('/api/players/achievements', async (req, res) => {
      return res.redirect('/api/player/achievements');
    });

    app.get('/api/player/:id/achievements', async (req, res) => {
      try {
        const { id } = req.params;
        const signups = await readSignups();
        const player = signups.find((signup) => signup.id === id);

        if (!player) {
          return res.status(404).json({ error: 'Player not found' });
        }

        return res.json({
          id: player.id,
          playerName: player.playerName,
          email: player.email,
          discordUsername: player.discordUsername,
          completedAchievements: Array.isArray(player.completedAchievements)
            ? player.completedAchievements
            : []
        });
      } catch (error) {
        console.error('Error retrieving player achievements:', error);
        return res.status(500).json({ error: 'Failed to retrieve player achievements' });
      }
    });

    return app;
  }
};
