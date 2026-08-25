const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { registerAdminRoutes } = require('./adminRoutes');

test('registerAdminRoutes creates an admin via POST /api/admins', async () => {
    const app = express();
    app.use(express.json());

    let savedAdmins = [
        {
            username: 'owner@example.com',
            password: 'initial-pass',
            createdAt: '2024-01-01T00:00:00.000Z',
        },
    ];

    registerAdminRoutes(app, {
        readAdmins: async () => savedAdmins,
        writeAdmins: async (admins) => {
            savedAdmins = admins;
        },
        signupToken: 'owner-invite-token',
    });

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/api/admins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'new-admin@example.com',
                password: 'super-secret',
                token: 'owner-invite-token',
            }),
        });

        assert.equal(response.status, 201);
        const payload = await response.json();
        assert.equal(payload.username, 'new-admin@example.com');
        assert.equal(savedAdmins.length, 2);
    } finally {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
        );
    }
});

test('registerAdminRoutes rejects an invalid admin sign-up token', async () => {
    const app = express();
    app.use(express.json());

    registerAdminRoutes(app, {
        readAdmins: async () => [],
        writeAdmins: async () => { },
        signupToken: 'owner-invite-token',
    });

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/api/admins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'new-admin@example.com',
                password: 'super-secret',
                token: 'wrong-token',
            }),
        });

        assert.equal(response.status, 403);
    } finally {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
        );
    }
});

test('registerAdminRoutes updates an admin via PATCH /api/admins/:username', async () => {
    const app = express();
    app.use(express.json());

    let savedAdmins = [
        {
            username: 'owner@example.com',
            password: 'initial-pass',
            createdAt: '2024-01-01T00:00:00.000Z',
        },
    ];

    registerAdminRoutes(app, {
        readAdmins: async () => savedAdmins,
        writeAdmins: async (admins) => {
            savedAdmins = admins;
        },
    });

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/api/admins/owner@example.com`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: 'brand-new-pass',
            }),
        });

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.password, 'brand-new-pass');
        assert.equal(savedAdmins[0].password, 'brand-new-pass');
    } finally {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
        );
    }
});

test('registerAdminRoutes deletes an admin via DELETE /api/admins/:username', async () => {
    const app = express();
    app.use(express.json());

    let savedAdmins = [
        {
            username: 'owner@example.com',
            password: 'initial-pass',
            createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
            username: 'backup@example.com',
            password: 'backup-pass',
            createdAt: '2024-01-02T00:00:00.000Z',
        },
    ];

    registerAdminRoutes(app, {
        readAdmins: async () => savedAdmins,
        writeAdmins: async (admins) => {
            savedAdmins = admins;
        },
    });

    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;

    try {
        const response = await fetch(`http://127.0.0.1:${port}/api/admins/backup@example.com`, {
            method: 'DELETE',
        });

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.deleted.username, 'backup@example.com');
        assert.equal(savedAdmins.length, 1);
    } finally {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
        );
    }
});
