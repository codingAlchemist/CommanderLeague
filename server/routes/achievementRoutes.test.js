const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { registerAchievementRoutes } = require('./achievementRoutes');

test('registerAchievementRoutes creates an achievement via POST /api/achievements', async () => {
    const app = express();
    app.use(express.json());

    let savedAchievements = [
        {
            id: 'ach-001',
            title: 'Existing Achievement',
            description: 'Already here',
            rarity: 'common',
            category: 'victory',
            points: 5,
        },
    ];

    registerAchievementRoutes(app, {
        readAchievements: async () => savedAchievements,
        writeAchievements: async (achievements) => {
            savedAchievements = achievements;
        },
    });

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/api/achievements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'New Achievement',
                description: 'Earn big bragging rights.',
                rarity: 'epic',
                category: 'victory',
            }),
        });

        assert.equal(response.status, 201);

        const payload = await response.json();
        assert.equal(payload.title, 'New Achievement');
        assert.equal(payload.rarity, 'epic');
        assert.equal(payload.category, 'victory');
        assert.equal(payload.points, 20);
        assert.equal(payload.id, 'ach-002');
        assert.equal(savedAchievements.length, 2);
    } finally {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
        );
    }
});

test('registerAchievementRoutes updates an achievement via PATCH /api/achievements/:id', async () => {
    const app = express();
    app.use(express.json());

    let savedAchievements = [
        {
            id: 'ach-001',
            title: 'Existing Achievement',
            description: 'Already here',
            rarity: 'common',
            category: 'victory',
            points: 5,
            createdAt: '2024-01-01T00:00:00.000Z',
        },
    ];

    registerAchievementRoutes(app, {
        readAchievements: async () => savedAchievements,
        writeAchievements: async (achievements) => {
            savedAchievements = achievements;
        },
    });

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/api/achievements/ach-001`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Updated Achievement',
                description: 'This has been revised.',
                rarity: 'epic',
                category: 'strategy',
            }),
        });

        assert.equal(response.status, 200);

        const payload = await response.json();
        assert.equal(payload.title, 'Updated Achievement');
        assert.equal(payload.description, 'This has been revised.');
        assert.equal(payload.rarity, 'epic');
        assert.equal(payload.category, 'strategy');
        assert.equal(payload.points, 20);
        assert.equal(savedAchievements[0].title, 'Updated Achievement');
    } finally {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
        );
    }
});
