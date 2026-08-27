const fs = require('fs').promises;
const path = require('path');

const PLAYER_DECKS_FILE = path.join(__dirname, '..', 'data', 'playerDecks.json');
const PRECONS_FILE = path.join(__dirname, '..', 'data', 'decks_v2.json');

async function readDecks() {
  try {
    const data = await fs.readFile(PLAYER_DECKS_FILE, 'utf8');
    if (!data.trim()) {
      return [];
    }

    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading decks:', error);
    return [];
  }
}

async function saveDeckForPlayer(playerName, deck) {
  let playerDecks = {};

  try {
    const data = await fs.readFile(PLAYER_DECKS_FILE, 'utf8');
    if (data.trim()) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        playerDecks = parsed;
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading player decks:', error);
      throw error;
    }
  }

  playerDecks[playerName] = deck;
  await fs.writeFile(PLAYER_DECKS_FILE, JSON.stringify(playerDecks, null, 2));
}

async function getDeckByPlayer(playerName) {
  try {
    const data = await fs.readFile(PLAYER_DECKS_FILE, 'utf8');
    if (!data.trim()) {
      return null;
    }

    const playerDecks = JSON.parse(data);
    if (!playerDecks || typeof playerDecks !== 'object' || Array.isArray(playerDecks)) {
      return null;
    }

    return playerDecks[playerName] || null;
  } catch (error) {
    console.error('Error reading deck by player:', error);
    return null;
  }
}

async function getDecks() {
  const decks = await readDecks();
  if (decks.length > 0) {
    return decks;
  }

  try {
    const data = await fs.readFile(PRECONS_FILE, 'utf8');
    const precons = JSON.parse(data);

    if (!Array.isArray(precons)) {
      return [];
    }

    return precons.flatMap((precon) => {
      if (!Array.isArray(precon?.decks)) {
        return [];
      }

      return precon.decks
        .filter((deck) => typeof deck?.name === 'string' && deck.name.trim() !== '')
        .map((deck) => ({
          name: deck.name.trim(),
          setCode: typeof precon.set === 'string' ? precon.set.trim() : 'UNK',
        }));
    });
  } catch (error) {
    console.error('Error reading pre-con decks:', error);
    return [];
  }
}

async function getAllDecks() {
  try {
    const data = await fs.readFile(PRECONS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading all decks:', error);
    return [];
  }
}

async function getDeckByName(deckName) {
  const normalizedName = typeof deckName === 'string' ? deckName.trim().toLowerCase() : '';
  if (!normalizedName) {
    return null;
  }

  const decks = await getAllDecks();
  return decks.find((deck) => (
    typeof deck?.name === 'string' && deck.name.trim().toLowerCase() === normalizedName
  )) || null;
}

module.exports = {
  readDecks,
  saveDeckForPlayer,
  getDeckByPlayer,
  getDecks,
  getAllDecks,
  getDeckByName,
  registerDeckRoutes(app, { getDecks: loadDecks = getDecks }) {
    app.get('/api/decks', async (req, res) => {
      try {
        const decks = await loadDecks();
        res.json(decks);
      } catch (error) {
        console.error('Error fetching decks:', error);
        res.status(500).json({ error: 'Failed to fetch decks' });
      }
    });

    app.get('/api/decks/all', async (req, res) => {
      try {
        const decks = await getAllDecks();
        res.json(decks);
      } catch (error) {
        console.error('Error fetching all decks:', error);
        res.status(500).json({ error: 'Failed to fetch all decks' });
      }
    });

    app.get('/api/decks/name/:deckName', async (req, res) => {
      try {
        const deck = await getDeckByName(req.params.deckName);

        if (!deck) {
          return res.status(404).json({ error: 'Deck not found' });
        }

        return res.json(deck);
      } catch (error) {
        console.error('Error fetching deck by name:', error);
        return res.status(500).json({ error: 'Failed to fetch deck by name' });
      }
    });

    app.get('/api/decks/player/:playerName', async (req, res) => {
      try {
        const { playerName } = req.params;
        const deck = await getDeckByPlayer(playerName);

        if (!deck) {
          return res.status(404).json({ error: 'Deck not found for player' });
        }

        return res.json(deck);
      } catch (error) {
        console.error('Error fetching deck by player:', error);
        return res.status(500).json({ error: 'Failed to fetch deck for player' });
      }
    });

    return app;
  },
};
