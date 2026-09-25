const express = require('express');
const cors = require('cors');
const {
  registerDeckRoutes,
  saveDeckForPlayer,
  getDeckByName,
  getDeckByPlayer,
} = require('./routes/deckRoutes');
const { registerEventRoutes } = require('./routes/eventRoutes');
const { registerAdminRoutes, readAdminCredentialsFromDb, writeAdminCredentialsToDb } = require('./routes/adminRoutes');
const {
  registerPlayerRoutes,
  readSignups,
  writeSignups,
  updatePlayerLookingForGame,
  readPlayersLookingForGame,
  DEFAULT_PLAYER_PASSWORD,
} = require('./routes/playerRoutes');
const { registerSignupRoutes } = require('./routes/signupRoutes');
const { registerPodRoutes, readPods, writePods } = require('./routes/podRoutes');
const { registerAchievementRoutes, readAchievements, writeAchievements, getAchievementPointsByRarity } = require('./routes/achievementRoutes');
const { registerScryfallRoutes } = require('./routes/scryfallRoutes');
const { registerWeekRoutes, readWeekState, writeWeekState } = require('./routes/weekRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());

function playerNeedsPasswordReset(player) {
  const storedPassword = typeof player?.password === 'string' ? player.password : '';
  return storedPassword === '' || storedPassword === DEFAULT_PLAYER_PASSWORD;
}

// Create pods (groupings) for a specific week from current signups
async function createPodsForWeek(week) {
  const signups = await readSignups();
  const activeSignups = signups.filter((signup) => !signup.absent);
  const totalPlayers = activeSignups.length;

  const minGroupSize = 3;
  const maxGroupSize = 4;
  const minGroups = Math.ceil(totalPlayers / maxGroupSize);
  const maxGroups = Math.floor(totalPlayers / minGroupSize);

  if (totalPlayers === 0) {
    return { week, groups: [], createdAt: new Date().toISOString() };
  }

  if (minGroups > maxGroups) {
    throw new Error(`Cannot create groups with ${minGroupSize}-${maxGroupSize} players each from ${totalPlayers} players.`);
  }

  const groupCount = minGroups;
  const baseSize = Math.floor(totalPlayers / groupCount);
  const groupsWithExtraPlayer = totalPlayers % groupCount;

  const shuffled = shuffleArray([...activeSignups]);

  const groups = [];
  let startIndex = 0;
  for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
    const currentGroupSize = baseSize + (groupIndex < groupsWithExtraPlayer ? 1 : 0);
    const groupPlayers = shuffled.slice(startIndex, startIndex + currentGroupSize);

    groups.push({
      groupNumber: groupIndex + 1,
      players: groupPlayers,
      winnerId: null
    });

    startIndex += currentGroupSize;
  }

  return { week, groups, createdAt: new Date().toISOString() };
}

// Ensure pods exist for a given week; create them if missing
async function ensurePodsForWeek(week) {
  try {
    const pods = await readPods();
    const existing = pods.find((p) => p.week === week);
    if (existing) return existing;

    const newPod = await createPodsForWeek(week);
    pods.push(newPod);
    await writePods(pods);
    return newPod;
  } catch (error) {
    console.error('Error ensuring pods for week:', error);
    throw error;
  }
}

function buildDeckListForPlayer(player) {
  const deckName = typeof player?.deckName === 'string' ? player.deckName.trim() : '';
  const commander = typeof player?.commander === 'string' ? player.commander.trim() : '';

  const deckCatalog = {
    'azorius control': [
      'Arcane Signet', 'Talisman of Curiosity', 'Command Tower', 'Flooded Strand', 'Hallowed Fountain',
      'Temple Garden', 'Seachrome Coast', 'Farseek', 'Cultivate', 'Sakura-Tribe Elder', 'Sol Ring',
      'Boseiju, Who Endures', 'Brainstorm', 'Mystic Remora', 'Swords to Plowshares', 'Heroic Intervention',
      'Supreme Verdict', 'The One Ring', 'Brago, King Eternal', 'Hallowed Moonlight'
    ],
    'golgari midrange': [
      'Sol Ring', 'Arcane Signet', 'Command Tower', 'Overgrown Tomb', 'Forest', 'Swamp', 'Farseek', 'Cultivate',
      'Deadly Dispute', 'Nature\'s Lore', 'Sakura - Tribe Elder', 'Boseiju, Who Endures', 'Villainous Wealth',
      'Meren of Clan Nel Toth', 'Ravenous Squirrel', 'Toxic Deluge', 'The Great Henge', 'Muldrotha, the Gravetide', 'Heroic Intervention'
    ],
    'mono-red burn': [
      'Sol Ring', 'Arcane Signet', 'Command Tower', 'Mountain', 'Rift Bolt', 'Lightning Bolt', 'Lava Spike',
      'Goblin Guide', 'Reckless Bushwhacker', 'Kiki-Jiki, Mirror Breaker', 'Searing Blaze', 'Monastery Swiftspear',
      'Mishra\'s Bauble', 'Fiery Islet', 'Rift Elemental', 'Sundial of the Infinite', 'Manamorphose', 'Boros Charm'
    ],
    'simic tempo': [
      'The One Ring', 'Arcane Signet', 'Cultivate', 'Nature\'s Lore', 'Farseek', 'Growth Spiral', 'Mana Leak',
      'Mystic Remora', 'Frilled Mystic', 'Merfolk Trickster', 'Spell Pierce', 'Command Tower', 'Scourge of Fleets',
      'Panharmonicon', 'Simic Signet', 'Mosswort Bridge', 'Edric, Spymaster of Trest', 'Ghostly Pilferer'
    ],
    'rakdos reanimator': [
      'Sol Ring', 'Arcane Signet', 'Command Tower', 'Bloodstained Mire', 'Badlands', 'Grim Tutor', 'Dark Ritual',
      'Reanimate', 'Animate Dead', 'Unearth', 'Vraska\'s Contempt', 'Beseech the Queen', 'Chainer, Dementia Master',
      'Necromancy', 'Dread Return', 'Myrkul, Lord of Bones', 'Thought Distortion', 'Griselbrand'
    ],
    'selesnya tokens': [
      'Sol Ring', 'Arcane Signet', 'Command Tower', 'Temple Garden', 'Forest', 'Plains', 'Cultivate', 'Farseek',
      'Anointed Procession', 'Rally the Ancestors', 'Rhys the Redeemed', 'Sakura-Tribe Elder', 'Spectral Procession',
      'Overwhelming Stampede', 'Unclaimed Territory', 'Canopy Vista', 'Beast Within', 'Heroic Intervention'
    ],
    'izzet spells': [
      'Sol Ring', 'Arcane Signet', 'Command Tower', 'Steam Vents', 'Izzet Boilerworks', 'Brainstorm', 'Ponder',
      'Mizzix of the Izmagnus', 'Spell Pierce', 'Magma Opus', 'Lightning Bolt', 'Electrostatic Field', 'Mizzium Mortars',
      'Shivan Reef', 'Chaos Warp', 'The One Ring', 'Frantic Search', 'Talisman of Creativity'
    ],
    'phyrexian combo': [
      'Sol Ring', 'Arcane Signet', 'Command Tower', 'Vraska\'s Contempt', 'All Is Dust', 'Noxious Revival', 'Glistener Elf',
      'Phyrexian Altar', 'Pact of Negation', 'Defense Grid', 'Aether Snap', 'Unmask', 'Beseech the Queen',
      'Vorinclex, Monstrous Raider', 'Toxic Deluge', 'Necropotence', 'Bala Ged Recovery', 'Barren Glory'
    ],
    'dimir milling': [
      'Sol Ring', 'Arcane Signet', 'Command Tower', 'Drowned Catacomb', 'Watery Grave', 'Overwhelming Intellect',
      'Hedron Crab', 'Tishana\'s Tidebinder', 'Drown in Ichor', 'Unsubstantiated Claim', 'Phenax, God of Deception',
      'Mind Grind', 'Necropotence', 'Murderous Rider', 'Dismal Backwater', 'Gaea\'s Blessing', 'Fractured Identity'
    ],
    'boros aggro': [
      'Sol Ring', 'Arcane Signet', 'Command Tower', 'Battlefield Forge', 'Wind-Scarred Crag', 'Lightning Helix', 'Path to Exile',
      'Rending Volley', 'Aurelia, the Warleader', 'Goblin Guide', 'Boros Charm', 'Adanto Vanguard', 'Sundial of the Infinite',
      'Heroic Reinforcements', 'Inspiring Vantage', 'Rally the Peasants', 'Mishra\'s Factory'
    ]
  };

  const deckKey = deckName.toLowerCase();
  const commanderKey = commander.toLowerCase();
  const deckList = deckCatalog[deckKey] || deckCatalog[commanderKey] || [
    commander || 'Commander',
    'Sol Ring',
    'Arcane Signet',
    'Command Tower',
    'Cultivate',
    'Farseek',
    'Nature\'s Lore',
    'Heroic Intervention',
    'The One Ring',
    'Talisman of Curiosity',
    'Mana Confluence',
    'Mystic Remora',
    'Boseiju, Who Endures',
    'Finale of Devotion',
    'Sakura-Tribe Elder',
    'Swords to Plowshares'
  ];

  return deckList.slice(0, 18);
}

function sanitizePlayer(player) {
  if (!player || typeof player !== 'object') {
    return player;
  }

  const { password, ...safePlayer } = player;
  return safePlayer;
}

function getPlayerDeckList(player) {
  if (Array.isArray(player?.deckList) && player.deckList.length > 0) {
    return [...player.deckList];
  }

  return buildDeckListForPlayer(player);
}

function withDeckList(player) {
  return {
    ...sanitizePlayer(player),
    deckList: getPlayerDeckList(player)
  };
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const sseClients = new Set();

function sendSseEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (err) {
      console.error('Failed to write SSE to client, removing:', err);
      sseClients.delete(res);
    }
  }
}

registerEventRoutes(app, { sseClients, sendSseEvent });
registerAdminRoutes(app, {
  readAdminCredentials: readAdminCredentialsFromDb,
  writeAdminCredentials: writeAdminCredentialsToDb,
});
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
  readAchievements,
});
registerSignupRoutes(app, {
  readSignups,
  writeSignups,
  saveDeckForPlayer,
  getDeckByName,
  getPlayerDeckList,
  readWeekState,
  readPods,
  writePods,
  createPodsForWeek,
  sendSseEvent,
  shuffleArray,
});
registerPodRoutes(app, {
  readSignups,
  readPods,
  writePods,
  createPodsForWeek,
  readWeekState,
  ensurePodsForWeek,
  shuffleArray,
});
registerAchievementRoutes(app, {
  readAchievements,
  writeAchievements,
  getAchievementPointsByRarity,
});
registerScryfallRoutes(app);
registerDeckRoutes(app, {});
registerWeekRoutes(app, { readWeekState, writeWeekState });

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize and start server
// Schema/data are provisioned via `npm run migrate` / `npm run seed`, not on boot.
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
