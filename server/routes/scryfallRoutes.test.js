const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { registerScryfallRoutes } = require('./scryfallRoutes');

test('registerScryfallRoutes returns card suggestions for a valid query', async () => {
  const app = express();
  registerScryfallRoutes(app, {
    scryfallCards: {
      prefix: 'Sol',
      async autoCompleteName() {
        return [`${this.prefix} Ring`, `${this.prefix} Talisman`];
      },
    },
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/scryfall/autocomplete?q=sol`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: ['Sol Ring', 'Sol Talisman'] });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('registerScryfallRoutes skips lookups for short queries', async () => {
  const app = express();
  let wasCalled = false;
  registerScryfallRoutes(app, {
    scryfallCards: {
      async autoCompleteName() {
        wasCalled = true;
        return [];
      },
    },
  });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/scryfall/autocomplete?q=s`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: [] });
    assert.equal(wasCalled, false);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});