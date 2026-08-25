const Deck = require('./Deck');

class Player {
  constructor({ id, playerName, email, discordUsername, deckName, deck, commander, createdAt, points, absent, completedAchievements, password }) {
    this.id = id || Date.now().toString();
    this.playerName = playerName;
    this.email = email;
    this.discordUsername = discordUsername;
    this.password = password;
    this.deckName = deckName;
    this.deck = deck instanceof Deck
      ? deck
      : deck && typeof deck === 'object'
        ? new Deck(
          deck.name || deckName,
          Array.isArray(deck.cards) ? deck.cards : [],
          deck.commander || commander,
        )
        : new Deck(deckName, [], commander);
    this.commander = commander;
    this.points = points || 0;
    this.absent = absent === true;
    this.completedAchievements = Array.isArray(completedAchievements)
      ? completedAchievements
      : [];
    this.createdAt = createdAt || new Date().toISOString();
  }

  // Validate player data
  static validate(data) {
    const errors = [];

    if (!data.playerName || typeof data.playerName !== 'string' || data.playerName.trim() === '') {
      errors.push('Player name is required and must be a non-empty string');
    }

    if (!data.email || typeof data.email !== 'string') {
      errors.push('Email is required');
    } else if (!this.isValidEmail(data.email)) {
      errors.push('Email must be a valid email address');
    }

    if (!data.discordUsername || typeof data.discordUsername !== 'string' || data.discordUsername.trim() === '') {
      errors.push('Discord username is required and must be a non-empty string');
    }

    if (!data.password || typeof data.password !== 'string' || data.password.trim().length < 6) {
      errors.push('Password is required and must be at least 6 characters long');
    }

    if (!data.deckName || typeof data.deckName !== 'string' || data.deckName.trim() === '') {
      errors.push('Deck name is required and must be a non-empty string');
    }

    if (!data.commander || typeof data.commander !== 'string' || data.commander.trim() === '') {
      errors.push('Commander is required and must be a non-empty string');
    }

    if (data.absent !== undefined && typeof data.absent !== 'boolean') {
      errors.push('Absent must be a boolean');
    }

    if (data.completedAchievements !== undefined && !Array.isArray(data.completedAchievements)) {
      errors.push('Completed achievements must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Simple email validation
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Create a new player instance from request data
  static fromRequest(data) {
    const validation = this.validate(data);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
    return new Player(data);
  }

  // Convert player to JSON object
  toJSON() {
    return {
      id: this.id,
      playerName: this.playerName,
      email: this.email,
      discordUsername: this.discordUsername,
      password: this.password,
      deckName: this.deckName,
      deck: this.deck.toJSON(),
      commander: this.commander,
      points: this.points,
      absent: this.absent,
      completedAchievements: this.completedAchievements,
      createdAt: this.createdAt
    };
  }
}

module.exports = Player;
