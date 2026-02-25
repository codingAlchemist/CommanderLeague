class Player {
  constructor({ id, playerName, email, discordUsername, deckName, commander, createdAt, points }) {
    this.id = id || Date.now().toString();
    this.playerName = playerName;
    this.email = email;
    this.discordUsername = discordUsername;
    this.deckName = deckName;
    this.commander = commander;
    this.points = points || 0;
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

    if (!data.deckName || typeof data.deckName !== 'string' || data.deckName.trim() === '') {
      errors.push('Deck name is required and must be a non-empty string');
    }

    if (!data.commander || typeof data.commander !== 'string' || data.commander.trim() === '') {
      errors.push('Commander is required and must be a non-empty string');
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
      deckName: this.deckName,
      commander: this.commander,
      points: this.points,
      createdAt: this.createdAt
    };
  }
}

module.exports = Player;
