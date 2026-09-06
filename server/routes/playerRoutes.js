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
  registerPlayerRoutes(app, {
    readSignups,
    writeSignups,
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
        if (storedDeck && typeof saveDeckForPlayer === 'function') {
          const cards = deckList.map((name, index) => ({
            name,
            type: index === cardIndex
              ? cardType
              : getCardType(storedDeck.cards[index], storedCardTypes),
          }));
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

        return res.json(withDeckList(player));
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

        return res.status(201).json({
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
