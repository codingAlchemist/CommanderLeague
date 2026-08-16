const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { registerPlayerRoutes } = require('./playerRoutes');

test('registerPlayerRoutes marks an achievement complete for a player via POST /api/player/:id/achievements', async () => {
    const app = express();
    app.use(express.json());

    let savedSignups = [
        {
            id: 'player-123',
            playerName: 'Alice',
            email: 'alice@example.com',
            discordUsername: 'alice',
            password: 'password123',
            deckName: 'Azorius Control',
            commander: 'Brago, King Eternal',
            points: 10,
            absent: false,
            completedAchievements: [],
        },
    ];

    const achievements = [
        {
            id: 'achievement-001',
            title: 'First Win',
            description: 'Win your first match.',
            rarity: 'common',
            points: 5,
        },
    ];

    registerPlayerRoutes(app, {
        readSignups: async () => savedSignups,
        writeSignups: async (signups) => {
            savedSignups = signups;
        },
        DEFAULT_PLAYER_PASSWORD: 'CommanderLeague2026',
        playerNeedsPasswordReset: () => false,
        withDeckList: (player) => ({ ...player, deckList: ['Commander'] }),
        getPlayerDeckList: () => ['Commander'],
        readAchievements: async () => achievements,
    });

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/api/player/player-123/achievements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ achievementId: 'achievement-001' }),
        });

        assert.equal(response.status, 201);

        const payload = await response.json();
        assert.equal(payload.success, true);
        assert.deepEqual(payload.completedAchievements, ['achievement-001']);
        assert.equal(payload.points, 15);
        assert.equal(savedSignups[0].completedAchievements[0], 'achievement-001');
        assert.equal(savedSignups[0].points, 15);
    } finally {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
        );
    }
});
