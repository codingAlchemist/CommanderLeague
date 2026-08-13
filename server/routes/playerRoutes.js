module.exports = {
  registerPlayerRoutes(app, {
    readSignups,
    writeSignups,
    DEFAULT_PLAYER_PASSWORD,
    playerNeedsPasswordReset,
    withDeckList,
    getPlayerDeckList
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
            passwordNeedsReset: true
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
        const { cardIndex, replacementCard } = req.body || {};

        if (!Number.isInteger(cardIndex) || cardIndex < 0) {
          return res.status(400).json({ error: 'A valid card index is required.' });
        }

        if (typeof replacementCard !== 'string' || replacementCard.trim() === '') {
          return res.status(400).json({ error: 'A replacement card name is required.' });
        }

        const signups = await readSignups();
        const playerIndex = signups.findIndex((signup) => signup.id === id);

        if (playerIndex === -1) {
          return res.status(404).json({ error: 'Player not found' });
        }

        const deckList = getPlayerDeckList(signups[playerIndex]);
        if (cardIndex >= deckList.length) {
          return res.status(400).json({ error: 'The selected card index does not exist in this deck.' });
        }

        deckList[cardIndex] = replacementCard.trim();
        signups[playerIndex].deckList = deckList;
        await writeSignups(signups);

        return res.json(withDeckList(signups[playerIndex]));
      } catch (error) {
        console.error('Error updating player deck:', error);
        return res.status(500).json({ error: 'Failed to update deck list' });
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
