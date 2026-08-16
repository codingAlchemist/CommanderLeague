const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const Player = require('./models/Player');
const { registerEventRoutes } = require('./routes/eventRoutes');
const { registerAdminRoutes } = require('./routes/adminRoutes');
const { registerPlayerRoutes } = require('./routes/playerRoutes');
const { registerSignupRoutes } = require('./routes/signupRoutes');
const { registerPodRoutes } = require('./routes/podRoutes');
const { registerAchievementRoutes } = require('./routes/achievementRoutes');
const Admin = require('./models/Admin');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'data', 'signups.json');
const WEEK_STATE_FILE = path.join(__dirname, 'data', 'week-state.json');
const PODS_FILE = path.join(__dirname, 'data', 'pods.json');
const DECKS_FILE = path.join(__dirname, 'data', 'decks.json');
const ACHIEVEMENTS_FILE = path.join(__dirname, 'data', 'achievements.json');
const ADMIN_CREDENTIALS_FILE = path.join(__dirname, 'data', 'admin-credentials.json');
const DEFAULT_TOTAL_WEEKS = 8;
const MIN_TOTAL_WEEKS = 1;
const MAX_TOTAL_WEEKS = 10;
const DEFAULT_PLAYER_PASSWORD = 'CommanderLeague2026';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  // Initialize data file if it doesn't exist
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
  }

  try {
    await fs.access(WEEK_STATE_FILE);
  } catch {
    const initialWeekState = {
      currentWeek: null,
      startedWeeks: [],
      totalWeeks: DEFAULT_TOTAL_WEEKS,
      updatedAt: new Date().toISOString()
    };
    await fs.writeFile(WEEK_STATE_FILE, JSON.stringify(initialWeekState, null, 2));
  }

  try {
    await fs.access(ADMIN_CREDENTIALS_FILE);
  } catch {
    const initialAdminCredentials = Admin.fromRequest({
      username: 'jason.debottis@gmail.com',
      password: 'Area51Admin'
    }).toJSON();
    await fs.writeFile(ADMIN_CREDENTIALS_FILE, JSON.stringify(initialAdminCredentials, null, 2));
  }

  try {
    await fs.access(PODS_FILE);
  } catch {
    await fs.writeFile(PODS_FILE, JSON.stringify([], null, 2));
  }

  try {
    await fs.access(ACHIEVEMENTS_FILE);
  } catch {
    await fs.writeFile(ACHIEVEMENTS_FILE, JSON.stringify([], null, 2));
  }

  await applyDefaultPasswordsToExistingPlayers();
}

function playerNeedsPasswordReset(player) {
  const storedPassword = typeof player?.password === 'string' ? player.password : '';
  return storedPassword === '' || storedPassword === DEFAULT_PLAYER_PASSWORD;
}

// Read signups from file
async function readSignups() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((signup) => ({
      ...signup,
      password: typeof signup.password === 'string' && signup.password.trim() !== ''
        ? signup.password
        : DEFAULT_PLAYER_PASSWORD,
      absent: signup.absent === true
    }));
  } catch (error) {
    console.error('Error reading signups:', error);
    return [];
  }
}

async function applyDefaultPasswordsToExistingPlayers() {
  try {
    const signups = await readSignups();
    const needsUpdate = signups.some((signup) => typeof signup.password !== 'string' || signup.password.trim() === '');

    if (!needsUpdate) {
      return;
    }

    const updatedSignups = signups.map((signup) => ({
      ...signup,
      password: typeof signup.password === 'string' && signup.password.trim() !== ''
        ? signup.password
        : DEFAULT_PLAYER_PASSWORD,
    }));

    await writeSignups(updatedSignups);
  } catch (error) {
    console.error('Error applying default player passwords:', error);
  }
}

// Write signups to file
async function writeSignups(signups) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(signups, null, 2));
  } catch (error) {
    console.error('Error writing signups:', error);
    throw error;
  }
}

async function readWeekState() {
  try {
    const data = await fs.readFile(WEEK_STATE_FILE, 'utf8');
    const parsed = JSON.parse(data);

    const totalWeeks = Number.isInteger(parsed.totalWeeks)
      ? Math.max(MIN_TOTAL_WEEKS, Math.min(MAX_TOTAL_WEEKS, parsed.totalWeeks))
      : DEFAULT_TOTAL_WEEKS;

    const startedWeeks = Array.isArray(parsed.startedWeeks)
      ? parsed.startedWeeks
        .filter(week => Number.isInteger(week) && week > 0 && week <= totalWeeks)
        .sort((a, b) => a - b)
      : [];

    const currentWeek =
      typeof parsed.currentWeek === 'number' &&
        Number.isInteger(parsed.currentWeek) &&
        parsed.currentWeek > 0 &&
        parsed.currentWeek <= totalWeeks
        ? parsed.currentWeek
        : null;

    return {
      currentWeek,
      startedWeeks,
      totalWeeks,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString()
    };
  } catch (error) {
    console.error('Error reading week state:', error);
    return {
      currentWeek: null,
      startedWeeks: [],
      totalWeeks: DEFAULT_TOTAL_WEEKS,
      updatedAt: new Date().toISOString()
    };
  }
}

async function writeWeekState(weekState) {
  try {
    await fs.writeFile(WEEK_STATE_FILE, JSON.stringify(weekState, null, 2));
  } catch (error) {
    console.error('Error writing week state:', error);
    throw error;
  }
}

// Read pods from file
async function readPods() {
  try {
    const data = await fs.readFile(PODS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading pods:', error);
    return [];
  }
}

// Write pods to file
async function writePods(pods) {
  try {
    await fs.writeFile(PODS_FILE, JSON.stringify(pods, null, 2));
  } catch (error) {
    console.error('Error writing pods:', error);
    throw error;
  }
}

async function readDecks() {
  try {
    const data = await fs.readFile(DECKS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading decks:', error);
    return [];
  }
}

async function getDecks() {
  return readDecks();
}

function getAchievementPointsByRarity(rarity) {
  switch ((typeof rarity === 'string' ? rarity.toLowerCase() : '')) {
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

async function readAchievements() {
  try {
    const data = await fs.readFile(ACHIEVEMENTS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    const achievements = Array.isArray(parsed) ? parsed : [];

    return achievements.map((achievement) => ({
      ...achievement,
      points: Number.isInteger(achievement?.points)
        ? achievement.points
        : getAchievementPointsByRarity(achievement?.rarity)
    }));
  } catch (error) {
    console.error('Error reading achievements:', error);
    return [];
  }
}

async function writeAchievements(achievements) {
  try {
    await fs.writeFile(ACHIEVEMENTS_FILE, JSON.stringify(achievements, null, 2));
  } catch (error) {
    console.error('Error writing achievements:', error);
    throw error;
  }
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

async function readAdminCredentials() {
  const data = await fs.readFile(ADMIN_CREDENTIALS_FILE, 'utf8');
  const parsed = JSON.parse(data);

  if (typeof parsed.username !== 'string' || typeof parsed.password !== 'string') {
    throw new Error('Admin credentials file is invalid');
  }

  return {
    username: parsed.username,
    password: parsed.password
  };
}

async function writeAdminCredentials(credentials) {
  try {
    await fs.writeFile(ADMIN_CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
  } catch (error) {
    console.error('Error writing admin credentials:', error);
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
registerAdminRoutes(app, { readAdminCredentials, writeAdminCredentials });
registerPlayerRoutes(app, {
  readSignups,
  writeSignups,
  DEFAULT_PLAYER_PASSWORD,
  playerNeedsPasswordReset,
  withDeckList,
  getPlayerDeckList,
  readAchievements,
});
registerSignupRoutes(app, {
  readSignups,
  writeSignups,
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

app.get('/api/decks', async (req, res) => {
  try {
    const decks = await getDecks();
    res.json(decks);
  } catch (error) {
    console.error('Error fetching decks:', error);
    res.status(500).json({ error: 'Failed to fetch decks' });
  }
});

app.get('/api/week-state', async (req, res) => {
  try {
    const state = await readWeekState();
    res.json(state);
  } catch (error) {
    console.error('Error fetching week state:', error);
    res.status(500).json({ error: 'Failed to fetch week state' });
  }
});

app.patch('/api/week-state', async (req, res) => {
  try {
    const body = req.body || {};
    const currentState = await readWeekState();
    const totalWeeks = Math.max(MIN_TOTAL_WEEKS, Math.min(MAX_TOTAL_WEEKS, currentState.totalWeeks));

    const nextState = {
      ...currentState,
      currentWeek: body.currentWeek === null || body.currentWeek === undefined ? null : Number(body.currentWeek),
      startedWeeks: Array.isArray(body.startedWeeks)
        ? [...new Set(body.startedWeeks.map((week) => Number(week)).filter((week) => Number.isInteger(week) && week > 0 && week <= totalWeeks))].sort((a, b) => a - b)
        : currentState.startedWeeks,
      totalWeeks,
      updatedAt: new Date().toISOString(),
    };

    if (nextState.currentWeek !== null && (nextState.currentWeek < 1 || nextState.currentWeek > totalWeeks)) {
      nextState.currentWeek = null;
    }

    await writeWeekState(nextState);
    res.json(nextState);
  } catch (error) {
    console.error('Error updating week state:', error);
    res.status(500).json({ error: 'Failed to update week state' });
  }
});

app.patch('/api/week-state/total-weeks', async (req, res) => {
  try {
    const delta = Number(req.body?.delta ?? 0);
    const currentState = await readWeekState();
    const nextTotalWeeks = Math.max(MIN_TOTAL_WEEKS, Math.min(MAX_TOTAL_WEEKS, currentState.totalWeeks + (Number.isInteger(delta) ? delta : 0)));

    const nextState = {
      ...currentState,
      totalWeeks: nextTotalWeeks,
      currentWeek: currentState.currentWeek !== null && currentState.currentWeek > nextTotalWeeks ? null : currentState.currentWeek,
      startedWeeks: currentState.startedWeeks.filter((week) => week <= nextTotalWeeks),
      updatedAt: new Date().toISOString(),
    };

    await writeWeekState(nextState);
    res.json(nextState);
  } catch (error) {
    console.error('Error updating total weeks:', error);
    res.status(500).json({ error: 'Failed to update total weeks' });
  }
});

app.post('/api/week-state/reset', async (req, res) => {
  try {
    const resetState = {
      currentWeek: null,
      startedWeeks: [],
      totalWeeks: DEFAULT_TOTAL_WEEKS,
      updatedAt: new Date().toISOString(),
    };

    await writeWeekState(resetState);
    res.status(201).json(resetState);
  } catch (error) {
    console.error('Error resetting week state:', error);
    res.status(500).json({ error: 'Failed to reset week state' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize and start server
ensureDataDirectory().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize server:', error);
  process.exit(1);
});
