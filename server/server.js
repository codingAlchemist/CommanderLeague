const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const Player = require('./models/Player');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'signups.json');
const WEEK_STATE_FILE = path.join(__dirname, 'data', 'week-state.json');
const ADMIN_CREDENTIALS_FILE = path.join(__dirname, 'data', 'admin-credentials.json');
const DEFAULT_TOTAL_WEEKS = 8;
const MIN_TOTAL_WEEKS = 1;
const MAX_TOTAL_WEEKS = 10;

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
    const initialAdminCredentials = {
      username: 'jason.debottis@gmail.com',
      password: 'Area51Admin'
    };
    await fs.writeFile(ADMIN_CREDENTIALS_FILE, JSON.stringify(initialAdminCredentials, null, 2));
  }
}

// Read signups from file
async function readSignups() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading signups:', error);
    return [];
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

// Routes

// Admin login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const requestIp = req.ip || req.socket?.remoteAddress || 'unknown';
  const attemptedUsername = typeof username === 'string' ? username.trim().toLowerCase() : 'invalid';

  console.info('Admin login attempt', {
    username: attemptedUsername,
    ip: requestIp,
    timestamp: new Date().toISOString()
  });

  if (typeof username !== 'string' || typeof password !== 'string') {
    console.warn('Admin login rejected: missing credentials', {
      username: attemptedUsername,
      ip: requestIp
    });
    return res.status(400).json({ error: 'Username and password are required' });
  }

  let adminCredentials;
  try {
    adminCredentials = await readAdminCredentials();
  } catch (error) {
    console.error('Error reading admin credentials:', error);
    console.error('Admin login failed: credentials source unavailable', {
      username: attemptedUsername,
      ip: requestIp
    });
    return res.status(500).json({ error: 'Failed to validate admin credentials' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const isValidUsername = normalizedUsername === adminCredentials.username.trim().toLowerCase();
  const isValidPassword = password === adminCredentials.password;

  if (!isValidUsername || !isValidPassword) {
    console.warn('Admin login rejected: invalid credentials', {
      username: normalizedUsername,
      ip: requestIp
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  console.info('Admin login successful', {
    username: normalizedUsername,
    ip: requestIp,
    timestamp: new Date().toISOString()
  });

  return res.json({ authenticated: true, isAdmin: true });
});

// Get precons
app.get('/api/precons', async (req, res) => {
  try {
    const preconsFile = path.join(__dirname, 'data', 'precons-2023.json');
    const data = await fs.readFile(preconsFile, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading precons:', error);
    res.status(500).json({ error: 'Failed to retrieve precons' });
  }
});

// Get all signups
app.get('/api/signups', async (req, res) => {
  try {
    const signups = await readSignups();
    res.json(signups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve signups' });
  }
});

// Get signups ranked by points (descending)
app.get('/api/signups/ranked', async (req, res) => {
  try {
    const signups = await readSignups();
    const ranked = (Array.isArray(signups) ? signups.slice() : []).sort((a, b) => (b.points || 0) - (a.points || 0));
    res.json(ranked);
  } catch (error) {
    console.error('Error retrieving ranked signups:', error);
    res.status(500).json({ error: 'Failed to retrieve ranked signups' });
  }
});

// Get tournament week state
app.get('/api/week-state', async (req, res) => {
  try {
    const weekState = await readWeekState();
    res.json(weekState);
  } catch (error) {
    console.error('Error retrieving week state:', error);
    res.status(500).json({ error: 'Failed to retrieve week state' });
  }
});

// Start a week in the tournament
app.put('/api/week-state/current', async (req, res) => {
  try {
    const { week } = req.body;

    const weekState = await readWeekState();

    if (!Number.isInteger(week) || week < 1 || week > weekState.totalWeeks) {
      return res.status(400).json({
        error: `Week must be a positive integer between 1 and ${weekState.totalWeeks}`
      });
    }

    const startedWeeks = Array.from(new Set([...weekState.startedWeeks, week])).sort((a, b) => a - b);

    const updatedState = {
      currentWeek: week,
      startedWeeks,
      totalWeeks: weekState.totalWeeks,
      updatedAt: new Date().toISOString()
    };

    await writeWeekState(updatedState);
    res.json(updatedState);
  } catch (error) {
    console.error('Error updating week state:', error);
    res.status(500).json({ error: 'Failed to update week state' });
  }
});

// Patch week state (allow partial overwrite of currentWeek and startedWeeks)
app.patch('/api/week-state', async (req, res) => {
  try {
    const { currentWeek, startedWeeks, totalWeeks } = req.body;

    const validTotalWeeks = Number.isInteger(totalWeeks)
      ? Math.max(MIN_TOTAL_WEEKS, Math.min(MAX_TOTAL_WEEKS, totalWeeks))
      : null;
    const existingState = await readWeekState();
    const resolvedTotalWeeks = validTotalWeeks ?? existingState.totalWeeks;

    const validCurrentWeek = typeof currentWeek === 'number' && Number.isInteger(currentWeek) && currentWeek > 0 && currentWeek <= resolvedTotalWeeks
      ? currentWeek
      : null;

    const validStartedWeeks = Array.isArray(startedWeeks)
      ? startedWeeks
        .map(w => parseInt(w, 10))
        .filter(w => Number.isInteger(w) && w > 0 && w <= resolvedTotalWeeks)
        .sort((a, b) => a - b)
      : [];

    const updatedState = {
      currentWeek: validCurrentWeek,
      startedWeeks: validStartedWeeks,
      totalWeeks: resolvedTotalWeeks,
      updatedAt: new Date().toISOString()
    };

    await writeWeekState(updatedState);
    res.json(updatedState);
  } catch (error) {
    console.error('Error patching week state:', error);
    res.status(500).json({ error: 'Failed to patch week state' });
  }
});

// Reset the current week and started weeks
app.post('/api/week-state/reset', async (req, res) => {
  try {
    const existingState = await readWeekState();
    const resetState = {
      currentWeek: null,
      startedWeeks: [],
      totalWeeks: existingState.totalWeeks,
      updatedAt: new Date().toISOString()
    };

    await writeWeekState(resetState);
    res.json(resetState);
  } catch (error) {
    console.error('Error resetting week state:', error);
    res.status(500).json({ error: 'Failed to reset week state' });
  }
});

// Toggle a week as started or ended
app.post('/api/week-state/toggle', async (req, res) => {
  try {
    const { week } = req.body;

    const weekState = await readWeekState();

    if (!Number.isInteger(week) || week < 1 || week > weekState.totalWeeks) {
      return res.status(400).json({
        error: `Week must be a positive integer between 1 and ${weekState.totalWeeks}`
      });
    }

    const started = new Set(weekState.startedWeeks);
    let updatedCurrentWeek = weekState.currentWeek;

    if (started.has(week)) {
      // End the week
      started.delete(week);
      if (updatedCurrentWeek === week) {
        updatedCurrentWeek = null;
      }
    } else {
      // Start the week
      started.add(week);
      updatedCurrentWeek = week;
    }

    const updatedState = {
      currentWeek: updatedCurrentWeek,
      startedWeeks: Array.from(started).sort((a, b) => a - b),
      totalWeeks: weekState.totalWeeks,
      updatedAt: new Date().toISOString()
    };

    await writeWeekState(updatedState);
    res.json(updatedState);
  } catch (error) {
    console.error('Error toggling week state:', error);
    res.status(500).json({ error: 'Failed to toggle week state' });
  }
});

// Adjust total number of weeks in league schedule
app.patch('/api/week-state/total-weeks', async (req, res) => {
  try {
    const { delta } = req.body;

    if (!Number.isInteger(delta) || ![-1, 1].includes(delta)) {
      return res.status(400).json({ error: 'Delta must be either 1 or -1' });
    }

    const weekState = await readWeekState();
    const updatedTotalWeeks = Math.max(
      MIN_TOTAL_WEEKS,
      Math.min(MAX_TOTAL_WEEKS, weekState.totalWeeks + delta)
    );

    const updatedStartedWeeks = weekState.startedWeeks.filter((week) => week <= updatedTotalWeeks);
    const updatedCurrentWeek =
      weekState.currentWeek !== null && weekState.currentWeek <= updatedTotalWeeks
        ? weekState.currentWeek
        : null;

    const updatedState = {
      currentWeek: updatedCurrentWeek,
      startedWeeks: updatedStartedWeeks,
      totalWeeks: updatedTotalWeeks,
      updatedAt: new Date().toISOString()
    };

    await writeWeekState(updatedState);
    res.json(updatedState);
  } catch (error) {
    console.error('Error adjusting total weeks:', error);
    res.status(500).json({ error: 'Failed to adjust total weeks' });
  }
});

// Create a new signup
app.post('/api/signups', async (req, res) => {
  try {
    // Validate using Player model
    const validation = Player.validate(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const signups = await readSignups();

    // Check for duplicate email
    if (signups.some(signup => signup.email === req.body.email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create new player using the model
    const newPlayer = new Player(req.body);

    signups.push(newPlayer.toJSON());
    await writeSignups(signups);

    res.status(201).json(newPlayer.toJSON());
  } catch (error) {
    console.error('Error creating signup:', error);
    res.status(500).json({ error: 'Failed to create signup' });
  }
});

// Delete a signup
app.delete('/api/signups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const signups = await readSignups();

    const filteredSignups = signups.filter(signup => signup.id !== id);

    if (filteredSignups.length === signups.length) {
      return res.status(404).json({ error: 'Signup not found' });
    }

    await writeSignups(filteredSignups);
    res.json({ message: 'Signup deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete signup' });
  }
});

// Delete all signups
app.delete('/api/signups', async (req, res) => {
  try {
    await writeSignups([]);
    res.json({ message: 'All signups deleted successfully' });
  } catch (error) {
    console.error('Error deleting all signups:', error);
    res.status(500).json({ error: 'Failed to delete all signups' });
  }
});

// Update player points
app.patch('/api/signups/:id/points', async (req, res) => {
  try {
    const { id } = req.params;
    const { points } = req.body;

    if (typeof points !== 'number') {
      return res.status(400).json({ error: 'Points must be a number' });
    }

    const signups = await readSignups();
    const playerIndex = signups.findIndex(signup => signup.id === id);

    if (playerIndex === -1) {
      return res.status(404).json({ error: 'Player not found' });
    }

    signups[playerIndex].points = points;
    await writeSignups(signups);

    res.json(signups[playerIndex]);
  } catch (error) {
    console.error('Error updating points:', error);
    res.status(500).json({ error: 'Failed to update points' });
  }
});

// Group players into groups of 4 (in signup order)
app.get('/api/groups', async (req, res) => {
  try {
    const signups = await readSignups();

    // Group players into groups of 4
    const groups = [];
    for (let i = 0; i < signups.length; i += 4) {
      groups.push({
        groupNumber: Math.floor(i / 4) + 1,
        players: signups.slice(i, i + 4),
        playerCount: Math.min(4, signups.length - i)
      });
    }

    res.json({
      totalPlayers: signups.length,
      totalGroups: groups.length,
      groups: groups
    });
  } catch (error) {
    console.error('Error creating groups:', error);
    res.status(500).json({ error: 'Failed to create groups' });
  }
});

// Group players into groups of 4 randomly
app.get('/api/groups/random', async (req, res) => {
  try {
    const signups = await readSignups();

    // Shuffle players randomly
    const shuffledPlayers = shuffleArray([...signups]);

    res.json(shuffledPlayers);
  } catch (error) {
    console.error('Error creating random groups:', error);
    res.status(500).json({ error: 'Failed to create random groups' });
  }
});

// Helper function to shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize and start server
ensureDataDirectory().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error('Failed to initialize server:', error);
  process.exit(1);
});
