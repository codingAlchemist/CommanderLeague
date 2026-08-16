# Player Routes

This document describes the player-related API endpoints registered by `playerRoutes.js`.

## Authentication and profile endpoints

### `POST /api/player/login`
Authenticates a player by email or Discord username and password.

Request body:
```json
{
  "identifier": "alice@example.com",
  "password": "password123"
}
```

Behavior:
- Looks up the player by `email` or `discordUsername`
- Validates the password
- Returns the player payload with `deckList`
- Includes `requiresPasswordSetup` and `passwordNeedsReset` when applicable

Success response (200):
```json
{
  "id": "player-123",
  "playerName": "Alice",
  "email": "alice@example.com",
  "discordUsername": "alice",
  "deckName": "Azorius Control",
  "commander": "Brago, King Eternal",
  "deckList": ["Commander", "Sol Ring", "Arcane Signet"],
  "requiresPasswordSetup": false,
  "passwordNeedsReset": false
}
```

Error responses:
- `400` for missing or invalid input
- `401` for invalid credentials
- `404` when the player does not exist
- `500` for server failures

### `PATCH /api/player/:id/password`
Sets a new password for a specific player.

Request body:
```json
{
  "password": "newSecurePassword"
}
```

Validation:
- password must be a string
- minimum length is 6 characters

Success response (200):
```json
{
  "success": true,
  "player": {
    "id": "player-123",
    "playerName": "Alice",
    "deckList": ["Commander", "Sol Ring", "Arcane Signet"]
  }
}
```

### `PATCH /api/player/:id/deck`
Updates one card in a player's deck list.

Request body:
```json
{
  "cardIndex": 2,
  "replacementCard": "Arcane Signet"
}
```

Validation:
- `cardIndex` must be a non-negative integer
- `replacementCard` must be a non-empty string

Success response (200):
```json
{
  "id": "player-123",
  "playerName": "Alice",
  "deckList": ["Commander", "Sol Ring", "Arcane Signet"]
}
```

### `GET /api/player/:id`
Fetches a single player profile.

Success response (200):
```json
{
  "id": "player-123",
  "playerName": "Alice",
  "email": "alice@example.com",
  "discordUsername": "alice",
  "deckName": "Azorius Control",
  "commander": "Brago, King Eternal",
  "deckList": ["Commander", "Sol Ring", "Arcane Signet"]
}
```

## Achievement-related endpoints

### `GET /api/player/achievements`
Returns a summary of every player's completed achievement IDs.

Success response (200):
```json
[
  {
    "id": "player-123",
    "playerName": "Alice",
    "email": "alice@example.com",
    "discordUsername": "alice",
    "completedAchievements": ["achievement-001"]
  }
]
```

### `GET /api/player/:id/achievements`
Returns the achievement list for one player.

Success response (200):
```json
{
  "id": "player-123",
  "playerName": "Alice",
  "email": "alice@example.com",
  "discordUsername": "alice",
  "completedAchievements": ["achievement-001"]
}
```

### `POST /api/player/:id/achievements`
Marks an achievement as complete for a player and awards the achievement points.

Request body:
```json
{
  "achievementId": "achievement-001"
}
```

Validation:
- `achievementId` is required
- the achievement must exist in the achievements list

Success response (201):
```json
{
  "success": true,
  "playerId": "player-123",
  "achievementId": "achievement-001",
  "completedAchievements": ["achievement-001"],
  "points": 15
}
```

If the achievement is already complete, the server responds with `200` and the existing completion state instead of re-awarding points.

## Notes
- Player data is read from the signup store and persisted via the shared `writeSignups` callback.
- Achievement completion is validated against the achievement catalog before points are added.
- Responses sanitize the player password before returning profile data.
