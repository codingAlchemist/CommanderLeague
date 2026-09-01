const Scry = require('scryfall-sdk');

Scry.setAgent('commander-sign-up-sheet', '1.0.0');

module.exports = {
  registerScryfallRoutes(app, { scryfallCards = Scry.Cards } = {}) {
    app.get('/api/scryfall/autocomplete', async (req, res) => {
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

      if (query.length < 2) {
        return res.json({ data: [] });
      }

      try {
        const cardNames = await scryfallCards.autoCompleteName(query);
        return res.json({ data: cardNames.slice(0, 10) });
      } catch (error) {
        console.error('Error autocompleting Scryfall card name:', error);
        return res.status(502).json({ error: 'Unable to retrieve card suggestions' });
      }
    });

    return app;
  },
};