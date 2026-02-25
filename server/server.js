const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'signups.json');

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

// Routes

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

// Create a new signup
app.post('/api/signups', async (req, res) => {
  try {
    const { playerName, email, discordUsername, deckName, commander } = req.body;
    
    // Validate required fields
    if (!playerName || !email || !discordUsername || !deckName || !commander) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const signups = await readSignups();
    
    // Check for duplicate email
    if (signups.some(signup => signup.email === email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    const newSignup = {
      id: Date.now().toString(),
      playerName,
      email,
      discordUsername,
      deckName,
      commander,
      createdAt: new Date().toISOString()
    };
    
    signups.push(newSignup);
    await writeSignups(signups);
    
    res.status(201).json(newSignup);
  } catch (error) {
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
    
    // Group players into groups of 4
    const groups = [];
    for (let i = 0; i < shuffledPlayers.length; i += 4) {
      groups.push({
        groupNumber: Math.floor(i / 4) + 1,
        players: shuffledPlayers.slice(i, i + 4),
        playerCount: Math.min(4, shuffledPlayers.length - i)
      });
    }
    
    res.json({
      totalPlayers: shuffledPlayers.length,
      totalGroups: groups.length,
      groups: groups,
      shuffled: true
    });
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